import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { app } from "./app";
import { setupSocketHandlers } from "./socket";
import { startCleanupJob } from "./services/cleanupService";

const PORT = Number(process.env.PORT) || 3001;

const server = http.createServer(app);

// Socket.io 初始化
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

setupSocketHandlers(io);

// 启动自动清理
startCleanupJob();

server.listen(PORT, () => {
  console.log(`🐺 狼人杀服务端已启动 → http://localhost:${PORT}`);
  console.log(`📡 Socket.io 已就绪`);
});

export { server, io };
