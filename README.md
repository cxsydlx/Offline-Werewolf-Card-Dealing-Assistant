# 狼人杀 · 熟人局助手

线下狼人杀面杀辅助工具。主持人用手机创建房间、配置角色、分配身份，玩家扫码加入、提交偏好、查看身份。支持多轮对局、中立角色、纯主持模式。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 后端 | Express + Prisma ORM |
| 数据库 | MySQL |
| 部署 | PM2 + Nginx + 阿里云 ESA (CDN) |

## 项目结构

```
├── client/                  # 前端
│   ├── src/
│   │   ├── pages/           # LandingPage, LobbyPage, RoomPage, AccountManagementPage
│   │   ├── components/      # WerewolfCard, Starfield, ErrorBoundary, ElasticOverscroll
│   │   ├── store/           # Zustand 状态管理 (deviceStore, gameStore)
│   │   ├── api/             # HTTP 请求封装
│   │   └── utils/           # 设备指纹生成
│   └── index.html
├── server/                  # 后端
│   ├── src/
│   │   ├── routes/          # API 路由
│   │   ├── services/        # 业务逻辑
│   │   ├── middleware/       # 设备认证、错误处理
│   │   └── socket/          # Socket.io (广播用)
│   └── prisma/
│       ├── schema.prisma    # 数据模型
│       └── seed.ts          # 种子数据 (12 个初始账号 + 16 个角色)
└── deploy1.js               # 部署脚本 (Node.js)
    deploy1.sh               # 部署脚本 (Bash)
```

## 本地开发

### 1. 环境要求

- Node.js 20+
- MySQL 5.7 / 8.0

### 2. 数据库

```sql
CREATE DATABASE weblangrensha CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. 后端

```bash
cd server
cp .env.example .env
# 编辑 .env 填入你的数据库连接信息

npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev        # 启动在 http://localhost:3001
```

### 4. 前端

```bash
cd client
npm install
npm run dev        # 启动在 http://localhost:5173
```

Vite 会自动代理 `/api` 请求到后端。

## 部署到服务器

### 服务器环境准备（仅首次）

```bash
# 安装 Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2
npm install -g pm2

# 安装 MySQL
sudo apt-get install -y mysql-server
# 创建数据库和用户
mysql -u root -p
> CREATE DATABASE weblangrensha CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> CREATE USER 'werewolf'@'localhost' IDENTIFIED BY '你的密码';
> GRANT ALL ON weblangrensha.* TO 'werewolf'@'localhost';
> FLUSH PRIVILEGES;

# 创建项目目录
sudo mkdir -p /opt/weblangrensha
sudo chown $USER:$USER /opt/weblangrensha
```

### 首次部署

```bash
# 在本地项目根目录执行

# Windows (CMD 或 PowerShell)
set SSH_HOST=root@你的服务器IP
set SSH_PASS=你的SSH密码
node deploy1.js

# Linux / Mac
SSH_HOST=root@你的服务器IP SSH_PASS=你的SSH密码 bash deploy1.sh
```

部署完成后在服务器上执行：

```bash
cd /opt/weblangrensha/server
npx prisma db seed    # 写入初始账号和角色数据
pm2 status            # 确认服务已启动
```

### 日常更新部署

代码修改后，重新执行部署命令即可：

```bash
# Windows
set SSH_HOST=root@IP && set SSH_PASS=密码 && node deploy1.js

# Linux/Mac
SSH_HOST=root@IP SSH_PASS=密码 bash deploy1.sh
```

### Nginx 反向代理（可选，配合 ESA CDN）

```nginx
server {
    listen 80;
    server_name 你的域名;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
    }
}
```

### ESA CDN 缓存配置

| 路径 | TTL | 说明 |
|---|---|---|
| `/` | 0 秒（不缓存） | 首页 HTML |
| `/api/*` | 0 秒（不缓存） | 所有 API |
| `/version.json` | 0 秒（不缓存） | 版本检测 |
| `/assets/*` | 31536000 秒（1 年） | JS/CSS 静态资源 |

规则优先级：`/assets/*` > 全局不缓存

## 环境变量

### 后端 (`server/.env`)

| 变量 | 说明 | 示例 |
|---|---|---|
| `DATABASE_URL` | MySQL 连接串 | `mysql://user:pass@127.0.0.1:3306/weblangrensha` |
| `PORT` | 服务端口 | `3001` |
| `NODE_ENV` | 运行环境 | `production` |
| `CLIENT_URL` | 前端地址 | `https://你的域名` |
| `AUTO_CLEANUP_DAYS` | 自动清理天数 | `30` |

## 功能说明

### 账号系统
- 12 个固定账号，支持设备指纹绑定
- 一键换绑 / 转移绑定
- 自定义添加 / 删除账号
- 支持修改账号名称

### 房间 & 对局
- 主持人创建房间，选择参赛者
- 纯主持模式（主持人只裁判不参赛）
- 扫码自动加入房间
- 多轮对局，角色配置自动继承上一轮

### 角色系统
- 16 个角色：狼人、村民、预言家、女巫、猎人、白痴、守卫、骑士、魔术师、梦魇、狼王、爱神、咒狐、吹笛者
- 三大阵营：狼人 / 村民 / 中立
- 预置版型：6人局 / 9人局 / 12人局 / 12人花板子 / 12人中立局

### 身份分配
- 玩家提交身份偏好
- 带偏好权重的随机分配算法：偏好少的优先匹配
- 主持人查看分配结果，确认后推送到各玩家

### UI 特性
- 液态玻璃风格 + 星空背景
- 按压缩放防窥身份卡
- 弹性下拉动效
- 全屏模式
- 0.55 秒轮询（可在开发工具中调整）
- 自动检测新版本并刷新

## License

MIT
