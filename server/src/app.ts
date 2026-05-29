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

// API 响应禁止 CDN 缓存
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// API 路由
import routes from "./routes/index";
app.use("/api", routes);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// 生产环境：托管前端静态文件
if (isProduction) {
  const clientDist = path.resolve(__dirname, "../../client/dist");
  // /assets/ 长期缓存
  app.use("/assets", express.static(path.join(clientDist, "assets"), {
    maxAge: "365d",
    setHeaders: (res) => {
      res.set("Cache-Control", "public, max-age=31536000, immutable");
    },
  }));
  // 其他静态文件不缓存
  app.use(express.static(clientDist, {
    setHeaders: (res, p) => {
      if (!p.includes("assets")) res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    },
  }));
  // SPA fallback — 不缓存 index.html
  app.get("*", (_req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// 错误处理
app.use(errorHandler);

export { app };
