import { Router } from "express";
import * as deviceService from "../services/deviceService";
import { AppError } from "../middleware/errorHandler";

const router = Router();

router.post("/register", async (req, res, next) => {
  try {
    const fp = req.deviceFingerprint;
    if (!fp) throw new AppError(400, "NO_FINGERPRINT", "缺少设备指纹");
    const result = await deviceService.registerDevice(fp);
    res.json({ ok: true, device: result });
  } catch (err) {
    next(err);
  }
});

router.get("/bindings", async (req, res, next) => {
  try {
    const fp = req.deviceFingerprint;
    if (!fp) throw new AppError(400, "NO_FINGERPRINT", "缺少设备指纹");
    const bindings = await deviceService.getBindings(fp);
    res.json({ ok: true, bindings });
  } catch (err) {
    next(err);
  }
});

router.post("/bind", async (req, res, next) => {
  try {
    const fp = req.deviceFingerprint;
    if (!fp) throw new AppError(400, "NO_FINGERPRINT", "缺少设备指纹");
    const { accountId } = req.body;
    if (!accountId) throw new AppError(400, "MISSING_ACCOUNT_ID", "缺少账号ID");
    const result = await deviceService.bindDevice(fp, Number(accountId));
    res.json({ ok: true, binding: result });
  } catch (err) {
    next(err);
  }
});

router.post("/transfer", async (req, res, next) => {
  try {
    const fp = req.deviceFingerprint;
    if (!fp) throw new AppError(400, "NO_FINGERPRINT", "缺少设备指纹");
    const { accountId, confirm } = req.body;
    if (!accountId) throw new AppError(400, "MISSING_ACCOUNT_ID", "缺少账号ID");
    if (!confirm) throw new AppError(400, "NEED_CONFIRM", "需要确认转移");
    const result = await deviceService.transferBinding(fp, Number(accountId));
    res.json({ ok: true, binding: result });
  } catch (err) {
    next(err);
  }
});

router.post("/unbind", async (req, res, next) => {
  try {
    const fp = req.deviceFingerprint;
    if (!fp) throw new AppError(400, "NO_FINGERPRINT", "缺少设备指纹");
    const { accountId } = req.body;
    if (!accountId) throw new AppError(400, "MISSING_ACCOUNT_ID", "缺少账号ID");
    const result = await deviceService.unbindDevice(fp, Number(accountId));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
