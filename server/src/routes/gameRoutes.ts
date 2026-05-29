import { Router } from "express";
import * as gameService from "../services/gameService";
import * as deviceService from "../services/deviceService";
import { AppError } from "../middleware/errorHandler";
import { broadcastToRoom } from "../socket";
import { prisma } from "../utils/prisma";

const router = Router();

// 获取绑定的主持人账号
async function getHostAccountId(fp?: string): Promise<number> {
  if (!fp) throw new AppError(400, "NO_FINGERPRINT", "缺少设备指纹");
  const bindings = await deviceService.getBindings(fp);
  if (bindings.length === 0) throw new AppError(400, "NO_BINDING", "请先绑定一个账号");
  return bindings[0].accountId;
}

// POST /api/rooms/:code/games — 开始新一轮对局
router.post("/rooms/:code/games", async (req, res, next) => {
  try {
    const hostAccountId = await getHostAccountId(req.deviceFingerprint);
    const result = await gameService.createGame(req.params.code, hostAccountId);
    res.json({ ok: true, game: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/games/:gameId — 查询对局详情
router.get("/games/:gameId", async (req, res, next) => {
  try {
    const game = await gameService.getGame(Number(req.params.gameId));
    res.json({ ok: true, game });
  } catch (err) {
    next(err);
  }
});

// GET /api/games/:gameId/state — 获取玩家视角的实时状态（轮询用）
router.get("/games/:gameId/state", async (req, res, next) => {
  try {
    const game = await gameService.getGame(Number(req.params.gameId));
    const room = await prisma.room.findUnique({ where: { id: game.roomId } });
    if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "房间不存在");

    // 获取当前设备绑定的账号
    const bindings = req.deviceFingerprint
      ? await deviceService.getBindings(req.deviceFingerprint)
      : [];
    const accountId = bindings[0]?.accountId;

    // 找到当前玩家的信息
    const myPlayer = accountId ? game.players.find((p) => p.accountId === accountId) : null;
    const isHost = room.hostAccountId === accountId;

    // 检查旧对局：如果游戏已结束且有更新的活跃对局
    let redirectToNewGame: number | null = null;
    if (game.status === "ended" && room.currentGameId && room.currentGameId !== game.id) {
      redirectToNewGame = room.currentGameId;
    }

    res.json({
      ok: true,
      state: {
        gameId: game.id,
        roundNumber: game.roundNumber,
        status: game.status,
        spectatorMode: game.spectatorMode,
        isHost,
        // 玩家身份（仅自己和主持人可见）
        myRole: myPlayer ? {
          roleName: myPlayer.roleName || null,
          roleFaction: myPlayer.roleFaction || null,
          skillDescription: myPlayer.roleId ? (await prisma.roleDefinition.findUnique({ where: { id: myPlayer.roleId } }))?.skillDescription : null,
          isAlive: myPlayer.isAlive,
          hasPreference: myPlayer.hasPreference,
        } : null,
        // 玩家列表：对局结束或观战+主持人时显示身份
        players: game.players.map((p) => ({
          playerId: p.id,
          accountId: p.accountId,
          accountName: p.accountName,
          seatNumber: p.seatNumber,
          isAlive: p.isAlive,
          isHost: p.isHost,
          roleName: (game.status === "ended" || (isHost && game.spectatorMode)) ? p.roleName : (p.accountId === accountId ? p.roleName : null),
          roleFaction: (game.status === "ended" || (isHost && game.spectatorMode)) ? p.roleFaction : (p.accountId === accountId ? p.roleFaction : null),
        })),
        // 角色配置
        roles: game.roles,
        redirectToNewGame,
        roomCode: room.code,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/games/:gameId/start — 开始偏好阶段
router.post("/games/:gameId/start", async (req, res, next) => {
  try {
    const hostAccountId = await getHostAccountId(req.deviceFingerprint);
    const result = await gameService.startPreferencePhase(Number(req.params.gameId), hostAccountId);
    // 广播：游戏进入偏好阶段
    broadcastToRoom(result.roomCode, "game_phase_change", {
      gameId: Number(req.params.gameId),
      phase: "preference",
      message: "身份偏好选择已开始，请提交你的偏好",
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/games/:gameId/end — 结束对局
router.post("/games/:gameId/end", async (req, res, next) => {
  try {
    const hostAccountId = await getHostAccountId(req.deviceFingerprint);
    const game = await gameService.endGame(Number(req.params.gameId), hostAccountId);
    // 获取房间号并广播
    const gameData = await import("../services/gameService").then((s) => s.getGame(Number(req.params.gameId)));
    const room = await import("../services/roomService").then((s) => import("../utils/prisma").then(({ prisma }) =>
      prisma.room.findUnique({ where: { id: gameData.roomId } })
    ));
    if (room) {
      broadcastToRoom(room.code, "game_ended", {
        gameId: Number(req.params.gameId),
        message: "主持人结束了本轮对局",
      });
    }
    res.json(game);
  } catch (err) {
    next(err);
  }
});

// PUT /api/games/:gameId/roles — 配置本局角色
router.put("/games/:gameId/roles", async (req, res, next) => {
  try {
    const hostAccountId = await getHostAccountId(req.deviceFingerprint);
    const { roles } = req.body;
    if (!roles || !Array.isArray(roles)) throw new AppError(400, "MISSING_ROLES", "缺少角色配置");
    const result = await gameService.configureRoles(Number(req.params.gameId), hostAccountId, roles);
    res.json({ ok: true, gameRoles: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/games/:gameId/roles
router.get("/games/:gameId/roles", async (req, res, next) => {
  try {
    const roles = await gameService.getGameRoles(Number(req.params.gameId));
    res.json({ ok: true, gameRoles: roles });
  } catch (err) {
    next(err);
  }
});

// GET /api/games/:gameId/modules
router.get("/games/:gameId/modules", async (req, res, next) => {
  try {
    const modules = await gameService.getGameModules(Number(req.params.gameId));
    res.json({ ok: true, modules });
  } catch (err) {
    next(err);
  }
});

// PUT /api/games/:gameId/modules
router.put("/games/:gameId/modules", async (req, res, next) => {
  try {
    const hostAccountId = await getHostAccountId(req.deviceFingerprint);
    const { modules } = req.body;
    if (!modules || !Array.isArray(modules)) throw new AppError(400, "MISSING_MODULES", "缺少模块配置");
    const result = await gameService.configureModules(Number(req.params.gameId), hostAccountId, modules);
    res.json({ ok: true, modules: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/games/:gameId/modules/init — 初始化本局模块
router.post("/games/:gameId/modules/init", async (req, res, next) => {
  try {
    const modules = await gameService.initializeGameModules(Number(req.params.gameId));
    res.json({ ok: true, modules });
  } catch (err) {
    next(err);
  }
});

// PUT /api/games/:gameId/spectator
router.put("/games/:gameId/spectator", async (req, res, next) => {
  try {
    const hostAccountId = await getHostAccountId(req.deviceFingerprint);
    const { enabled } = req.body;
    const result = await gameService.toggleSpectator(Number(req.params.gameId), hostAccountId, Boolean(enabled));
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

export default router;
