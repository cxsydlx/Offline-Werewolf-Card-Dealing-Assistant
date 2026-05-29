const { Client } = require("ssh2");

const conn = new Client();

function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "", errOut = "";
      stream.on("data", (d) => { out += d.toString(); });
      stream.stderr.on("data", (d) => { errOut += d.toString(); });
      stream.on("close", (code) => {
        resolve({ out, errOut, code });
      });
    });
  });
}

conn.on("ready", async () => {
  try {
    // Check PM2 logs
    console.log("📋 PM2 日志:");
    const logs = await exec("pm2 logs weblangrensha --lines 20 --nostream 2>&1");
    console.log(logs.out || logs.errOut);

    // Check if port is listening
    console.log("\n🔍 端口检查:");
    const port = await exec("ss -tlnp | grep 3001 2>&1; netstat -tlnp 2>/dev/null | grep 3001");
    console.log(port.out || port.errOut || "端口未找到");

    // Try curl with verbose
    console.log("\n🌐 HTTP 测试:");
    const curl = await exec("curl -v http://localhost:3001/api/health 2>&1");
    console.log(curl.out || curl.errOut);

    // Check user accounts API
    console.log("\n📋 账号列表:");
    const accounts = await exec("curl -s http://localhost:3001/api/accounts");
    console.log((accounts.out || accounts.errOut).substring(0, 400));

    console.log("\n✅ 验证完成");
  } catch (e) {
    console.error("Error:", e);
  }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
