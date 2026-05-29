import { prisma } from "../utils/prisma";
import { AppError } from "../middleware/errorHandler";
import type { GameInfo, GamePlayerInfo, GameRoleInfo } from "../types";

export async function createGame(roomCode: string, hostAccountId: number) {
  const room = await prisma.room.findUnique({
    where: { code: roomCode },
    include: { players: true },
  });
  if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "房间不存在");
  if (room.hostAccountId !== hostAccountId) {
    throw new AppError(403, "NOT_HOST", "只有主持人可以开始新一轮对局");
  }
  if (room.status !== "waiting" && room.status !== "between_games") {
    throw new AppError(400, "INVALID_ROOM_STATUS", "当前房间状态不允许开新对局");
  }

  // 主持人不参赛 → 不计入 playerCount，不创建 GamePlayer
  const playingPlayers = room.players.filter((p) => !p.isHost || room.hostPlays);
  const playerCount = playingPlayers.length;
  const roundNumber = (await prisma.game.count({ where: { roomId: room.id } })) + 1;

  const game = await prisma.game.create({
    data: {
      roomId: room.id,
      roundNumber,
      hostAccountId,
      status: "setup",
      playerCount,
      spectatorMode: !room.hostPlays, // 主持人不参赛 → 自动开启观战
      players: {
        create: playingPlayers.map((p, index) => ({
          accountId: p.accountId,
          seatNumber: index + 1,
          isHost: p.isHost,
        })),
      },
    },
  });

  // 继承上一轮的角色配置
  if (roundNumber > 1) {
    const prevGame = await prisma.game.findFirst({
      where: { roomId: room.id, id: { not: game.id } },
      include: { roles: true },
      orderBy: { roundNumber: "desc" },
    });
    if (prevGame && prevGame.roles.length > 0) {
      await prisma.gameRole.createMany({
        data: prevGame.roles.map((r) => ({
          gameId: game.id,
          roleId: r.roleId,
          count: r.count,
        })),
      });
    }
  }

  // 更新房间状态
  await prisma.room.update({
    where: { id: room.id },
    data: { status: "playing", currentGameId: game.id },
  });

  return { gameId: game.id, roundNumber, playerCount };
}

export async function getGame(gameId: number): Promise<GameInfo> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        include: {
          account: { include: { nickname: true } },
          role: true,
          preferences: true,
        },
      },
      roles: {
        include: { role: true },
      },
    },
  });
  if (!game) throw new AppError(404, "GAME_NOT_FOUND", "对局不存在");

  return formatGameInfo(game);
}

export async function startPreferencePhase(gameId: number, hostAccountId: number) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new AppError(404, "GAME_NOT_FOUND", "对局不存在");
  if (game.hostAccountId !== hostAccountId) {
    throw new AppError(403, "NOT_HOST", "只有主持人可以开始身份分配");
  }
  if (game.status !== "setup") {
    throw new AppError(400, "INVALID_GAME_STATUS", "当前对局状态不允许此操作");
  }

  // 验证角色总数匹配
  const roles = await prisma.gameRole.findMany({ where: { gameId } });
  const totalRoles = roles.reduce((sum, r) => sum + r.count, 0);
  if (totalRoles !== game.playerCount) {
    throw new AppError(400, "ROLE_COUNT_MISMATCH", `角色总数(${totalRoles})与玩家数(${game.playerCount})不匹配`);
  }

  // 验证至少有一个狼人
  const allRoles = await prisma.roleDefinition.findMany({
    where: { id: { in: roles.map((r) => r.roleId) } },
  });
  const hasWolf = allRoles.some((rd) => rd.faction === "werewolf" && (roles.find((r) => r.roleId === rd.id)?.count || 0) > 0);
  if (!hasWolf) throw new AppError(400, "NO_WEREWOLF", "至少需要一个狼人角色");

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: { status: "preference" },
    include: { room: true },
  });

  return { ok: true, roomCode: updated.room.code };
}

export async function endGame(gameId: number, hostAccountId: number) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { room: true },
  });
  if (!game) throw new AppError(404, "GAME_NOT_FOUND", "对局不存在");
  if (game.hostAccountId !== hostAccountId) {
    throw new AppError(403, "NOT_HOST", "只有主持人可以结束对局");
  }

  await prisma.game.update({
    where: { id: gameId },
    data: { status: "ended", endedAt: new Date() },
  });

  // 房间进入 between_games 状态
  await prisma.room.update({
    where: { id: game.roomId },
    data: { status: "between_games", currentGameId: null },
  });

  return { ok: true };
}

