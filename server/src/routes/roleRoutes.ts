import { Router } from "express";
import { prisma } from "../utils/prisma";
import { AppError } from "../middleware/errorHandler";
import * as deviceService from "../services/deviceService";
import type { RoleWithModules } from "../types";

const router = Router();

// GET /api/roles — 获取全局角色库（含模块定义）
router.get("/roles", async (_req, res, next) => {
  try {
    const roles = await prisma.roleDefinition.findMany({
      include: { modules: true },
      orderBy: { sortOrder: "asc" },
    });

    const result: RoleWithModules[] = roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      faction: r.faction,
      description: r.description,
      skillDescription: r.skillDescription,
      icon: r.icon,
      sortOrder: r.sortOrder,
      modules: r.modules.map((m) => ({
        id: m.id,
        key: m.key,
        name: m.name,
        description: m.description,
        triggerOrder: m.triggerOrder,
        targetSelectionType: m.targetSelectionType as any,
        minTargets: m.minTargets,
        maxTargets: m.maxTargets,
        allowSkip: m.allowSkip,
        resolutionType: m.resolutionType,
        defaultParams: m.defaultParams,
        enabledByDefault: m.enabledByDefault,
      })),
    }));

    res.json({ ok: true, roles: result });
  } catch (err) {
    next(err);
  }
});

// GET /api/role-presets — 获取主持人创建的所有预设
router.get("/role-presets", async (req, res, next) => {
  try {
    const fp = req.deviceFingerprint;
    if (!fp) throw new AppError(400, "NO_FINGERPRINT", "缺少设备指纹");
    const bindings = await deviceService.getBindings(fp);
    if (bindings.length === 0) return res.json({ ok: true, presets: [] });

    const hostAccountId = bindings[0].accountId;
    const presets = await prisma.rolePreset.findMany({
      where: { createdBy: hostAccountId },
      include: {
        items: { include: { role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      ok: true,
      presets: presets.map((p) => ({
        id: p.id,
        name: p.name,
        createdBy: p.createdBy,
        items: p.items.map((i) => ({
          roleId: i.roleId,
          roleKey: i.role.key,
          roleName: i.role.name,
          count: i.count,
        })),
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/games/:gameId/role-presets — 保存角色预设
router.post("/games/:gameId/role-presets", async (req, res, next) => {
  try {
    const fp = req.deviceFingerprint;
    if (!fp) throw new AppError(400, "NO_FINGERPRINT", "缺少设备指纹");
    const bindings = await deviceService.getBindings(fp);
    if (bindings.length === 0) throw new AppError(400, "NO_BINDING", "请先绑定账号");

    const { name, roles } = req.body;
    if (!name) throw new AppError(400, "MISSING_NAME", "缺少预设名称");
    if (!roles || !Array.isArray(roles)) throw new AppError(400, "MISSING_ROLES", "缺少角色配置");

    const preset = await prisma.rolePreset.create({
      data: {
        name: String(name),
        createdBy: bindings[0].accountId,
        items: {
          create: roles.map((r: { roleId: number; count: number }) => ({
            roleId: r.roleId,
            count: r.count,
          })),
        },
      },
      include: {
        items: { include: { role: true } },
      },
    });

    res.json({
      ok: true,
      preset: {
        id: preset.id,
        name: preset.name,
        createdBy: preset.createdBy,
        items: preset.items.map((i) => ({
          roleId: i.roleId,
          roleKey: i.role.key,
          roleName: i.role.name,
          count: i.count,
        })),
        createdAt: preset.createdAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
