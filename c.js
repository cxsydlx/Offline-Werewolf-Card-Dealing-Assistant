const { Client } = require("ssh2");
const c = new Client();
function e(cmd) {
  return new Promise((r) => {
    c.exec(cmd, (_, s) => { let o = ""; s.on("data", (d) => { o += d.toString(); process.stdout.write(d); }); s.stderr.on("data", (d) => { o += d.toString(); }); s.on("close", () => r(o)); });
  });
}
c.on("ready", async () => {
  console.log(await e("pm2 ls 2>&1"));
  console.log(await e("pm2 logs weblangrensha --err --lines 20 --nostream 2>&1"));
  console.log(await e("curl -s http://127.0.0.1:3001/api/health 2>&1"));
  console.log(await e("ss -tlnp | grep 3001"));
  c.end();
});
c.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
