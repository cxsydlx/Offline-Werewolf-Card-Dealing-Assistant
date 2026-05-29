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
    console.log("1️⃣ Nginx 运行状态:");
    console.log(await exec("systemctl status nginx 2>&1 | head -8"));

    console.log("\n2️⃣ Nginx 配置测试:");
    console.log(await exec("nginx -t 2>&1"));

    console.log("\n3️⃣ Nginx 监听端口:");
    console.log(await exec("ss -tlnp | grep -E '80|443'"));

    console.log("\n4️⃣ 通过 Nginx 本地测试:");
    console.log(await exec("curl -s -o /dev/null -w 'HTTP:%{http_code}' http://127.0.0.1:80/ -H 'Host: cn.xsheep.cn'"));

    console.log("\n5️⃣ 域名解析:");
    console.log(await exec("curl -s -o /dev/null -w 'HTTP:%{http_code}' http://cn.xsheep.cn/ 2>&1"));

    console.log("\n6️⃣ 上次 Nginx 错误日志:");
    console.log(await exec("tail -30 /www/wwwlogs/cn.xsheep.cn.error.log 2>/dev/null; echo '---'; tail -5 /www/wwwlogs/cn.xsheep.cn.log 2>/dev/null"));

    console.log("\n7️⃣ 宝塔面板 Nginx 重载:");
    console.log(await exec("nginx -s reload 2>&1; echo 'reload done'"));

    console.log("\n8️⃣ 重载后再试:");
    console.log(await exec("curl -s -o /dev/null -w 'HTTP:%{http_code}' https://cn.xsheep.cn/ 2>&1"));
  } catch (e) {
    console.error("Error:", e);
  }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
