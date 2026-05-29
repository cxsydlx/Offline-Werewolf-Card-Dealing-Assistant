import { Router } from "express";
import * as roomService from "../services/roomService";
import { AppError } from "../middleware/errorHandler";
import { prisma } from "../utils/prisma";

const router = Router();

// GET /api/room/:code/state — 统一状态接口（所有渲染数据）
router.get("/:code/state", async (req, res, next) => {
  try {
    const code = req.params.code;
    const room = await prisma.room.findUnique({
      where: { code },
      include: {
        host: { include: { nickname: true } },
        players: { include: { account: { include: { nickname: true } } } },
        games: { orderBy: { roundNumber: "desc" }, take: 10 },
      },
    });
    if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "房间不存在");

    // 当前用户
    const binding = req.deviceFingerprint
      ? await prisma.deviceBinding.findUnique({ where: { deviceFingerprint: req.deviceFingerprint } })
      : null;
    const accountId = binding?.accountId || null;
    const isHost = accountId === room.hostAccountId;
    const isMember = accountId ? room.players.some((p) => p.accountId === accountId) : false;

    // 基础房间数据
    const roomData = {
      code: room.code,
      status: room.status,
      hostName: room.host.nickname?.nickname || room.host.name,
      hostPlays: room.hostPlays,
      players: room.players.map((p) => ({
        accountId: p.accountId,
        name: p.account.nickname?.nickname || p.account.name,
        isHost: p.isHost,
      })),
      history: room.games.map((g) => ({ id: g.id, roundNumber: g.roundNumber, status: g.status })),
    };

    // 无活跃对局 → lobby
    const gameId = room.currentGameId;
    if (!gameId) {
      let joinRequests: any[] = [];
      if (isHost) {
        const jrs = await prisma.roomJoinRequest.findMany({
          where: { roomId: room.id, status: "pending" },
          include: { account: { include: { nickname: true } } },
          orderBy: { createdAt: "asc" },
        });
        joinRequests = jrs.map((jr) => ({
          id: jr.id,
          accountId: jr.accountId,
          accountName: jr.account.nickname?.nickname || jr.account.name,
          createdAt: jr.createdAt.toISOString(),
        }));
      }
      return res.json({ ok: true, view: "lobby", room: roomData, isHost, isMember, accountId, joinRequests });
    }

    // 获取对局数据
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          include: { account: { include: { nickname: true } }, role: true, preferences: true },
        },
        roles: { include: { role: true } },
      },
    });
    if (!game) {
      return res.json({ ok: true, view: "lobby", room: roomData, isHost, isMember, accountId });
    }

    // 我的身份
    const myPlayer = accountId ? game.players.find((p) => p.accountId === accountId) : null;
    const myRoleDef = myPlayer?.roleId
      ? await prisma.roleDefinition.findUnique({ where: { id: myPlayer.roleId } })
      : null;

    const gameData = {
      id: game.id,
      roundNumber: game.roundNumber,
      status: game.status,
      spectatorMode: game.spectatorMode,
      players: game.players.map((p) => ({
        playerId: p.id, accountId: p.accountId,
        name: p.account.nickname?.nickname || p.account.name,
        seatNumber: p.seatNumber, isAlive: p.isAlive,
        isHost: p.isHost,
        roleName: (game.status === "ended" || (isHost && game.spectatorMode)) ? p.role?.name : (p.accountId === accountId ? p.role?.name : null),
        roleFaction: (game.status === "ended" || (isHost && game.spectatorMode)) ? p.role?.faction : (p.accountId === accountId ? p.role?.faction : null),
      })),
      roles: game.roles.map((r) => ({
        roleId: r.roleId, roleName: r.role.name, roleKey: r.role.key,
        faction: r.role.faction, count: r.count,
        skillDescription: r.role.skillDescription,
      })),
      myRole: myPlayer && myRoleDef ? {
        roleName: myRoleDef.name,
        skillDescription: myRoleDef.skillDescription,
        hasPreference: myPlayer.preferences.length > 0,
      } : null,
    };

    // 偏好状态
    let preferences: any[] = [];
    if (game.status === "preference" || (isHost && game.status === "setup")) {
      preferences = game.players.map((p) => ({
        playerId: p.id, accountName: p.account.nickname?.nickname || p.account.name,
        hasPreference: p.preferences.length > 0,
      }));
    }

    // 决定 view
    let view = "lobby";
    if (game.status === "setup") {
      view = isHost ? "host_setup" : "lobby";
    } else if (game.status === "preference") {
      if (isHost) {
        view = "host_distribution";
      } else if (myPlayer && myPlayer.preferences.length > 0) {
        view = "waiting_distribution";
      } else {
        view = "player_preferences";
      }
    } else if (game.status === "playing") {
      view = "playing";
    } else if (game.status === "ended") {
      view = "ended";
    }

    res.json({
      ok: true,
      view, accountId, isHost, isMember,
      room: roomData,
      game: gameData,
      preferences,
    });
  } catch (err) { next(err); }
});

