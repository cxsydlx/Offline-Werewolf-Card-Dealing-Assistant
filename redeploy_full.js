const { Client } = require("ssh2");

const conn = new Client();

function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream.on("data", (d) => { out += d.toString(); process.stdout.write(d); });
      stream.stderr.on("data", (d) => { out += d.toString(); process.stderr.write(d); });
      stream.on("close", (code) => {
        if (code !== 0) reject(new Error(out));
        else resolve(out);
      });
    });
  });
}

conn.on("ready", async () => {
  try {
    const sftp = await new Promise((r, j) => conn.sftp((e, s) => e ? j(e) : r(s)));

    console.log("📤 上传完整源码包...");
    await new Promise((r, j) => sftp.fastPut("C:/Users/19171/AppData/Local/Temp/werewolf_full.tar.gz", "/tmp/wf.tar.gz", (e) => e ? j(e) : r()));

    console.log("📦 解压覆盖...");
    await exec("cd /opt/weblangrensha && tar -xzf /tmp/wf.tar.gz && rm /tmp/wf.tar.gz");

    console.log("\n🔍 验证关键文件:");
    await exec("head -3 /opt/weblangrensha/client/src/App.tsx");
    await exec("ls /opt/weblangrensha/client/src/components/theme/");

    console.log("\n🔨 重新构建前端...");
    await exec("cd /opt/weblangrensha/client && npm run build 2>&1");

    console.log("\n🔨 重新构建后端...");
    await exec("cd /opt/weblangrensha/server && npx tsc 2>&1");

    console.log("\n🔄 重启 PM2...");
    await exec("pm2 reload weblangrensha");

    // Verify
    console.log("\n🔍 验证 API:");
    console.log(await exec("curl -s http://127.0.0.1:3001/api/roles | head -c 200"));
    console.log(await exec("\ncurl -s http://127.0.0.1:3001/api/accounts | head -c 200"));

    // Check ThemeToggle in built JS
    console.log("\n🔍 检查 ThemeToggle 已打包:");
    await exec("grep -c '华为光影' /opt/weblangrensha/client/dist/assets/index-*.js && echo '✅ 主题组件已打包' || echo '❌ 未找到'");

    console.log("\n✅ 完成！");
  } catch (e) {
    console.error("\n❌", e.message);
  }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 30000 });
