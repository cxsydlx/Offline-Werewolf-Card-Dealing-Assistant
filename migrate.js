const { Client } = require("ssh2");
const c = new Client();
function e(cmd) { return new Promise((r) => { c.exec(cmd, (_, s) => { let o = ""; s.on("data", (d) => { o += d.toString(); process.stdout.write(d); }); s.stderr.on("data", (d) => { o += d.toString(); }); s.on("close", () => r(o)); }); }); }
c.on("ready", async () => {
  console.log(await e("mysql -u werewolf -p'biB8mGZr5DdpN7ZD' weblangrensha -e \"ALTER TABLE Room ADD COLUMN hostPlays TINYINT(1) NOT NULL DEFAULT 1\" 2>&1 || echo 'column exists'"));
  console.log("✅ 迁移完成");
  c.end();
});
c.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