// 其他路由保持不变
router.post("/", async (req, res, next) => {
  try {
    const { participantAccountIds, hostAccountId, hostPlays, debug } = req.body;
    if (!participantAccountIds || !Array.isArray(participantAccountIds)) throw new AppError(400, "MISSING_PARTICIPANTS", "缺少参赛者列表");
    let finalHostId = hostAccountId;
    if (!finalHostId) {
      const bindings = req.deviceFingerprint
        ? await import("../services/deviceService").then((s) => s.getBindings(req.deviceFingerprint!))
        : [];
      if (bindings.length > 0) finalHostId = bindings[0].accountId;
    }
    if (!finalHostId) throw new AppError(400, "NO_BINDING", "请先绑定账号");
    const result = await roomService.createRoom(Number(finalHostId), participantAccountIds, hostPlays !== false, !!debug);
    res.json({ ok: true, room: result });
  } catch (err) { next(err); }
});

router.get("/search", async (_req, res, next) => {
  try { res.json({ ok: true, rooms: await roomService.searchRooms() }); } catch (err) { next(err); }
});

router.get("/my/list", async (req, res, next) => {
  try {
    const bindings = req.deviceFingerprint
      ? await import("../services/deviceService").then((s) => s.getBindings(req.deviceFingerprint!))
      : [];
    if (bindings.length === 0) return res.json({ ok: true, rooms: [] });
    const rooms = await roomService.getMyRooms(bindings[0].accountId);
    res.json({ ok: true, rooms });
  } catch (err) { next(err); }
});

router.get("/:code", async (req, res, next) => {
  try { res.json({ ok: true, room: await roomService.getRoom(req.params.code) }); } catch (err) { next(err); }
});

router.post("/:code/join", async (req, res, next) => {
  try {
    const { accountId } = req.body;
    if (!accountId) throw new AppError(400, "MISSING_ACCOUNT_ID", "缺少账号ID");
    res.json(await roomService.joinRoom(req.params.code, Number(accountId)));
  } catch (err) { next(err); }
});

router.post("/:code/leave", async (req, res, next) => {
  try {
    const { accountId } = req.body;
    if (!accountId) throw new AppError(400, "MISSING_ACCOUNT_ID", "缺少账号ID");
    res.json(await roomService.leaveRoom(req.params.code, Number(accountId)));
  } catch (err) { next(err); }
});

router.post("/:code/close", async (req, res, next) => {
  try {
    const bindings = req.deviceFingerprint
      ? await import("../services/deviceService").then((s) => s.getBindings(req.deviceFingerprint!))
      : [];
    if (bindings.length === 0) throw new AppError(400, "NO_BINDING", "请先绑定账号");
    res.json(await roomService.closeRoom(req.params.code, bindings[0].accountId));
  } catch (err) { next(err); }
});

router.post("/:code/kick", async (req, res, next) => {
  try {
    const { targetAccountId } = req.body;
    if (!targetAccountId) throw new AppError(400, "MISSING_TARGET", "缺少目标玩家");
    const bindings = req.deviceFingerprint
      ? await import("../services/deviceService").then((s) => s.getBindings(req.deviceFingerprint!))
      : [];
    res.json(await roomService.kickPlayer(req.params.code, bindings[0]?.accountId, Number(targetAccountId)));
  } catch (err) { next(err); }
});

router.get("/:code/history", async (req, res, next) => {
  try { res.json({ ok: true, games: await roomService.getRoomHistory(req.params.code) }); } catch (err) { next(err); }
});

// ── 加入申请 ──

async function getAccountId(fp?: string): Promise<number | null> {
  if (!fp) return null;
  const bindings = await import("../services/deviceService").then((s) => s.getBindings(fp));
  return bindings[0]?.accountId || null;
}

