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

    console.log("📤 上传...");
    await new Promise((r, j) => sftp.fastPut("C:/Users/19171/AppData/Local/Temp/wf.tar.gz", "/tmp/wf.tar.gz", (e) => e ? j(e) : r()));

    console.log("📦 解压覆盖...");
    await exec("tar -xzf /tmp/wf.tar.gz -C /opt/weblangrensha/ && rm /tmp/wf.tar.gz");

    console.log("🔄 重启...");
    await exec("pm2 restart weblangrensha");

    // Verify
    console.log("\n🔍 验证 ThemeToggle:");
    await exec("grep -c '华为光影' /opt/weblangrensha/client/dist/assets/index-*.js && echo '✅ 已打包' || echo '❌ 未找到'");

    console.log("\n🔍 验证 API:");
    const api1 = await exec("curl -s http://127.0.0.1:3001/api/roles 2>&1 | head -c 300");
    console.log("Roles:", api1.substring(0, 150));

    const api2 = await exec("curl -s http://127.0.0.1:3001/api/accounts 2>&1 | head -c 300");
    console.log("Accounts:", api2.substring(0, 150));

    console.log("\n✅ 完成！刷新 https://cn.xsheep.cn");
  } catch (e) {
    console.error("\n❌", e.message);
  }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 30000 });
