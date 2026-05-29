const { Client } = require("ssh2");

const conn = new Client();

function exec(cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) { resolve("ERR: " + err.message); return; }
      let out = "", errOut = "";
      stream.on("data", (d) => { out += d.toString(); });
      stream.stderr.on("data", (d) => { errOut += d.toString(); });
      stream.on("close", () => resolve(out + errOut));
    });
  });
}

conn.on("ready", async () => {
  // 1. Check PM2 logs for errors
  console.log("📋 服务日志:");
  console.log(await exec("pm2 logs weblangrensha --err --lines 5 --nostream 2>&1"));

  // 2. Check dist file timestamps
  console.log("\n📁 dist 更新时间:");
  console.log(await exec("ls -la /opt/weblangrensha/server/dist/routes/roleRoutes.js /opt/weblangrensha/server/dist/routes/index.js /opt/weblangrensha/server/dist/middleware/errorHandler.js 2>&1"));

  // 3. Test API directly
  console.log("\n🔍 /api/roles:");
  console.log(await exec("curl -s --connect-timeout 3 http://127.0.0.1:3001/api/roles 2>&1 | head -c 300"));

  console.log("\n🔍 /api/health:");
  console.log(await exec("curl -s --connect-timeout 3 http://127.0.0.1:3001/api/health 2>&1"));

  // 4. Check if roleRoutes exports correctly
  console.log("\n🔍 检查路由定义:");
  console.log(await exec("head -5 /opt/weblangrensha/server/dist/routes/roleRoutes.js 2>&1"));
  console.log(await exec("head -5 /opt/weblangrensha/server/dist/routes/index.js 2>&1"));

  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
