import { Server, Socket } from "socket.io";
import { prisma } from "../utils/prisma";

const nightStates = new Map<number, any>();
export function getNightState(nightRoundId: number) { return nightStates.get(nightRoundId); }
export function setNightState(nightRoundId: number, state: any) { nightStates.set(nightRoundId, state); }
export function deleteNightState(nightRoundId: number) { nightStates.delete(nightRoundId); }

// 全局 io 引用
let _io: Server;
export function getIO() { return _io; }

export function setupSocketHandlers(io: Server) {
  _io = io;

  io.on("connection", (socket: Socket) => {
    const deviceFingerprint = socket.handshake.auth?.deviceFingerprint;

    socket.on("join_room", async (data: { roomCode: string; accountId?: number }) => {
      try {
        const room = await prisma.room.findUnique({
          where: { code: data.roomCode },
          include: { players: true },
        });
        if (!room) { socket.emit("error", { message: "房间不存在" }); return; }

        // 验证设备绑定的账号是否在房间中
        const binding = deviceFingerprint
          ? await prisma.deviceBinding.findUnique({ where: { deviceFingerprint } })
          : null;
        const accountId = data.accountId || binding?.accountId;
        if (accountId) {
          const isMember = room.players.some((p) => p.accountId === accountId);
          if (!isMember) { socket.emit("error", { message: "您不在本房间中" }); return; }
          registerAccountSocket(accountId, socket.id);
        }

        socket.join(`room:${data.roomCode}`);
        socket.emit("room_joined", { roomCode: data.roomCode });
      } catch (err) {
        socket.emit("error", { message: "加入房间失败" });
      }
    });

    socket.on("join_game", async (data: { gameId: number; accountId?: number }) => {
      const game = await prisma.game.findUnique({
        where: { id: data.gameId },
        include: { players: true },
      });
      if (!game) { socket.emit("error", { message: "对局不存在" }); return; }

      const binding = deviceFingerprint
        ? await prisma.deviceBinding.findUnique({ where: { deviceFingerprint } })
        : null;
      const accountId = data.accountId || binding?.accountId;
      if (accountId) {
        const isPlayer = game.players.some((p) => p.accountId === accountId);
        const isHost = game.hostAccountId === accountId;
        if (!isPlayer && !isHost) { socket.emit("error", { message: "您不在本对局中" }); return; }
        registerAccountSocket(accountId, socket.id);
      }

      socket.join(`game:${data.gameId}`);
    });

    socket.on("leave_room", (data: { roomCode: string }) => {
      socket.leave(`room:${data.roomCode}`);
    });

    socket.on("request_sync", async (data: { roomCode?: string; gameId?: number }) => {
      try {
        if (data.roomCode) {
          const room = await prisma.room.findUnique({
            where: { code: data.roomCode },
            include: { players: { include: { account: { include: { nickname: true } } } } },
          });
          if (room) {
            socket.emit("room_state_update", {
              roomCode: room.code,
              status: room.status,
              currentGameId: room.currentGameId,
              players: room.players.map((p) => ({
                accountId: p.accountId,
                accountName: p.account.name,
                nickname: p.account.nickname?.nickname || null,
                isHost: p.isHost,
              })),
            });
          }
        }
      } catch (err) {}
    });

    socket.on("disconnect", () => {});
  });
}

// ============================================
// 广播辅助
// ============================================
export function broadcastToRoom(roomCode: string, event: string, data: any) {
  if (_io) _io.to(`room:${roomCode}`).emit(event, data);
}

export function broadcastToGame(gameId: number, event: string, data: any) {
  if (_io) _io.to(`game:${gameId}`).emit(event, data);
}

// 存储 accountId → socketId 映射
const accountSockets = new Map<number, string>();

export function registerAccountSocket(accountId: number, socketId: string) {
  accountSockets.set(accountId, socketId);
}
export function unregisterAccountSocket(accountId: number) {
  accountSockets.delete(accountId);
}

// 定向发送身份 — 仅发给指定玩家
export function broadcastIdentity(gameId: number, accountId: number, identity: any) {
  if (!_io) return;
  const socketId = accountSockets.get(accountId);
  if (socketId) {
    _io.to(socketId).emit("identity_assigned", { accountId, ...identity });
  }
}
