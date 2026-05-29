import { Router } from "express";
import * as accountService from "../services/accountService";
import { AppError } from "../middleware/errorHandler";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const accounts = await accountService.listAccounts(req.deviceFingerprint);
    res.json({ ok: true, accounts });
  } catch (err) {
    next(err);
  }
});

router.put("/:id/nickname", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nickname } = req.body;
    if (!nickname) throw new AppError(400, "MISSING_NICKNAME", "缺少昵称");
    const result = await accountService.updateNickname(Number(id), String(nickname));
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.post("/custom", async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) throw new AppError(400, "MISSING_NAME", "缺少账号名");
    const result = await accountService.createCustomAccount(String(name));
    res.json({ ok: true, account: result });
  } catch (err) {
    next(err);
  }
});

router.delete("/custom/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await accountService.deleteCustomAccount(Number(id));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
