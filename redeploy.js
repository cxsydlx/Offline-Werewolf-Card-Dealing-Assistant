const { Client } = require("ssh2");
const fs = require("fs");

const conn = new Client();

function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "", errOut = "";
      stream.on("data", (d) => { out += d.toString(); process.stdout.write(d); });
      stream.stderr.on("data", (d) => { errOut += d.toString(); process.stderr.write(d); });
      stream.on("close", (code) => {
        if (code !== 0) reject(new Error(errOut));
        else resolve(out);
      });
    });
  });
}

conn.on("ready", async () => {
  try {
    // Tar, upload, extract
    console.log("📤 构建新版本...");
    const { execSync } = require("child_process");
    execSync("tar -czf /tmp/werewolf_update.tar.gz -C /c/develop/code/weblangrensha/client dist", { shell: "bash" });
    execSync("tar -czf /tmp/werewolf_server.tar.gz -C /c/develop/code/weblangrensha/server dist", { shell: "bash" });

    const sftp = await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
    });

    // Upload client dist
    console.log("📤 上传前端...");
    await new Promise((resolve, reject) => {
      sftp.fastPut("C:/Users/19171/AppData/Local/Temp/werewolf_update.tar.gz", "/tmp/werewolf_update.tar.gz", (err) => {
        if (err) reject(err); else resolve();
      });
    });

    // Upload server dist
    console.log("📤 上传后端...");
    await new Promise((resolve, reject) => {
      sftp.fastPut("C:/Users/19171/AppData/Local/Temp/werewolf_server.tar.gz", "/tmp/werewolf_server.tar.gz", (err) => {
        if (err) reject(err); else resolve();
      });
    });

    // Also upload the new source files (ThemeToggle, etc.)
    console.log("📤 上传源码变更...");
    const { execSync: execSync2 } = require("child_process");
    execSync2("tar -czf /tmp/werewolf_src.tar.gz -C /c/develop/code/weblangrensha client/src/components/theme client/src/App.tsx server/src/services/deviceService.ts server/src/middleware/errorHandler.ts server/src/routes/roomRoutes.ts", { shell: "bash" });
    await new Promise((resolve, reject) => {
      sftp.fastPut("C:/Users/19171/AppData/Local/Temp/werewolf_src.tar.gz", "/tmp/werewolf_src.tar.gz", (err) => {
        if (err) reject(err); else resolve();
      });
    });

    // Extract and restart
    console.log("\n📦 解压部署...");
    await exec("tar -xzf /tmp/werewolf_src.tar.gz -C /opt/weblangrensha/");
    await exec("tar -xzf /tmp/werewolf_update.tar.gz -C /opt/weblangrensha/client/");
    await exec("tar -xzf /tmp/werewolf_server.tar.gz -C /opt/weblangrensha/server/");

    console.log("\n🔄 重启服务...");
    await exec("pm2 reload weblangrensha 2>&1");

    console.log("\n🧹 清理...");
    await exec("rm -f /tmp/werewolf_*.tar.gz");

    console.log("\n✅ 部署完成！https://cn.xsheep.cn");
  } catch (e) {
    console.error("\n❌ 错误:", e.message);
  }
  conn.end();
});

conn.on("error", (err) => { console.error("连接失败:", err.message); process.exit(1); });
console.log("🔗 连接...");
conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
