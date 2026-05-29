import { Router } from "express";
import deviceRoutes from "./deviceRoutes";
import accountRoutes from "./accountRoutes";
import roomRoutes from "./roomRoutes";
import gameRoutes from "./gameRoutes";
import roleRoutes from "./roleRoutes";
import distributionRoutes from "./distributionRoutes";

const router = Router();

router.use("/device", deviceRoutes);
router.use("/accounts", accountRoutes);
router.use("/rooms", roomRoutes);
router.use("/", gameRoutes);
router.use("/", roleRoutes);
router.use("/", distributionRoutes);

export default router;
