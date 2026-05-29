const { Client } = require("ssh2");

const conn = new Client();

function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "", errOut = "";
      stream.on("data", (d) => { out += d.toString(); });
      stream.stderr.on("data", (d) => { errOut += d.toString(); });
      stream.on("close", () => resolve({ out, errOut }));
    });
  });
}

conn.on("ready", async () => {
  try {
    console.log("1️⃣ PM2 状态:");
    console.log((await exec("pm2 ls 2>&1 | grep -E 'id|weblang'")).out);

    console.log("2️⃣ 端口监听:");
    console.log((await exec("ss -tlnp | grep 3001")).out);

    console.log("3️⃣ 本地访问测试:");
    console.log((await exec("curl -s http://127.0.0.1:3001/api/health")).out);

    console.log("4️⃣ 防火墙状态:");
    console.log((await exec("ufw status 2>/dev/null; iptables -L INPUT -n 2>/dev/null | grep 3001 || echo '3001端口未在iptables中'")).out);

    console.log("5️⃣ 阿里云安全组:");
    console.log("   请检查阿里云控制台 → ECS → 安全组 → 放行 3001 端口");

    console.log("6️⃣ Nginx 错误日志:");
    console.log((await exec("tail -20 /www/wwwlogs/cn.xsheep.cn.error.log 2>/dev/null")).out);

    console.log("7️⃣ 外网访问测试:");
    console.log((await exec("curl -s -o /dev/null -w 'HTTP_CODE: %{http_code}\\n' --connect-timeout 5 http://60.205.92.184:3001/ 2>&1")).out);

    console.log("\n8️⃣ 从外部检测端口:");
    console.log((await exec("timeout 3 bash -c 'echo > /dev/tcp/60.205.92.184/3001' 2>&1 && echo '端口可达' || echo '端口不可达'")).out);

  } catch (e) {
    console.error("Error:", e);
  }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
