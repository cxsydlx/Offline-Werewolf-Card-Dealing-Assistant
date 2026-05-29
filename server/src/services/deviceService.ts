import { prisma } from "../utils/prisma";
import { AppError } from "../middleware/errorHandler";

export async function registerDevice(fingerprint: string) {
  const existing = await prisma.deviceBinding.findUnique({
    where: { deviceFingerprint: fingerprint },
  });
  if (existing) {
    await prisma.deviceBinding.update({
      where: { deviceFingerprint: fingerprint },
      data: { lastActiveAt: new Date() },
    });
  }
  return { fingerprint, registered: true };
}

export async function getBindings(fingerprint: string) {
  const binding = await prisma.deviceBinding.findUnique({
    where: { deviceFingerprint: fingerprint },
    include: { account: { include: { nickname: true } } },
  });
  if (!binding || binding.accountId === 0) return [];
  return [
    {
      accountId: binding.account.id,
      accountName: binding.account.name,
      nickname: binding.account.nickname?.nickname || null,
      boundAt: binding.boundAt.toISOString(),
    },
  ];
}

export async function bindDevice(fingerprint: string, accountId: number) {
  // 检查账号是否存在
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError(404, "ACCOUNT_NOT_FOUND", "账号不存在");

  // 检查当前设备是否已绑定该账号
  const existingBinding = await prisma.deviceBinding.findUnique({
    where: { deviceFingerprint: fingerprint },
  });
  if (existingBinding && existingBinding.accountId === accountId) {
    return { accountId, accountName: account.name, transferred: false };
  }

  // 检查该账号是否已被其他设备绑定
  const accountBinding = await prisma.deviceBinding.findUnique({
    where: { accountId },
  });

  if (accountBinding && accountBinding.deviceFingerprint !== fingerprint) {
    // 检查该账号是否在活跃房间中
    const activeRoomPlayer = await prisma.roomPlayer.findFirst({
      where: {
        accountId,
        room: { status: { not: "closed" } },
      },
    });
    if (activeRoomPlayer) {
      throw new AppError(409, "ACCOUNT_IN_GAME", `账号 ${account.name} 正在游戏中，无法转移绑定`);
    }
    // 需要转移
    const transferErr = new AppError(409, "REQUIRES_TRANSFER", `账号 ${account.name} 已绑定到其他设备`);
    (transferErr as any).data = { oldFingerprint: accountBinding.deviceFingerprint, requiresTransfer: true };
    throw transferErr;
  }

  // 绑定设备到账号
  await prisma.deviceBinding.upsert({
    where: { deviceFingerprint: fingerprint },
    update: { accountId, lastActiveAt: new Date() },
    create: { deviceFingerprint: fingerprint, accountId },
  });

  return { accountId, accountName: account.name, transferred: false };
}

export async function transferBinding(fingerprint: string, accountId: number) {
  // 强制解除旧设备绑定，绑定当前设备
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError(404, "ACCOUNT_NOT_FOUND", "账号不存在");

  // 删除旧绑定
  await prisma.deviceBinding.deleteMany({ where: { accountId } });

  // 创建新绑定
  await prisma.deviceBinding.upsert({
    where: { deviceFingerprint: fingerprint },
    update: { accountId, lastActiveAt: new Date() },
    create: { deviceFingerprint: fingerprint, accountId },
  });

  return { accountId, accountName: account.name, transferred: true };
}

export async function unbindDevice(fingerprint: string, accountId: number) {
  const binding = await prisma.deviceBinding.findFirst({
    where: { deviceFingerprint: fingerprint, accountId },
  });
  if (!binding) throw new AppError(404, "BINDING_NOT_FOUND", "未找到绑定关系");

  await prisma.deviceBinding.delete({ where: { id: binding.id } });

  // 如果账号在房间中，将其从房间移除
  const roomPlayer = await prisma.roomPlayer.findFirst({
    where: {
      accountId,
      room: { status: { not: "closed" } },
    },
  });

  if (roomPlayer) {
    await prisma.roomPlayer.delete({ where: { id: roomPlayer.id } });

    // 如果在活动中，也清理 gamePlayer
    const room = await prisma.room.findUnique({ where: { id: roomPlayer.roomId } });
    if (room?.currentGameId) {
      await prisma.gamePlayer.deleteMany({
        where: { gameId: room.currentGameId, accountId, isHost: false },
      });
    }
  }

  return { ok: true };
}
