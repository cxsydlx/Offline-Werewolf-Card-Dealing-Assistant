import { prisma } from "../utils/prisma";
import cron from "node-cron";

export function startCleanupJob() {
  const days = Number(process.env.AUTO_CLEANUP_DAYS) || 30;

  // 每天凌晨 3 点执行清理
  cron.schedule("0 3 * * *", async () => {
    console.log(`🧹 开始清理 ${days} 天前结束的房间...`);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const result = await prisma.room.deleteMany({
        where: {
          status: "closed",
          closedAt: { lte: cutoff },
        },
      });

      console.log(`✅ 清理完成，删除了 ${result.count} 个过期房间`);
    } catch (err) {
      console.error("❌ 清理任务失败:", err);
    }
  });

  console.log(`⏰ 自动清理任务已启动（${days} 天后过期删除）`);
}
