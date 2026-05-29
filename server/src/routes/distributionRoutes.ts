import { Router } from "express";
import * as distributionService from "../services/distributionService";
import * as deviceService from "../services/deviceService";
import { AppError } from "../middleware/errorHandler";
import { broadcastToRoom, broadcastIdentity } from "../socket";
import { prisma } from "../utils/prisma";

const router = Router();

// 缓存最近的分配结果 (gameId → assignments)
const lastDistribution = new Map<number, any[]>();

async function getHostId(fp?: string): Promise<number> {
  if (!fp) throw new AppError(403, "NO_AUTH", "缺少设备指纹");
  const bindings = await deviceService.getBindings(fp);
  if (bindings.length === 0) throw new AppError(403, "NO_BINDING", "未绑定账号");
  return bindings[0].accountId;
}

// POST /api/games/:gameId/preferences — 提交偏好
router.post("/games/:gameId/preferences", async (req, res, next) => {
  try {
    const { gamePlayerId, preferredRoleIds } = req.body;
    if (!gamePlayerId) throw new AppError(400, "MISSING_GAME_PLAYER_ID", "缺少玩家ID");
    const result = await distributionService.submitPreference(
      Number(gamePlayerId),
      preferredRoleIds || []
    );
    // 广播偏好更新到对局房间
    import("../utils/prisma").then(({ prisma }) =>
      prisma.gamePlayer.findUnique({ where: { id: Number(gamePlayerId) }, include: { game: { include: { room: true } } } })
    ).then((player) => {
      if (player) {
        broadcastToRoom(player.game.room.code, "preference_updated", {
          gameId: Number(req.params.gameId),
          playerId: Number(gamePlayerId),
          submitted: true,
        });
      }
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/games/:gameId/preferences — 查看偏好状态
router.get("/games/:gameId/preferences", async (_req, res, next) => {
  try {
    const statuses = await distributionService.getPreferenceStatus(Number(_req.params.gameId));
    res.json({ ok: true, statuses });
  } catch (err) {
    next(err);
  }
});

// POST /api/games/:gameId/distribute — 执行分配（仅主持人）
router.post("/games/:gameId/distribute", async (req, res, next) => {
  try {
    const hostId = await getHostId(req.deviceFingerprint);
    const game = await prisma.game.findUnique({ where: { id: Number(req.params.gameId) } });
    if (!game || game.hostAccountId !== hostId) throw new AppError(403, "NOT_HOST", "仅主持人可分配");
    const result = await distributionService.distributeRoles(Number(req.params.gameId));
    // 缓存分配结果，供 approve 验证
    lastDistribution.set(Number(req.params.gameId), result.assignments);
    res.json({ ok: true, ...result });
  } catch (err) { next(err); }
});

// POST /api/games/:gameId/distribute/approve — 确认分配（仅主持人）
router.post("/games/:gameId/distribute/approve", async (req, res, next) => {
  try {
    const hostId = await getHostId(req.deviceFingerprint);
    const game = await prisma.game.findUnique({ where: { id: Number(req.params.gameId) } });
    if (!game || game.hostAccountId !== hostId) throw new AppError(403, "NOT_HOST", "仅主持人可确认分配");

    // 使用最近一次缓存的服务端分配结果，不接受客户端数据
    const serverAssignments = lastDistribution.get(Number(req.params.gameId));
    if (!serverAssignments) throw new AppError(400, "NO_DISTRIBUTION", "请先执行分配");

    const result = await distributionService.approveDistribution(
      Number(req.params.gameId),
      serverAssignments
    );
    lastDistribution.delete(Number(req.params.gameId));

    if (result.identities) {
      for (const ident of result.identities) {
        if (ident.accountId) {
          broadcastIdentity(Number(req.params.gameId), ident.accountId, {
            roleId: ident.playerId, roleName: ident.roleName, roleKey: ident.roleKey, faction: ident.faction,
          });
        }
      }
      broadcastToRoom(result.roomCode, "game_phase_change", { gameId: Number(req.params.gameId), phase: "playing", message: "身份已分配" });
    }
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
