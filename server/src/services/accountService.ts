import { prisma } from "../utils/prisma";
import { AppError } from "../middleware/errorHandler";
import type { AccountInfo } from "../types";

export async function listAccounts(fingerprint?: string) {
  const accounts = await prisma.account.findMany({
    include: {
      nickname: true,
      deviceBinding: true,
    },
    orderBy: [{ isFixed: "desc" }, { name: "asc" }],
  });

  // 确定当前设备的绑定关系
  const currentBinding = fingerprint
    ? await prisma.deviceBinding.findUnique({
        where: { deviceFingerprint: fingerprint },
      })
    : null;

  // 查询活跃房间中的账号
  const activePlayers = await prisma.roomPlayer.findMany({
    where: { room: { status: { not: "closed" } } },
    select: { accountId: true },
  });
  const activeSet = new Set(activePlayers.map((p) => p.accountId));

  return accounts.map((a): AccountInfo => {
    let bindingStatus: AccountInfo["bindingStatus"] = "unbound";
    if (a.deviceBinding) {
      if (currentBinding && a.deviceBinding.deviceFingerprint === fingerprint) {
        bindingStatus = "current_device";
      } else if (activeSet.has(a.id)) {
        bindingStatus = "other_device";
      } else {
        // 不在活跃房间中 → 忽略残留绑定
        bindingStatus = "unbound";
      }
    }

    return {
      id: a.id,
      name: a.name,
      isFixed: a.isFixed,
      nickname: a.nickname?.nickname || undefined,
      bindingStatus,
      inActiveGame: activeSet.has(a.id),
    };
  });
}

export async function updateNickname(accountId: number, nickname: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError(404, "ACCOUNT_NOT_FOUND", "账号不存在");

  if (nickname.length > 50) throw new AppError(400, "NICKNAME_TOO_LONG", "昵称长度不能超过50个字符");

  const result = await prisma.nickname.upsert({
    where: { accountId },
    update: { nickname },
    create: { accountId, nickname },
  });

  return { accountId, nickname: result.nickname };
}

export async function createCustomAccount(name: string) {
  if (!name || name.trim().length === 0) {
    throw new AppError(400, "INVALID_NAME", "账号名不能为空");
  }
  if (name.length > 50) {
    throw new AppError(400, "NAME_TOO_LONG", "账号名长度不能超过50个字符");
  }

  const existing = await prisma.account.findUnique({ where: { name: name.trim() } });
  if (existing) throw new AppError(409, "NAME_EXISTS", `账号 "${name}" 已存在`);

  const account = await prisma.account.create({
    data: { name: name.trim(), isFixed: false },
  });

  return {
    id: account.id,
    name: account.name,
    isFixed: account.isFixed,
    bindingStatus: "unbound" as const,
    inActiveGame: false,
  };
}

export async function deleteCustomAccount(accountId: number) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new AppError(404, "ACCOUNT_NOT_FOUND", "账号不存在");
  if (account.isFixed) throw new AppError(403, "FIXED_ACCOUNT", "固定账号不可删除");

  // 检查是否在活跃游戏中
  const activePlayer = await prisma.roomPlayer.findFirst({
    where: {
      accountId,
      room: { status: { not: "closed" } },
    },
  });
  if (activePlayer) throw new AppError(409, "ACCOUNT_IN_GAME", "该账号正在游戏中，不可删除");

  await prisma.account.delete({ where: { id: accountId } });
  return { ok: true };
}
