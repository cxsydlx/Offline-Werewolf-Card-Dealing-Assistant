const { Client } = require("ssh2");

const conn = new Client();

function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream.on("data", (d) => { out += d.toString(); process.stdout.write(d); });
      stream.stderr.on("data", (d) => { out += d.toString(); process.stderr.write(d); });
      stream.on("close", (code) => {
        if (code !== 0) reject(new Error(out));
        else resolve(out);
      });
    });
  });
}

conn.on("ready", async () => {
  try {
    const sftp = await new Promise((r, j) => conn.sftp((e, s) => e ? j(e) : r(s)));

    console.log("📤 上传补丁...");
    await new Promise((r, j) => sftp.fastPut("C:/Users/19171/AppData/Local/Temp/werewolf_patch.tar.gz", "/tmp/wp.tar.gz", (e) => e ? j(e) : r()));

    console.log("📦 解压...");
    await exec("tar -xzf /tmp/wp.tar.gz -C /opt/weblangrensha/ && rm /tmp/wp.tar.gz");

    console.log("📦 安装新依赖...");
    await exec("cd /opt/weblangrensha/client && npm install html5-qrcode 2>&1");

    console.log("🔨 构建...");
    await exec("cd /opt/weblangrensha/client && npm run build 2>&1");
    await exec("cd /opt/weblangrensha/server && npx tsc 2>&1");

    console.log("🔄 重启...");
    await exec("pm2 reload weblangrensha");

    console.log("\n✅ 完成！");
  } catch (e) {
    console.error("\n❌", e.message);
  }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 30000 });
