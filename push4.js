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

    console.log("📤 上传 252KB...");
    await new Promise((r, j) => sftp.fastPut("C:/Users/19171/AppData/Local/Temp/wf2.tar.gz", "/tmp/wf2.tar.gz", (e) => e ? j(e) : r()));

    console.log("📦 解压...");
    await exec("tar -xzf /tmp/wf2.tar.gz -C /opt/weblangrensha/ && rm /tmp/wf2.tar.gz");

    console.log("🔄 重启...");
    await exec("pm2 restart weblangrensha");

    // Verify
    console.log("\n🔍 主题:");
    await exec("grep -c '华为光影' /opt/weblangrensha/client/dist/assets/index-*.js && echo '✅ ThemeToggle已打包' || echo '❌'");

    console.log("\n🔍 API测试:");
    console.log(await exec("curl -s http://127.0.0.1:3001/api/health"));
    console.log(await exec("curl -s http://127.0.0.1:3001/api/roles | head -c 200"));
    console.log("\n✅ 刷新 https://cn.xsheep.cn");
  } catch (e) {
    console.error("\n❌", e.message);
  }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 30000 });
