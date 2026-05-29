const { Client } = require("ssh2");
const conn = new Client();

function exec(cmd) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) { resolve("ERR: " + err.message); return; }
      let out = "";
      stream.on("data", (d) => { out += d.toString(); process.stdout.write(d); });
      stream.stderr.on("data", (d) => { out += d.toString(); });
      stream.on("close", () => resolve(out));
    });
  });
}

conn.on("ready", async () => {
  try {
    const sftp = await new Promise((r, j) => conn.sftp((e, s) => e ? j(e) : r(s)));
    await new Promise((r, j) => sftp.fastPut("C:/Users/19171/AppData/Local/Temp/wf3.tar.gz", "/tmp/wf3.tar.gz", (e) => e ? j(e) : r()));
    await exec("tar -xzf /tmp/wf3.tar.gz -C /opt/weblangrensha/ && rm /tmp/wf3.tar.gz");
    await exec("pm2 restart weblangrensha");

    console.log("\n🔍 测试 API:");
    console.log(await exec("curl -s http://127.0.0.1:3001/api/roles 2>&1 | head -c 250"));
    console.log(await exec("\ncurl -s http://127.0.0.1:3001/api/accounts 2>&1 | head -c 150"));
    console.log("\n✅ 完成");
  } catch (e) { console.error(e.message); }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 30000 });
