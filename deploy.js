const { Client } = require("ssh2");
const path = require("path");
const os = require("os");
const conn = new Client();

function exec(cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) { resolve("ERR: " + err.message); return; }
      let out = "";
      stream.on("data", (d) => { out += d.toString(); process.stdout.write(d); });
      stream.stderr.on("data", (d) => { out += d.toString(); });
      stream.on("close", () => resolve(out));
    });
  });
}

const TAR = path.join(os.tmpdir(), "werewolf_deploy.tar.gz");

conn.on("ready", async () => {
  try {
    const sftp = await new Promise((r, j) => conn.sftp((e, s) => e ? j(e) : r(s)));
    console.log("📤 上传 " + TAR);
    await new Promise((r, j) => sftp.fastPut(TAR, "/tmp/w.tar.gz", (e) => e ? j(e) : r()));
    console.log("📦 解压...");
    await exec("tar -xzf /tmp/w.tar.gz -C /opt/weblangrensha/ && rm /tmp/w.tar.gz");
    console.log("🔄 重启...");
    await exec("pm2 restart weblangrensha");
    console.log("\n✅ 部署完成！https://cn.xsheep.cn");
  } catch (e) { console.error(e.message); }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 30000 });
