const { Client } = require("ssh2");
const c = new Client();
function e(cmd) { return new Promise((r) => { c.exec(cmd, (_, s) => { let o = ""; s.on("data", (d) => { o += d.toString(); process.stdout.write(d); }); s.stderr.on("data", (d) => { o += d.toString(); }); s.on("close", () => r(o)); }); }); }
c.on("ready", async () => {
  const sftp = await new Promise((r, j) => c.sftp((e, s) => e ? j(e) : r(s)));
  await new Promise((r, j) => sftp.fastPut("C:\\develop\\code\\weblangrensha\\server\\prisma\\schema.prisma", "/opt/weblangrensha/server/prisma/schema.prisma", (e) => e ? j(e) : r()));
  console.log(await e("cd /opt/weblangrensha/server && npx prisma generate 2>&1"));
  console.log("\n✅ Prisma Client regenerated with hostPlays");
  c.end();
});
c.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 30000 });
