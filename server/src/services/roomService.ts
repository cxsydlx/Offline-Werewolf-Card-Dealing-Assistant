import { prisma } from "../utils/prisma";
import { AppError } from "../middleware/errorHandler";
import { generateGameCode } from "../utils/gameCode";
import type { RoomInfo, RoomPlayerInfo, GameSummary } from "../types";

export async function createRoom(
  hostAccountId: number,
  participantAccountIds: number[],
  hostPlays: boolean = true,
  debug: boolean = false
) {
  const totalPlaying = participantAccountIds.length + (hostPlays ? 1 : 0);
  const minPlayers = debug ? 2 : 6;
  if (totalPlaying < minPlayers || totalPlaying > 12) {
    throw new AppError(400, "INVALID_PLAYER_COUNT", `游戏人数必须在${minPlayers}到12人之间`);
  }

  // 验证所有账号存在
  const allIds = [...participantAccountIds, hostAccountId];
  const uniqueIds = [...new Set(allIds)];
  const accounts = await prisma.account.findMany({ where: { id: { in: uniqueIds } } });
  if (accounts.length !== uniqueIds.length) {
    throw new AppError(400, "ACCOUNT_NOT_FOUND", "部分账号不存在");
  }

  // 验证所有参与者都不在其他活跃房间中
  const activePlayers = await prisma.roomPlayer.findMany({
    where: { accountId: { in: allIds }, room: { status: { not: "closed" } } },
  });
  if (activePlayers.length > 0) {
    const names = activePlayers.map((p) => accounts.find((a) => a.id === p.accountId)?.name || `ID=${p.accountId}`);
    throw new AppError(409, "PLAYERS_IN_GAME", `以下玩家已在其他房间中: ${names.join(", ")}`);
  }

  let code = generateGameCode();
  let attempts = 0;
  while (await prisma.room.findUnique({ where: { code } })) {
    code = generateGameCode();
    if (++attempts > 10) throw new AppError(500, "CODE_GEN_FAILED", "生成房间号失败");
  }

  // 主持人始终在房间成员中
  const allPlayers = [...participantAccountIds, hostAccountId];

  const room = await prisma.room.create({
    data: {
      code,
      hostAccountId,
      status: "waiting",
      hostPlays,
      players: {
        create: allPlayers.map((accountId) => ({
          accountId,
          isHost: accountId === hostAccountId,
        })),
      },
    },
    include: { players: { include: { account: { include: { nickname: true } } } } },
  });

  return formatRoomInfo(room);
}

export async function getRoom(code: string): Promise<RoomInfo> {
  const room = await prisma.room.findUnique({
    where: { code },
    include: {
      players: { include: { account: { include: { nickname: true } } } },
      games: { orderBy: { roundNumber: "asc" } },
    },
  });
  if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "房间不存在");

  return formatRoomInfo(room);
}

export async function joinRoom(code: string, accountId: number) {
  const room = await prisma.room.findUnique({
    where: { code },
    include: { players: true },
  });
  if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "房间不存在");
  if (room.status === "closed") throw new AppError(400, "ROOM_CLOSED", "房间已关闭");

  // 检查是否为房间成员
  const existingPlayer = room.players.find((p) => p.accountId === accountId);
  if (!existingPlayer) {
    throw new AppError(403, "NOT_INVITED", "您不在本房间的参赛名单中");
  }

  return { ok: true, roomCode: code, accountId };
}

export async function leaveRoom(code: string, accountId: number) {
  const room = await prisma.room.findUnique({
    where: { code },
    include: { players: true },
  });
  if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "房间不存在");

  const player = room.players.find((p) => p.accountId === accountId);
  if (!player) throw new AppError(403, "NOT_IN_ROOM", "您不在本房间中");

  // 主持人不能离开，必须先转移主持权或关闭房间
  if (player.isHost && room.status !== "closed") {
    throw new AppError(403, "HOST_CANNOT_LEAVE", "主持人不能离开房间，请先关闭房间或转移主持人");
  }

  // 如果是当前活跃对局的玩家，清除其在游戏中的状态
  if (room.currentGameId) {
    await prisma.gamePlayer.deleteMany({
      where: { gameId: room.currentGameId, accountId, isHost: false },
    });
  }

  // 从房间成员中移除
  await prisma.roomPlayer.deleteMany({
    where: { roomId: room.id, accountId },
  });

  return { ok: true };
}

