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
    // Test roles API
    console.log("1️⃣ 角色 API:");
    const roles = await exec("curl -s https://cn.xsheep.cn/api/roles 2>&1 | head -c 500");
    console.log(roles);

    // Test accounts API
    console.log("\n2️⃣ 账号 API:");
    const accts = await exec("curl -s https://cn.xsheep.cn/api/accounts 2>&1 | head -c 500");
    console.log(accts);

    // Check PM2 logs for recent errors
    console.log("\n3️⃣ 最近错误:");
    console.log(await exec("pm2 logs weblangrensha --err --lines 10 --nostream 2>&1"));

    // Check if ThemeToggle is in the built JS
    console.log("\n4️⃣ 检查 ThemeToggle 是否打包:");
    console.log(await exec("grep -c 'ThemeToggle\\|液态玻璃\\|华为光影' /opt/weblangrensha/client/dist/assets/index-*.js 2>/dev/null || echo 'Not found'"));
  } catch (e) {
    console.error("Error:", e);
  }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
