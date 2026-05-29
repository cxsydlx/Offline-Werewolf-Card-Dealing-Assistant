const { Client } = require("ssh2");
const c = new Client();
function e(cmd) { return new Promise((r) => { c.exec(cmd, (_, s) => { let o = ""; s.on("data", (d) => { o += d.toString(); process.stdout.write(d); }); s.stderr.on("data", (d) => { o += d.toString(); }); s.on("close", () => r(o)); }); }); }
c.on("ready", async () => {
  console.log("=== 活跃房间 ===");
  console.log(await e("curl -s http://127.0.0.1:3001/api/rooms/search 2>&1"));
  console.log("\n=== 账号列表(含绑定) ===");
  console.log(await e("curl -s http://127.0.0.1:3001/api/accounts 2>&1 | python3 -m json.tool 2>/dev/null | head -60 || curl -s http://127.0.0.1:3001/api/accounts 2>&1 | head -c 500"));
  console.log("\n=== 房间数据 ===");
  console.log(await e("cd /opt/weblangrensha/server && npx prisma db execute --stdin <<< 'SELECT id,code,status,currentGameId FROM Room ORDER BY id DESC LIMIT 5;' 2>&1"));
  console.log("\n=== DeviceBinding ===");
  console.log(await e("cd /opt/weblangrensha/server && npx prisma db execute --stdin <<< 'SELECT * FROM DeviceBinding;' 2>&1"));
  c.end();
});
c.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
