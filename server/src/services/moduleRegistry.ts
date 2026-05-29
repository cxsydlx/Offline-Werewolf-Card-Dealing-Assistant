// 模块结算器注册表

export interface ModuleResolveContext {
  actors: number[];
  targets: number[];
  gameState: NightGameState;
  params: any;
}

export interface ModuleResolveResult {
  effectData: any;
  updatedState: NightGameState;
  summary: string;
}

export interface NightGameState {
  isMarkedForDeath: Set<number>;       // 被标记死亡的玩家 ID
  isProtected: Set<number>;            // 被守护的玩家 ID
  witchSaveTarget: number | null;      // 女巫解药目标（用于同守同救判定）
  witchHasSavePotion: boolean;
  witchHasPoisonPotion: boolean;
  witchPoisonTarget: number | null;    // 女巫毒药目标
  lastGuardTarget: number | null;      // 上轮守卫守护目标
  seerResults: Map<number, string>;    // 预言家查验结果
  blockedPlayers: Set<number>;         // 被催眠的玩家（技能失效）
  swappedPairs: Map<number, number>;   // 魔术师交换映射
  lastWolfTarget: number | null;       // 狼刀目标
}

export function createInitialState(previousState?: Partial<NightGameState>): NightGameState {
  return {
    isMarkedForDeath: new Set(),
    isProtected: new Set(),
    witchSaveTarget: null,
    witchHasSavePotion: previousState?.witchHasSavePotion ?? true,
    witchHasPoisonPotion: previousState?.witchHasPoisonPotion ?? true,
    witchPoisonTarget: null,
    lastGuardTarget: previousState?.lastGuardTarget ?? null,
    seerResults: new Map(),
    blockedPlayers: new Set(),
    swappedPairs: new Map(),
    lastWolfTarget: null,
  };
}

type ModuleResolver = (ctx: ModuleResolveContext) => ModuleResolveResult;

const resolvers = new Map<string, ModuleResolver>();

export function registerResolver(resolutionType: string, resolver: ModuleResolver) {
  resolvers.set(resolutionType, resolver);
}

export function getResolver(resolutionType: string): ModuleResolver | undefined {
  return resolvers.get(resolutionType);
}

// ============================================
// 内置模块结算器
// ============================================

registerResolver("kill", (ctx) => {
  const target = ctx.targets[0];
  ctx.gameState.isMarkedForDeath.add(target);
  ctx.gameState.lastWolfTarget = target;
  return {
    effectData: { killedTarget: target },
    updatedState: ctx.gameState,
    summary: `狼人选中了目标`,
  };
});

registerResolver("investigate", (ctx) => {
  // 实际阵营由外部注入（通过 params.faction）
  const target = ctx.targets[0];
  const faction = ctx.params?.faction || "unknown";
  ctx.gameState.seerResults.set(target, faction);
  return {
    effectData: { targetId: target, faction },
    updatedState: ctx.gameState,
    summary: `预言家查验结果: ${faction}`,
  };
});

registerResolver("save", (ctx) => {
  if (!ctx.gameState.witchHasSavePotion) {
    return {
      effectData: { saved: false, reason: "no_potion" },
      updatedState: ctx.gameState,
      summary: "女巫解药已使用",
    };
  }
  const wolfTarget = ctx.gameState.lastWolfTarget;
  if (wolfTarget) {
    ctx.gameState.witchSaveTarget = wolfTarget;
    ctx.gameState.witchHasSavePotion = false;
    // 不能直接移除死亡标记，需要在 dawn 阶段根据同守同救规则判定
    return {
      effectData: { savedPlayer: wolfTarget },
      updatedState: ctx.gameState,
      summary: `女巫使用了解药`,
    };
  }
  return {
    effectData: { saved: false, reason: "no_target" },
    updatedState: ctx.gameState,
    summary: "今晚无人死亡，女巫未使用解药",
  };
});

registerResolver("poison", (ctx) => {
  if (!ctx.gameState.witchHasPoisonPotion) {
    return {
      effectData: { poisoned: false, reason: "no_potion" },
      updatedState: ctx.gameState,
      summary: "女巫毒药已使用",
    };
  }
  const target = ctx.targets[0];
  ctx.gameState.witchPoisonTarget = target;
  ctx.gameState.witchHasPoisonPotion = false;
  return {
    effectData: { poisonedPlayer: target },
    updatedState: ctx.gameState,
    summary: `女巫使用了毒药`,
  };
});

registerResolver("guard", (ctx) => {
  const target = ctx.targets[0];
  ctx.gameState.isProtected.add(target);
  ctx.gameState.lastGuardTarget = target;
  return {
    effectData: { protectedPlayer: target },
    updatedState: ctx.gameState,
    summary: `守卫守护了玩家`,
  };
});

registerResolver("shoot", (ctx) => {
  const target = ctx.targets[0];
  if (target) {
    ctx.gameState.isMarkedForDeath.add(target);
  }
  return {
    effectData: { shotPlayer: target || null },
    updatedState: ctx.gameState,
    summary: target ? "猎人开枪带走了目标" : "猎人选择不开枪",
  };
});

registerResolver("swap", (ctx) => {
  const [a, b] = ctx.targets;
  if (a && b) {
    ctx.gameState.swappedPairs.set(a, b);
    ctx.gameState.swappedPairs.set(b, a);
  }
  return {
    effectData: { swappedPlayers: [a, b] },
    updatedState: ctx.gameState,
    summary: "魔术师交换了两名玩家",
  };
});

registerResolver("block", (ctx) => {
  const target = ctx.targets[0];
  ctx.gameState.blockedPlayers.add(target);
  return {
    effectData: { blockedPlayer: target },
    updatedState: ctx.gameState,
    summary: "梦魇催眠了目标",
  };
});

// ============================================
// 天亮结算逻辑
// ============================================
export interface DawnCompileResult {
  deaths: Array<{ playerId: number; causeOfDeath: string }>;
  investigations: Array<{ playerId: number; result: string }>;
}

export function compileDawn(state: NightGameState): DawnCompileResult {
  const deaths: DawnCompileResult["deaths"] = [];
  const investigations: DawnCompileResult["investigations"] = [];

  // 遍历所有被标记死亡的玩家
  for (const playerId of state.isMarkedForDeath) {
    const isWitchPoisoned = state.witchPoisonTarget === playerId;
    const isProtected = state.isProtected.has(playerId);
    const isSaved = state.witchSaveTarget === playerId;
    const isBlocked = state.blockedPlayers.has(playerId);

    if (isWitchPoisoned) {
      // 毒药无视守护，必定死亡
      deaths.push({ playerId, causeOfDeath: "witch_poison" });
      continue;
    }

    // 同守同救判定（奶穿）
    if (isProtected && isSaved) {
      deaths.push({ playerId, causeOfDeath: "guard_witch_conflict" });
      continue;
    }

    // 被守护 + 无解药 → 存活
    if (isProtected && !isSaved) {
      continue;
    }

    // 被刀 + 解药 + 无守护 → 存活
    if (isSaved && !isProtected) {
      continue;
    }

    // 被刀 + 无守护 + 无解药 → 死亡
    deaths.push({ playerId, causeOfDeath: "werewolf" });
  }

  // 如果是被催眠的预言家，移除其查验结果
  for (const [playerId] of state.seerResults) {
    if (state.blockedPlayers.has(playerId)) {
      state.seerResults.delete(playerId);
    }
  }

  // 编译查验结果
  for (const [playerId, result] of state.seerResults) {
    investigations.push({ playerId, result });
  }

  return { deaths, investigations };
}
