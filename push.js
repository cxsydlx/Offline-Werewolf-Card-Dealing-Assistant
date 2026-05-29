const { Client } = require("ssh2");

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
    const sftp = await new Promise((r, j) => conn.sftp((e, s) => e ? j(e) : r(s)));

    console.log("📤 上传更新包...");
    await new Promise((r, j) => sftp.fastPut("C:/Users/19171/AppData/Local/Temp/werewolf_update.tar.gz", "/tmp/werewolf_update.tar.gz", (e) => e ? j(e) : r()));
    console.log("✅ 上传完成");

    console.log("\n📦 解压覆盖...");
    await exec("cd /opt/weblangrensha && tar -xzf /tmp/werewolf_update.tar.gz && rm /tmp/werewolf_update.tar.gz");

    console.log("\n🔨 构建前端...");
    await exec("cd /opt/weblangrensha/client && npm run build 2>&1");

    console.log("\n🔨 构建后端...");
    await exec("cd /opt/weblangrensha/server && npx tsc 2>&1");

    console.log("\n🔄 重启服务...");
    await exec("pm2 reload weblangrensha 2>&1");

    console.log("\n✅ 更新完成！");
    console.log("https://cn.xsheep.cn");
  } catch (e) {
    console.error("\n❌", e.message);
  }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 30000 });
