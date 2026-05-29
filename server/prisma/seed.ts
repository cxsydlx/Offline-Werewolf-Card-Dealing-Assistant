import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ========================================
  // 12 个固定账号
  // ========================================
  const fixedNames = [
    "陶维维",
    "Mk",
    "王建涛",
    "卢博恩",
    "巫",
    "郭伟峰",
    "石",
    "张光耀",
    "樊",
    "肖",
    "佟",
    "王玉先",
  ];

  console.log("📝 创建固定账号...");
  for (const name of fixedNames) {
    await prisma.account.upsert({
      where: { name },
      update: { isFixed: true },
      create: { name, isFixed: true },
    });
  }

  // ========================================
  // 角色定义
  // ========================================
  const roles = [
    {
      key: "werewolf",
      name: "狼人",
      faction: "werewolf",
      description: "每晚可以杀死一名玩家",
      skillDescription: "每晚与同伴商议，选择一名玩家杀死",
      sortOrder: 1,
    },
    {
      key: "villager",
      name: "村民",
      faction: "villager",
      description: "没有特殊技能，通过投票找出狼人",
      skillDescription: "通过分析和投票找出隐藏在人群中的狼人",
      sortOrder: 2,
    },
    {
      key: "seer",
      name: "预言家",
      faction: "villager",
      description: "每晚可以查验一名玩家的身份阵营",
      skillDescription: "每晚选择一名玩家，查验其属于狼人阵营还是好人阵营",
      sortOrder: 3,
    },
    {
      key: "witch",
      name: "女巫",
      faction: "villager",
      description: "拥有一瓶解药和一瓶毒药，各可用一次",
      skillDescription: "解药可救活当夜被狼人杀死的玩家；毒药可毒杀一名玩家",
      sortOrder: 4,
    },
    {
      key: "hunter",
      name: "猎人",
      faction: "villager",
      description: "死亡时可以开枪带走一名玩家",
      skillDescription: "被投票放逐或被狼人杀死时，可以选择一名玩家带走（被女巫毒杀则不能开枪）",
      sortOrder: 5,
    },
    {
      key: "fool",
      name: "白痴",
      faction: "villager",
      description: "被投票放逐时可以翻牌免死",
      skillDescription: "被投票放逐时翻牌亮明身份，免于被放逐，但此后失去投票权",
      sortOrder: 6,
    },
    {
      key: "guard",
      name: "守卫",
      faction: "villager",
      description: "每晚可以守护一名玩家使其不被狼人杀死",
      skillDescription: "每晚守护一名玩家，该玩家当夜不会被狼人杀死。不能连续两晚守护同一人。若与女巫解药同守一人，该玩家死亡",
      sortOrder: 7,
    },
    {
      key: "knight",
      name: "骑士",
      faction: "villager",
      description: "白天可以选择一名玩家进行决斗",
      skillDescription: "在白天发言阶段可以选择一名玩家进行决斗。若对方是狼人，对方死亡；若对方是好人，自己死亡",
      sortOrder: 8,
    },
    {
      key: "magician",
      name: "魔术师",
      faction: "villager",
      description: "每晚可以交换两名玩家的号码",
      skillDescription: "每晚交换两名玩家的号码，当晚作用于这些玩家的技能目标也会随之交换",
      sortOrder: 9,
    },
    {
      key: "dreamweaver",
      name: "梦魇",
      faction: "werewolf",
      description: "每晚可以催眠一名玩家使其技能失效",
      skillDescription: "每晚选择一名玩家，该玩家当夜的技能使用无效",
      sortOrder: 10,
    },
    {
      key: "wolf_king",
      name: "狼王",
      faction: "werewolf",
      description: "白天被投票放逐时可以开枪带走一名玩家",
      skillDescription: "被投票放逐时可以选择一名玩家带走。被女巫毒杀或自刀则不能开枪",
      sortOrder: 11,
    },
    {
      key: "cupid",
      name: "爱神",
      faction: "neutral",
      description: "开局时选择两名玩家成为情侣，情侣同生共死",
      skillDescription: "第一晚选择两名玩家成为情侣（可为任意阵营）。情侣中任一人出局，另一人同时出局。若情侣活到最后，爱神与情侣共同获胜",
      sortOrder: 12,
    },
    {
      key: "fox",
      name: "咒狐",
      faction: "neutral",
      description: "免疫夜间狼人杀害，存活到最后独自获胜",
      skillDescription: "免疫狼人夜间杀害（仍可被投票放逐、毒杀等）。若存活至游戏结束，咒狐独自获胜，其他所有阵营失败",
      sortOrder: 13,
    },
    {
      key: "piper",
      name: "吹笛者",
      faction: "neutral",
      description: "每晚魅惑一名玩家，当所有存活玩家都被魅惑时独自获胜",
      skillDescription: "每晚选择一名玩家魅惑。被魅惑的玩家不知道自己被魅惑。当所有存活玩家都处于被魅惑状态时，吹笛者独自获胜",
      sortOrder: 14,
    },
  ];

  console.log("📝 创建角色定义...");
  for (const role of roles) {
    await prisma.roleDefinition.upsert({
      where: { key: role.key },
      update: role,
      create: role,
    });
  }

  // ========================================
  // 模块定义
  // ========================================
  const modules = [
    {
      key: "werewolf_kill",
      roleKey: "werewolf",
      name: "狼人杀人",
      description: "狼人选择一名玩家作为杀害目标",
      triggerOrder: 2,
      targetSelectionType: "single",
      minTargets: 1,
      maxTargets: 1,
      allowSkip: false,
      resolutionType: "kill",
      defaultParams: { cannotTargetWerewolves: true },
      enabledByDefault: true,
    },
    {
      key: "seer_investigate",
      roleKey: "seer",
      name: "预言家查验",
      description: "预言家选择一名玩家查验身份阵营",
      triggerOrder: 3,
      targetSelectionType: "single",
      minTargets: 1,
      maxTargets: 1,
      allowSkip: true,
      resolutionType: "investigate",
      defaultParams: { returnsFaction: true },
      enabledByDefault: true,
    },
    {
      key: "witch_save",
      roleKey: "witch",
      name: "女巫解药",
      description: "女巫使用解药，救活被狼人杀死的玩家",
      triggerOrder: 4,
      targetSelectionType: "none",
      minTargets: 0,
      maxTargets: 0,
      allowSkip: true,
      resolutionType: "save",
      defaultParams: { oneTimeUse: true, conflictWithGuardKills: true },
      enabledByDefault: true,
    },
    {
      key: "witch_poison",
      roleKey: "witch",
      name: "女巫毒药",
      description: "女巫使用毒药，毒杀一名玩家",
      triggerOrder: 5,
      targetSelectionType: "single",
      minTargets: 1,
      maxTargets: 1,
      allowSkip: true,
      resolutionType: "poison",
      defaultParams: { oneTimeUse: true, ignoresProtection: true },
      enabledByDefault: true,
    },
    {
      key: "guard_protect",
      roleKey: "guard",
      name: "守卫守护",
      description: "守卫选择一名玩家进行守护",
      triggerOrder: 1,
      targetSelectionType: "single",
      minTargets: 1,
      maxTargets: 1,
      allowSkip: true,
      resolutionType: "guard",
      defaultParams: { noConsecutiveSame: true, conflictWithWitchSaveKills: true },
      enabledByDefault: true,
    },
    {
      key: "hunter_shoot",
      roleKey: "hunter",
      name: "猎人开枪",
      description: "猎人死亡时可选择一名玩家开枪",
      triggerOrder: 7,
      targetSelectionType: "single",
      minTargets: 1,
      maxTargets: 1,
      allowSkip: true,
      resolutionType: "shoot",
      defaultParams: { triggersOnDeath: true, disabledByPoison: true },
      enabledByDefault: true,
    },
    {
      key: "knight_duel",
      roleKey: "knight",
      name: "骑士决斗",
      description: "骑士选择一名玩家进行决斗",
      triggerOrder: 6,
      targetSelectionType: "single",
      minTargets: 1,
      maxTargets: 1,
      allowSkip: false,
      resolutionType: "duel",
      defaultParams: { daytimeOnly: true },
      enabledByDefault: true,
    },
    {
      key: "magician_swap",
      roleKey: "magician",
      name: "魔术师交换",
      description: "魔术师交换两名玩家的号码",
      triggerOrder: 1,
      targetSelectionType: "multiple",
      minTargets: 2,
      maxTargets: 2,
      allowSkip: true,
      resolutionType: "swap",
      defaultParams: { swapTargets: true },
      enabledByDefault: true,
    },
    {
      key: "dreamweaver_dream",
      roleKey: "dreamweaver",
      name: "梦魇催眠",
      description: "梦魇催眠一名玩家使其当夜技能失效",
      triggerOrder: 1,
      targetSelectionType: "single",
      minTargets: 1,
      maxTargets: 1,
      allowSkip: true,
      resolutionType: "block",
      defaultParams: { blocksSkillForOneNight: true },
      enabledByDefault: true,
    },
    {
      key: "wolf_king_shoot",
      roleKey: "wolf_king",
      name: "狼王开枪",
      description: "狼王被放逐时可选择一名玩家带走",
      triggerOrder: 8,
      targetSelectionType: "single",
      minTargets: 1,
      maxTargets: 1,
      allowSkip: true,
      resolutionType: "shoot",
      defaultParams: { triggersOnVoteDeath: true, disabledByPoison: true },
      enabledByDefault: true,
    },
  ];

  console.log("📝 创建模块定义...");
  for (const mod of modules) {
    const role = await prisma.roleDefinition.findUnique({ where: { key: mod.roleKey } });
    if (!role) {
      console.error(`角色 key=${mod.roleKey} 未找到，跳过模块 ${mod.key}`);
      continue;
    }
    const { roleKey, ...modData } = mod;
    await prisma.moduleDefinition.upsert({
      where: { key: mod.key },
      update: { ...modData, roleDefinitionId: role.id },
      create: { ...modData, roleDefinitionId: role.id },
    });
  }

  // ========================================
  // 预设版型
  // ========================================
  console.log("📝 创建预设版型...");

  const presets = [
    {
      name: "标准6人局",
      roles: [
        { key: "werewolf", count: 2 },
        { key: "seer", count: 1 },
        { key: "witch", count: 1 },
        { key: "villager", count: 2 },
      ],
    },
    {
      name: "标准9人局",
      roles: [
        { key: "werewolf", count: 3 },
        { key: "seer", count: 1 },
        { key: "witch", count: 1 },
        { key: "hunter", count: 1 },
        { key: "villager", count: 3 },
      ],
    },
    {
      name: "标准12人局",
      roles: [
        { key: "werewolf", count: 4 },
        { key: "seer", count: 1 },
        { key: "witch", count: 1 },
        { key: "hunter", count: 1 },
        { key: "guard", count: 1 },
        { key: "villager", count: 4 },
      ],
    },
    {
      name: "12人花板子",
      roles: [
        { key: "werewolf", count: 3 },
        { key: "wolf_king", count: 1 },
        { key: "seer", count: 1 },
        { key: "witch", count: 1 },
        { key: "hunter", count: 1 },
        { key: "guard", count: 1 },
        { key: "magician", count: 1 },
        { key: "villager", count: 3 },
      ],
    },
    {
      name: "12人中立局",
      roles: [
        { key: "werewolf", count: 3 },
        { key: "wolf_king", count: 1 },
        { key: "seer", count: 1 },
        { key: "witch", count: 1 },
        { key: "hunter", count: 1 },
        { key: "cupid", count: 1 },
        { key: "fox", count: 1 },
        { key: "villager", count: 3 },
      ],
    },
  ];

  for (const preset of presets) {
    // Use host account (陶维维, id=1) as preset creator
    const hostAccount = await prisma.account.findUnique({ where: { name: "陶维维" } });
    if (!hostAccount) continue;

    const created = await prisma.rolePreset.create({
      data: {
        name: preset.name,
        createdBy: hostAccount.id,
        items: {
          create: await Promise.all(
            preset.roles.map(async (r) => {
              const role = await prisma.roleDefinition.findUnique({ where: { key: r.key } });
              return { roleId: role!.id, count: r.count };
            })
          ),
        },
      },
    });
    console.log(`  预设已创建: ${created.name}`);
  }

  console.log("✅ 种子数据写入完成！");
}

main()
  .catch((e) => {
    console.error("❌ 种子数据写入失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
