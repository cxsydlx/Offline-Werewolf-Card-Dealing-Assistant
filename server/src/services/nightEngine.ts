import { prisma } from "../utils/prisma";
import { AppError } from "../middleware/errorHandler";
import {
  createInitialState,
  getResolver,
  compileDawn,
  type NightGameState,
} from "./moduleRegistry";

/**
 * 开始新一轮黑夜
 */
export async function startNightRound(gameId: number) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { rounds: { orderBy: { roundNumber: "desc" }, take: 1 } },
  });
  if (!game) throw new AppError(404, "GAME_NOT_FOUND", "对局不存在");

  const roundNumber = (game.rounds[0]?.roundNumber || 0) + 1;

  const nightRound = await prisma.nightRound.create({
    data: { gameId, roundNumber, phase: "night", status: "in_progress" },
  });

  return {
    nightRoundId: nightRound.id,
    roundNumber: nightRound.roundNumber,
    status: nightRound.status,
  };
}

/**
 * 获取当前黑夜轮次的下一个待执行模块
 */
export async function getNextModule(nightRoundId: number, gameState: NightGameState) {
  const nightRound = await prisma.nightRound.findUnique({
    where: { id: nightRoundId },
    include: {
      game: {
        include: {
          players: {
            where: { isAlive: true },
            include: { role: true, account: true },
          },
          modules: {
            where: { enabled: true },
            include: { moduleDefinition: true },
            orderBy: { triggerOrder: "asc" },
          },
        },
      },
      actions: { orderBy: { sequenceNumber: "asc" } },
    },
  });
  if (!nightRound) throw new AppError(404, "NIGHT_ROUND_NOT_FOUND", "黑夜轮次不存在");

  // 找到第一个尚未执行的模块
  const executedModuleIds = new Set(
    nightRound.actions.filter((a) => !a.isUndone).map((a) => a.gameModuleId)
  );

  for (const mod of nightRound.game.modules) {
    if (executedModuleIds.has(mod.id)) continue;

    // 查找合格行动者
    const eligibleActors = nightRound.game.players.filter((p) => {
      if (gameState.blockedPlayers.has(p.id)) return false;
      const moduleRoleId = mod.moduleDefinition.roleDefinitionId;
      return p.roleId === moduleRoleId;
    });

    if (eligibleActors.length === 0) {
      // 没有合格行动者，自动跳过
      continue;
    }

    const def = mod.moduleDefinition;
    const validTargets = nightRound.game.players
      .filter((p) => {
        // 狼人不能刀狼人
        if (def.key === "werewolf_kill") {
          const targetRole = p.role;
          return targetRole?.faction !== "werewolf";
        }
        return true;
      })
      .map((p) => ({
        playerId: p.id,
        playerName: p.account.name || `#${p.seatNumber}`,
        isAlive: p.isAlive,
      }));

    return {
      nightRoundId,
      gameModuleId: mod.id,
      moduleName: def.name,
      moduleDescription: def.description,
      eligibleActors: eligibleActors.map((a) => ({
        playerId: a.id,
        playerName: a.account.name || `#${a.seatNumber}`,
      })),
      validTargets,
      minTargets: def.minTargets,
      maxTargets: def.maxTargets,
      canSkip: def.allowSkip,
    };
  }

  // 所有模块已执行完毕
  return null;
}

/**
 * 执行一个黑夜行动
 */
export async function executeNightAction(
  nightRoundId: number,
  gameModuleId: number,
  targetPlayerIds: number[],
  gameState: NightGameState
) {
  const gameModule = await prisma.gameModule.findUnique({
    where: { id: gameModuleId },
    include: {
      moduleDefinition: true,
    },
  });
  if (!gameModule) throw new AppError(404, "MODULE_NOT_FOUND", "模块不存在");

  // 找到行动者
  const nightRound = await prisma.nightRound.findUnique({
    where: { id: nightRoundId },
    include: { game: { include: { players: { where: { isAlive: true }, include: { account: true } } } } },
  });

  const actorDef = gameModule.moduleDefinition;
  const actor = nightRound?.game.players.find(
    (p) => p.roleId === actorDef.roleDefinitionId && !gameState.blockedPlayers.has(p.id)
  );

  if (!actor) {
    throw new AppError(400, "NO_ACTOR", "没有合格的行动者");
  }

  // 执行结算器
  const resolver = getResolver(actorDef.resolutionType);
  if (!resolver) {
    throw new AppError(500, "NO_RESOLVER", `未找到结算器: ${actorDef.resolutionType}`);
  }

  const result = resolver({
    actors: [actor.id],
    targets: targetPlayerIds,
    gameState,
    params: gameModule.params,
  });

  // 记录行动
  const actions = await prisma.nightAction.findMany({
    where: { nightRoundId },
    orderBy: { sequenceNumber: "desc" },
  });
  const seqNumber = (actions[0]?.sequenceNumber || 0) + 1;

  const nightAction = await prisma.nightAction.create({
    data: {
      nightRoundId,
      gameModuleId,
      actorPlayerId: actor.id,
      actionType: actorDef.resolutionType,
      sequenceNumber: seqNumber,
      resultData: JSON.stringify(result.effectData),
      targets: {
        create: targetPlayerIds.map((tpid) => ({ targetPlayerId: tpid })),
      },
    },
    include: { targets: true },
  });

  return {
    nightAction: {
      id: nightAction.id,
      nightRoundId: nightAction.nightRoundId,
      gameModuleId: nightAction.gameModuleId,
      actionType: nightAction.actionType,
      sequenceNumber: nightAction.sequenceNumber,
      isUndone: nightAction.isUndone,
      actorPlayerId: nightAction.actorPlayerId,
      targetPlayerIds: nightAction.targets.map((t) => t.targetPlayerId),
      resultData: nightAction.resultData,
    },
    updatedState: result.updatedState,
  };
}

