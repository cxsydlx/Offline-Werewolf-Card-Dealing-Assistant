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
    // Test via domain
    console.log("🌐 测试 http://cn.xsheep.cn...");
    const http1 = await exec("curl -s -o /dev/null -w '%{http_code}' http://cn.xsheep.cn/");
    console.log("HTTP: " + http1.out);

    console.log("\n🔒 测试 https://cn.xsheep.cn...");
    const https1 = await exec("curl -s -o /dev/null -w '%{http_code}' https://cn.xsheep.cn/");
    console.log("HTTPS: " + https1.out);

    console.log("\n📋 测试 API:");
    const api = await exec("curl -s https://cn.xsheep.cn/api/health");
    console.log(api.out || api.errOut);

    console.log("\n🔌 检查 WebSocket 支持:");
    const ws = await exec("curl -s -I -H 'Upgrade: websocket' -H 'Connection: Upgrade' https://cn.xsheep.cn/socket.io/ 2>&1 | head -15");
    console.log(ws.out || ws.errOut);

    console.log("\n📱 测试首页 HTML:");
    const html = await exec("curl -s https://cn.xsheep.cn/ 2>&1 | head -10");
    console.log((html.out || html.errOut).substring(0, 500));

    // Check nginx $connection_upgrade variable
    console.log("\n🔍 检查 nginx 配置:");
    const nginx = await exec("grep -r 'connection_upgrade' /www/server/panel/vhost/nginx/ 2>/dev/null; grep 'map.*connection_upgrade' /www/server/nginx/conf/nginx.conf 2>/dev/null || echo 'nginx.conf http段检查...'");
    console.log(nginx.out || nginx.errOut);

    console.log("\n✅ 验证完成");
  } catch (e) {
    console.error("Error:", e);
  }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