export async function configureRoles(
  gameId: number,
  hostAccountId: number,
  roles: Array<{ roleId: number; count: number }>
) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new AppError(404, "GAME_NOT_FOUND", "对局不存在");
  if (game.hostAccountId !== hostAccountId) {
    throw new AppError(403, "NOT_HOST", "只有主持人可以配置角色");
  }

  const totalCount = roles.reduce((sum, r) => sum + r.count, 0);
  if (totalCount !== game.playerCount) {
    throw new AppError(400, "ROLE_COUNT_MISMATCH", `角色总数(${totalCount})必须等于玩家数(${game.playerCount})`);
  }

  // 清除旧配置
  await prisma.gameRole.deleteMany({ where: { gameId } });

  // 写入新配置
  await prisma.gameRole.createMany({
    data: roles
      .filter((r) => r.count > 0)
      .map((r) => ({
        gameId,
        roleId: r.roleId,
        count: r.count,
      })),
  });

  return getGameRoles(gameId);
}

export async function getGameRoles(gameId: number): Promise<GameRoleInfo[]> {
  const roles = await prisma.gameRole.findMany({
    where: { gameId },
    include: { role: true },
  });

  return roles.map((r) => ({
    id: r.id,
    roleId: r.roleId,
    roleKey: r.role.key,
    roleName: r.role.name,
    faction: r.role.faction,
    count: r.count,
  }));
}

export async function configureModules(
  gameId: number,
  hostAccountId: number,
  modules: Array<{ moduleDefinitionId: number; enabled: boolean; triggerOrder: number; params?: any }>
) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new AppError(404, "GAME_NOT_FOUND", "对局不存在");
  if (game.hostAccountId !== hostAccountId) {
    throw new AppError(403, "NOT_HOST", "只有主持人可以配置模块");
  }

  // 清除旧配置
  await prisma.gameModule.deleteMany({ where: { gameId } });

  // 写入新配置
  if (modules.length > 0) {
    await prisma.gameModule.createMany({
      data: modules.map((m) => ({
        gameId,
        moduleDefinitionId: m.moduleDefinitionId,
        enabled: m.enabled,
        triggerOrder: m.triggerOrder,
        params: m.params || undefined,
      })),
    });
  }

  return getGameModules(gameId);
}

export async function getGameModules(gameId: number) {
  const modules = await prisma.gameModule.findMany({
    where: { gameId },
    include: { moduleDefinition: true },
    orderBy: { triggerOrder: "asc" },
  });

  return modules.map((m) => ({
    id: m.id,
    moduleDefinitionId: m.moduleDefinitionId,
    moduleKey: m.moduleDefinition.key,
    moduleName: m.moduleDefinition.name,
    enabled: m.enabled,
    triggerOrder: m.triggerOrder,
    params: m.params,
  }));
}

export async function initializeGameModules(gameId: number) {
  // 获取本局角色配置
  const gameRoles = await prisma.gameRole.findMany({
    where: { gameId, count: { gt: 0 } },
  });
  const usedRoleIds = gameRoles.map((r) => r.roleId);

  // 获取这些角色的模块定义
  const moduleDefs = await prisma.moduleDefinition.findMany({
    where: { roleDefinitionId: { in: usedRoleIds }, enabledByDefault: true },
    orderBy: { triggerOrder: "asc" },
  });

  // 创建 GameModule 记录
  const existingCount = await prisma.gameModule.count({ where: { gameId } });
  if (existingCount === 0) {
    await prisma.gameModule.createMany({
      data: moduleDefs.map((m, idx) => ({
        gameId,
        moduleDefinitionId: m.id,
        enabled: true,
        triggerOrder: idx,
        params: m.defaultParams as any,
      })),
    });
  }

  return getGameModules(gameId);
}

export async function toggleSpectator(
  gameId: number,
  hostAccountId: number,
  enabled: boolean
) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new AppError(404, "GAME_NOT_FOUND", "对局不存在");
  if (game.hostAccountId !== hostAccountId) {
    throw new AppError(403, "NOT_HOST", "只有主持人可以切换观战模式");
  }

  await prisma.game.update({
    where: { id: gameId },
    data: { spectatorMode: enabled },
  });

  return { spectatorMode: enabled };
}

function formatGameInfo(game: any): GameInfo {
  return {
    id: game.id,
    roomId: game.roomId,
    roundNumber: game.roundNumber,
    hostAccountId: game.hostAccountId,
    status: game.status,
    playerCount: game.playerCount,
    spectatorMode: game.spectatorMode,
    players: game.players.map(
      (p: any): GamePlayerInfo => ({
        id: p.id,
        accountId: p.accountId,
        accountName: p.account.name,
        nickname: p.account.nickname?.nickname || undefined,
        seatNumber: p.seatNumber,
        roleId: p.roleId || undefined,
        roleName: p.role?.name || undefined,
        roleFaction: p.role?.faction || undefined,
        isAlive: p.isAlive,
        isHost: p.isHost,
        identityRevealed: p.identityRevealed,
        hasPreference: p.preferences.length > 0,
      })
    ),
    roles: (game.roles || []).map(
      (r: any): GameRoleInfo => ({
        id: r.id,
        roleId: r.roleId,
        roleKey: r.role.key,
        roleName: r.role.name,
        faction: r.role.faction,
        count: r.count,
      })
    ),
    createdAt: game.createdAt.toISOString(),
    endedAt: game.endedAt?.toISOString(),
  };
}