/**
 * 跳过当前模块
 */
export async function skipNightModule(
  nightRoundId: number,
  gameModuleId: number
) {
  const nightRound = await prisma.nightRound.findUnique({
    where: { id: nightRoundId },
    include: { actions: { orderBy: { sequenceNumber: "desc" } } },
  });
  if (!nightRound) throw new AppError(404, "NIGHT_ROUND_NOT_FOUND", "黑夜轮次不存在");

  const seqNumber = (nightRound.actions[0]?.sequenceNumber || 0) + 1;

  const nightAction = await prisma.nightAction.create({
    data: {
      nightRoundId,
      gameModuleId,
      actorPlayerId: 0, // 跳过时无行动者
      actionType: "skip",
      sequenceNumber: seqNumber,
      resultData: JSON.stringify({ skipped: true }),
    },
  });

  return { ok: true, nightActionId: nightAction.id };
}

/**
 * 结算天亮结果
 */
export async function resolveDawn(nightRoundId: number, gameState: NightGameState) {
  const nightRound = await prisma.nightRound.findUnique({
    where: { id: nightRoundId },
    include: {
      game: { include: { players: { include: { account: true } } } },
    },
  });
  if (!nightRound) throw new AppError(404, "NIGHT_ROUND_NOT_FOUND", "黑夜轮次不存在");

  const { deaths, investigations } = compileDawn(gameState);

  // 创建 DawnResult 记录
  for (const player of nightRound.game.players) {
    const death = deaths.find((d) => d.playerId === player.id);
    const investigation = investigations.find((i) => i.playerId === player.id);

    await prisma.dawnResult.create({
      data: {
        nightRoundId,
        gamePlayerId: player.id,
        isDead: !!death,
        causeOfDeath: death?.causeOfDeath || null,
        investigationResult: investigation?.result || null,
      },
    });

    if (death) {
      await prisma.gamePlayer.update({
        where: { id: player.id },
        data: { isAlive: false },
      });
    }
  }

  // 更新轮次状态
  await prisma.nightRound.update({
    where: { id: nightRoundId },
    data: { status: "dawn", phase: "night", endedAt: new Date() },
  });

  return {
    deaths: deaths.map((d) => {
      const player = nightRound.game.players.find((p) => p.id === d.playerId);
      return {
        playerId: d.playerId,
        playerName: player?.account.name || `#${player?.seatNumber}`,
        causeOfDeath: d.causeOfDeath,
      };
    }),
    investigations,
  };
}

/**
 * 撤销上一步行动
 */
export async function undoLastAction(
  nightRoundId: number,
  gameState: NightGameState
) {
  const lastAction = await prisma.nightAction.findFirst({
    where: { nightRoundId, isUndone: false },
    orderBy: { sequenceNumber: "desc" },
    include: { gameModule: { include: { moduleDefinition: true } } },
  });

  if (!lastAction) {
    throw new AppError(400, "NO_ACTION_TO_UNDO", "没有可撤销的行动");
  }

  // 标记为已撤销
  await prisma.nightAction.update({
    where: { id: lastAction.id },
    data: { isUndone: true },
  });

  // 简单回滚：重置 gameState 中的相关状态
  const resolutionType = lastAction.gameModule.moduleDefinition.resolutionType;

  if (resolutionType === "kill" || resolutionType === "poison" || resolutionType === "shoot") {
    const targets = await prisma.nightActionTarget.findMany({
      where: { nightActionId: lastAction.id },
    });
    for (const t of targets) {
      gameState.isMarkedForDeath.delete(t.targetPlayerId);
    }
  } else if (resolutionType === "guard") {
    const targets = await prisma.nightActionTarget.findMany({
      where: { nightActionId: lastAction.id },
    });
    for (const t of targets) {
      gameState.isProtected.delete(t.targetPlayerId);
    }
  } else if (resolutionType === "save") {
    gameState.witchSaveTarget = null;
    gameState.witchHasSavePotion = true;
  } else if (resolutionType === "block") {
    const targets = await prisma.nightActionTarget.findMany({
      where: { nightActionId: lastAction.id },
    });
    for (const t of targets) {
      gameState.blockedPlayers.delete(t.targetPlayerId);
    }
  }

  return { undoneAction: lastAction, updatedState: gameState };
}

/**
 * 获取黑夜日志
 */
export async function getNightLog(gameId: number, roundNumber?: number) {
  const where: any = { gameId };
  if (roundNumber) where.roundNumber = roundNumber;

  const rounds = await prisma.nightRound.findMany({
    where,
    include: {
      actions: {
        include: { targets: true, gameModule: { include: { moduleDefinition: true } } },
        orderBy: { sequenceNumber: "asc" },
      },
      results: true,
    },
    orderBy: { roundNumber: "asc" },
  });

  return rounds.map((r) => ({
    roundNumber: r.roundNumber,
    status: r.status,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt?.toISOString(),
    actions: r.actions.map((a) => ({
      id: a.id,
      moduleName: a.gameModule.moduleDefinition.name,
      actionType: a.actionType,
      sequenceNumber: a.sequenceNumber,
      isUndone: a.isUndone,
      targets: a.targets.map((t) => t.targetPlayerId),
      resultData: a.resultData,
    })),
    dawnResults: r.results.map((dr) => ({
      gamePlayerId: dr.gamePlayerId,
      isDead: dr.isDead,
      causeOfDeath: dr.causeOfDeath,
      investigationResult: dr.investigationResult,
    })),
  }));
}
