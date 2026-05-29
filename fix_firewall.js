const { Client } = require("ssh2");

const conn = new Client();

function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "", errOut = "";
      stream.on("data", (d) => { out += d.toString(); process.stdout.write(d); });
      stream.stderr.on("data", (d) => { errOut += d.toString(); process.stderr.write(d); });
      stream.on("close", (code) => {
        if (code !== 0) reject(new Error(errOut));
        else resolve(out);
      });
    });
  });
}

conn.on("ready", async () => {
  try {
    console.log("🔧 开放 3001 端口...");
    await exec("ufw allow 3001/tcp");
    console.log("✅ UFW 已放行 3001");

    console.log("\n🔍 验证:");
    await exec("ufw status | grep 3001");

    console.log("\n现在去阿里云控制台 → ECS → 安全组 → 添加规则:");
    console.log("  端口: 3001/3001");
    console.log("  协议: TCP");
    console.log("  授权对象: 0.0.0.0/0");

    console.log("\n或者直接用 Nginx 反代域名访问（已配好，80/443 已开放）:");
    console.log("  https://cn.xsheep.cn");
  } catch (e) {
    console.error("❌ 错误:", e.message);
  }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
