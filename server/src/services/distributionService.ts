import { prisma } from "../utils/prisma";
import { AppError } from "../middleware/errorHandler";

/**
 * 带偏好的身份随机分配算法
 */
export async function distributeRoles(gameId: number) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: { include: { preferences: true, account: true } },
      roles: { include: { role: true } },
    },
  });
  if (!game) throw new AppError(404, "GAME_NOT_FOUND", "对局不存在");

  // 1. 展开角色池为单个槽位
  const slots: number[] = [];
  for (const gr of game.roles) {
    for (let i = 0; i < gr.count; i++) {
      slots.push(gr.roleId);
    }
  }

  // Fisher-Yates 洗牌
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  // 2. 读取玩家偏好
  const constrained: Array<{ playerId: number; accountName: string; preferredRoles: Set<number> }> = [];
  const unconstrained: Array<{ playerId: number; accountName: string }> = [];

  for (const player of game.players) {
    const pref = player.preferences[0];
    if (pref) {
      const prefIds: number[] = JSON.parse(pref.preferredRoleIds || "[]");
      if (Array.isArray(prefIds) && prefIds.length > 0) {
        constrained.push({
          playerId: player.id,
          accountName: player.account.name,
          preferredRoles: new Set(prefIds),
        });
        continue;
      }
    }
    unconstrained.push({
      playerId: player.id,
      accountName: player.account.name,
    });
  }

  // 3. 约束型玩家按偏好数量升序（偏好少 = 意愿强 = 优先）
  constrained.sort((a, b) => a.preferredRoles.size - b.preferredRoles.size);

  // 预加载角色定义
  const roleDefs = await prisma.roleDefinition.findMany({
    where: { id: { in: [...new Set(slots)] } },
  });
  const roleMap = new Map(roleDefs.map((r) => [r.id, r]));

  const assignments: Array<{ playerId: number; accountName: string; roleId: number; roleName: string; roleKey: string; roleFaction: string }> = [];
  const remainingSlots = [...slots];

  // 4. 分配约束型玩家
  for (const cp of constrained) {
    const matchingIndices: number[] = [];
    remainingSlots.forEach((roleId, idx) => {
      if (cp.preferredRoles.has(roleId)) {
        matchingIndices.push(idx);
      }
    });

    let pickedIdx: number;
    if (matchingIndices.length > 0) {
      // 从偏好中随机选
      const randIdx = matchingIndices[Math.floor(Math.random() * matchingIndices.length)];
      pickedIdx = randIdx;
    } else {
      // 偏好无法满足，从全池随机
      pickedIdx = Math.floor(Math.random() * remainingSlots.length);
    }

    const assignedRoleId = remainingSlots[pickedIdx];
    remainingSlots.splice(pickedIdx, 1);

    const rd = roleMap.get(assignedRoleId);
    assignments.push({
      playerId: cp.playerId,
      accountName: cp.accountName,
      roleId: assignedRoleId,
      roleName: rd?.name || "未知",
      roleKey: rd?.key || "unknown",
      roleFaction: rd?.faction || "villager",
    });
  }

  // 5. 分配自由型玩家（也洗一次牌）
  const shuffledUnconstrained = [...unconstrained].sort(() => Math.random() - 0.5);
  for (const up of shuffledUnconstrained) {
    const pickedIdx = Math.floor(Math.random() * remainingSlots.length);
    const assignedRoleId = remainingSlots[pickedIdx];
    remainingSlots.splice(pickedIdx, 1);

    const rd = roleMap.get(assignedRoleId);
    assignments.push({
      playerId: up.playerId,
      accountName: up.accountName,
      roleId: assignedRoleId,
      roleName: rd?.name || "未知",
      roleKey: rd?.key || "unknown",
      roleFaction: rd?.faction || "villager",
    });
  }

  return { assignments, remaining: remainingSlots.length };
}

/**
 * 提交身份偏好
 */
export async function submitPreference(
  gamePlayerId: number,
  preferredRoleIds: number[]
) {
  const gamePlayer = await prisma.gamePlayer.findUnique({
    where: { id: gamePlayerId },
    include: { game: true },
  });
  if (!gamePlayer) throw new AppError(404, "PLAYER_NOT_FOUND", "玩家不存在");
  if (gamePlayer.game.status !== "preference") {
    throw new AppError(400, "NOT_PREFERENCE_PHASE", "当前不在偏好提交阶段");
  }

  await prisma.identityPreference.deleteMany({ where: { gamePlayerId } });
  await prisma.identityPreference.create({
    data: {
      gamePlayerId,
      preferredRoleIds: JSON.stringify(preferredRoleIds),
    },
  });

  return { ok: true };
}

/**
 * 获取偏好提交状态
 */
export async function getPreferenceStatus(gameId: number) {
  const players = await prisma.gamePlayer.findMany({
    where: { gameId },
    include: {
      account: true,
      preferences: true,
    },
  });

  return players.map((p) => ({
    playerId: p.id,
    accountName: p.account.name,
    hasPreference: p.preferences.length > 0,
    preferredRoleIds: p.preferences[0]?.preferredRoleIds || null,
  }));
}

/**
 * 主持人确认分配，持久化并推送身份给各玩家
 */
export async function approveDistribution(
  gameId: number,
  assignments: Array<{ playerId: number; roleId: number }>
) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: { include: { account: true, role: true } },
      room: true,
    },
  });
  if (!game) throw new AppError(404, "GAME_NOT_FOUND", "对局不存在");

  // 事务：批量更新身份 + 切换游戏状态
  await prisma.$transaction(async (tx) => {
    for (const assign of assignments) {
      await tx.gamePlayer.update({
        where: { id: assign.playerId },
        data: { roleId: assign.roleId },
      });
    }
    await tx.game.update({
      where: { id: gameId },
      data: { status: "playing" },
    });
  });

  // 获取身份信息供 Socket.io 广播使用
  const identities = [];
  for (const assign of assignments) {
    const role = await prisma.roleDefinition.findUnique({ where: { id: assign.roleId } });
    identities.push({
      playerId: assign.playerId,
      accountId: game.players.find((p) => p.id === assign.playerId)?.accountId,
      roleName: role?.name,
      roleKey: role?.key,
      faction: role?.faction,
    });
  }

  return { ok: true, identities, roomCode: game.room.code };
}