export async function closeRoom(code: string, hostAccountId: number) {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "房间不存在");
  if (room.hostAccountId !== hostAccountId) {
    throw new AppError(403, "NOT_HOST", "只有主持人可以关闭房间");
  }

  await prisma.room.update({
    where: { id: room.id },
    data: { status: "closed", closedAt: new Date() },
  });

  return { ok: true, allPlayersKicked: true };
}

// 获取当前设备绑定账号所在的活跃房间列表
export async function getMyRooms(accountId: number) {
  const rooms = await prisma.roomPlayer.findMany({
    where: { accountId, room: { status: { not: "closed" } } },
    include: {
      room: {
        include: {
          host: { include: { nickname: true } },
          players: { select: { accountId: true } },
          games: { orderBy: { roundNumber: "desc" }, take: 1, select: { id: true, roundNumber: true, status: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return rooms.map((rp) => ({
    code: rp.room.code,
    status: rp.room.status,
    hostName: rp.room.host.nickname?.nickname || rp.room.host.name,
    playerCount: rp.room.players.length,
    currentGameId: rp.room.currentGameId,
    currentRound: rp.room.games[0]?.roundNumber || null,
    isHost: rp.isHost,
  }));
}

export async function getRoomHistory(code: string) {
  const room = await prisma.room.findUnique({
    where: { code },
    include: {
      games: {
        orderBy: { roundNumber: "asc" },
        select: {
          id: true,
          roundNumber: true,
          status: true,
          playerCount: true,
          createdAt: true,
          endedAt: true,
        },
      },
    },
  });
  if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "房间不存在");

  return room.games;
}

export async function searchRooms() {
  const rooms = await prisma.room.findMany({
    where: { status: { in: ["waiting", "between_games"] } },
    include: {
      host: { include: { nickname: true } },
      players: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return rooms.map((r) => ({
    code: r.code,
    hostName: r.host.nickname?.nickname || r.host.name,
    playerCount: r.players.length,
    maxPlayers: r.players.length, // 房间创建时已确定人数
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function kickPlayer(code: string, hostId: number, targetAccountId: number) {
  const room = await prisma.room.findUnique({
    where: { code },
    include: { players: true },
  });
  if (!room) throw new AppError(404, "ROOM_NOT_FOUND", "房间不存在");
  if (room.hostAccountId !== hostId) {
    throw new AppError(403, "NOT_HOST", "只有主持人可以踢人");
  }
  if (targetAccountId === hostId) {
    throw new AppError(400, "CANNOT_KICK_SELF", "不能踢自己");
  }

  const target = room.players.find((p) => p.accountId === targetAccountId);
  if (!target) throw new AppError(404, "PLAYER_NOT_IN_ROOM", "该玩家不在房间中");

  // 移除房间成员
  await prisma.roomPlayer.delete({ where: { id: target.id } });

  // 如果在对局中，清除 GamePlayer
  if (room.currentGameId) {
    await prisma.gamePlayer.deleteMany({
      where: { gameId: room.currentGameId, accountId: targetAccountId, isHost: false },
    });
  }

  return { ok: true, kickedAccountId: targetAccountId };
}

function formatRoomInfo(room: any): RoomInfo {
  return {
    id: room.id,
    code: room.code,
    hostAccountId: room.hostAccountId,
    hostPlays: room.hostPlays,
    status: room.status,
    currentGameId: room.currentGameId,
    players: room.players.map(
      (p: any): RoomPlayerInfo => ({
        id: p.id,
        accountId: p.accountId,
        accountName: p.account.name,
        nickname: p.account.nickname?.nickname || undefined,
        isHost: p.isHost,
        joinedAt: p.joinedAt.toISOString(),
      })
    ),
    games: (room.games || []).map(
      (g: any): GameSummary => ({
        id: g.id,
        roundNumber: g.roundNumber,
        status: g.status,
        playerCount: g.playerCount,
        createdAt: g.createdAt.toISOString(),
        endedAt: g.endedAt?.toISOString(),
      })
    ),
    createdAt: room.createdAt.toISOString(),
  };
}
