import express from "express";
import cors from "cors";
import path from "path";
import { deviceAuthMiddleware } from "./middleware/deviceAuth";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

const isProduction = process.env.NODE_ENV === "production";
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: isProduction ? false : clientUrl,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
app.use(express.json());

// 设备认证中间件
app.use(deviceAuthMiddleware);

// API 路由
import routes from "./routes/index";
app.use("/api", routes);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// 生产环境：托管前端静态文件
if (isProduction) {
  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  // SPA fallback — 所有非 API 请求返回 index.html
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// 错误处理
app.use(errorHandler);

export { app };
