const { Client } = require("ssh2");

const conn = new Client();

function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "", errOut = "";
      stream.on("data", (d) => { out += d.toString(); });
      stream.stderr.on("data", (d) => { errOut += d.toString(); });
      stream.on("close", () => resolve(out + errOut));
    });
  });
}

conn.on("ready", async () => {
  try {
    // 1. Check server logs for the error
    console.log("📋 PM2 错误日志:");
    console.log(await exec("pm2 logs weblangrensha --err --lines 30 --nostream 2>&1"));

    console.log("\n---\n📋 PM2 输出日志:");
    console.log(await exec("pm2 logs weblangrensha --out --lines 20 --nostream 2>&1"));

    // 2. Test room creation API directly to see the error
    console.log("\n---\n🔍 测试创建房间 API:");
    console.log(await exec("curl -s -X POST http://127.0.0.1:3001/api/rooms -H 'Content-Type: application/json' -H 'X-Device-Fingerprint: test123' -d '{\"participantAccountIds\":[2,3,4,5,6,7,8,9,10,11,12]}' 2>&1"));
  } catch (e) {
    console.error("Error:", e);
  }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
