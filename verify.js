const { Client } = require("ssh2");
const http = require("http");

const conn = new Client();

function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream.on("data", (d) => { out += d.toString(); });
      stream.stderr.on("data", (d) => { out += d.toString(); });
      stream.on("close", (code) => {
        if (code !== 0) reject(new Error(out));
        else resolve(out);
      });
    });
  });
}

conn.on("ready", async () => {
  console.log("🔍 验证部署...\n");
  try {
    // PM2 status
    const pm2 = await exec("pm2 ls 2>&1");
    console.log("PM2 状态:");
    console.log(pm2);

    // Test HTTP
    console.log("\n🌐 测试 HTTP 访问...");
    await exec("curl -s http://localhost:3001/api/health 2>&1");
    console.log("");

    await exec("curl -s http://localhost:3001/api/accounts 2>&1 | head -c 200");
    console.log("");

    await exec("curl -s http://localhost:3001/api/roles 2>&1 | head -c 200");
    console.log("");

    console.log("\n✅ 所有接口正常！");
    console.log("\n🗑️ 清理部署脚本...");
    await exec("rm -f /opt/weblangrensha/upload.js /opt/weblangrensha/fixmysql.js /opt/weblangrensha/fixmysql2.js /opt/weblangrensha/resetmysql.js /opt/weblangrensha/deploy_final.js /opt/weblangrensha/deploy_final2.js /opt/weblangrensha/verify.js");
  } catch (e) {
    console.error("错误:", e.message);
  }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
