const { Client } = require("ssh2");
const c = new Client();
function e(cmd) { return new Promise((r) => { c.exec(cmd, (_, s) => { let o = ""; s.on("data", (d) => { o += d.toString(); process.stdout.write(d); }); s.stderr.on("data", (d) => { o += d.toString(); }); s.on("close", () => r(o)); }); }); }
c.on("ready", async () => {
  console.log("🧹 清理所有数据...");
  await e("cd /opt/weblangrensha/server && npx prisma db execute --stdin <<< 'DELETE FROM NightActionTarget; DELETE FROM NightAction; DELETE FROM DawnResult; DELETE FROM NightRound; DELETE FROM IdentityPreference; DELETE FROM GameModule; DELETE FROM GameRole; DELETE FROM GamePlayer; DELETE FROM GameLog; DELETE FROM PlayerNote; DELETE FROM Game; DELETE FROM RoomPlayer; DELETE FROM Room; DELETE FROM DeviceBinding;' 2>&1");
  console.log("✅ 清空完成");
  console.log(await e("cd /opt/weblangrensha/server && npx prisma db seed 2>&1"));
  c.end();
});
c.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 30000 });
