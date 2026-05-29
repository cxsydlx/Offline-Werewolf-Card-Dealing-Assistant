// 部署脚本（无密码版，可推 GitHub）
// 用法: SSH_HOST=root@IP SSH_PASS=密码 node deploy1.js

const { Client } = require("ssh2");
const { execSync } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const HOST = process.env.SSH_HOST;
const PASS = process.env.SSH_PASS;

if (!HOST || !PASS) {
  console.error("请设置环境变量: SSH_HOST=root@IP SSH_PASS=密码 node deploy1.js");
  process.exit(1);
}

const [username, host] = HOST.split("@");
const ROOT = path.resolve(__dirname);
const TAR = path.join(os.tmpdir(), "werewolf_deploy.tar.gz");

console.log("🔨 构建前端...");
execSync("npm run build", { cwd: path.join(ROOT, "client"), stdio: "inherit" });

console.log("🔨 构建后端...");
execSync("npm run build", { cwd: path.join(ROOT, "server"), stdio: "inherit" });

console.log("📦 打包...");
execSync(`tar -czf "${TAR}" client/dist/ server/dist/ server/prisma/ server/package.json`, { cwd: ROOT });

const conn = new Client();
conn.on("ready", async () => {
  const sftp = await new Promise((r, j) => conn.sftp((e, s) => e ? j(e) : r(s)));
  console.log("📤 上传...");
  await new Promise((r, j) => sftp.fastPut(TAR, "/tmp/w.tar.gz", (e) => e ? j(e) : r()));

  console.log("🚀 部署...");
  const exec = (cmd) => new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) { resolve(err.message); return; }
      let out = "";
      stream.on("data", (d) => { out += d; process.stdout.write(d); });
      stream.stderr.on("data", (d) => { out += d; });
      stream.on("close", () => resolve(out));
    });
  });

  await exec("cd /opt/weblangrensha && tar -xzf /tmp/w.tar.gz && rm /tmp/w.tar.gz");
  await exec("cd /opt/weblangrensha/server && npx prisma generate && npx prisma db push");
  await exec("pm2 restart weblangrensha");

  console.log("\n✅ 部署完成");
  conn.end();
});

conn.connect({ host, port: 22, username, password: PASS, readyTimeout: 30000 });