// POST /api/rooms/:code/apply — 申请加入房间
router.post("/:code/apply", async (req, res, next) => {
  try {
    const accountId = await getAccountId(req.deviceFingerprint);
    if (!accountId) throw new AppError(400, "NO_BINDING", "请先绑定账号");
    const request = await prisma.roomJoinRequest.upsert({
      where: { roomId_accountId: { roomId: (await prisma.room.findUniqueOrThrow({ where: { code: req.params.code } })).id, accountId } },
      update: { status: "pending", createdAt: new Date() },
      create: { roomId: (await prisma.room.findUniqueOrThrow({ where: { code: req.params.code } })).id, accountId },
    });
    res.json({ ok: true, request });
  } catch (err) { next(err); }
});

// GET /api/rooms/:code/requests — 主持人查看待审批申请
router.get("/:code/requests", async (req, res, next) => {
  try {
    const accountId = await getAccountId(req.deviceFingerprint);
    if (!accountId) throw new AppError(400, "NO_BINDING", "请先绑定账号");
    const room = await prisma.room.findUnique({ where: { code: req.params.code } });
    if (!room || room.hostAccountId !== accountId) throw new AppError(403, "NOT_HOST", "仅主持人可查看");
    const requests = await prisma.roomJoinRequest.findMany({
      where: { roomId: room.id, status: "pending" },
      include: { account: { include: { nickname: true } } },
      orderBy: { createdAt: "asc" },
    });
    res.json({ ok: true, requests });
  } catch (err) { next(err); }
});

// POST /api/rooms/:code/requests/:id/approve — 主持人同意
router.post("/:code/requests/:id/approve", async (req, res, next) => {
  try {
    const accountId = await getAccountId(req.deviceFingerprint);
    if (!accountId) throw new AppError(400, "NO_BINDING", "请先绑定账号");
    const room = await prisma.room.findUnique({ where: { code: req.params.code } });
    if (!room || room.hostAccountId !== accountId) throw new AppError(403, "NOT_HOST", "仅主持人可审批");
    const jr = await prisma.roomJoinRequest.findUnique({ where: { id: Number(req.params.id) } });
    if (!jr || jr.roomId !== room.id) throw new AppError(404, "NOT_FOUND", "申请不存在");
    // 批准：加入房间
    const exists = await prisma.roomPlayer.findFirst({
      where: { roomId: room.id, accountId: jr.accountId },
    });
    await prisma.$transaction([
      prisma.roomJoinRequest.update({ where: { id: jr.id }, data: { status: "approved" } }),
      ...(exists ? [] : [prisma.roomPlayer.create({ data: { roomId: room.id, accountId: jr.accountId } })]),
    ]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/rooms/:code/requests/:id/reject — 主持人拒绝
router.post("/:code/requests/:id/reject", async (req, res, next) => {
  try {
    const accountId = await getAccountId(req.deviceFingerprint);
    if (!accountId) throw new AppError(400, "NO_BINDING", "请先绑定账号");
    const room = await prisma.room.findUnique({ where: { code: req.params.code } });
    if (!room || room.hostAccountId !== accountId) throw new AppError(403, "NOT_HOST", "仅主持人可审批");
    const jr = await prisma.roomJoinRequest.findUnique({ where: { id: Number(req.params.id) } });
    if (!jr || jr.roomId !== room.id) throw new AppError(404, "NOT_FOUND", "申请不存在");
    await prisma.roomJoinRequest.update({ where: { id: jr.id }, data: { status: "rejected" } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/rooms/:code/my-request — 玩家查看自己的申请状态
router.get("/:code/my-request", async (req, res, next) => {
  try {
    const accountId = await getAccountId(req.deviceFingerprint);
    if (!accountId) return res.json({ ok: true, request: null });
    const room = await prisma.room.findUnique({ where: { code: req.params.code } });
    if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "房间不存在");
    const jr = await prisma.roomJoinRequest.findUnique({
      where: { roomId_accountId: { roomId: room.id, accountId } },
    });
    res.json({ ok: true, request: jr });
  } catch (err) { next(err); }
});

// POST /api/rooms/dev/reset — 开发模式重置所有数据
router.post("/dev/reset", async (_req, res, next) => {
  try {
    const tables = ["NightActionTarget","NightAction","DawnResult","NightRound","IdentityPreference","GameModule","GameRole","GamePlayer","GameLog","PlayerNote","Game","RoomJoinRequest","RoomPlayer","Room","DeviceBinding","Nickname"];
    for (const t of tables) await prisma.$executeRawUnsafe(`DELETE FROM \`${t}\``);
    await prisma.account.deleteMany({ where: { isFixed: false } });
    res.json({ ok: true, message: "已重置" });
  } catch (err) { next(err); }
});

export default router;
