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
    console.log("🔍 域名 DNS 解析:");
    console.log(await exec("nslookup cn.xsheep.cn 2>&1"));

    console.log("\n🔍 域名 CNAME 记录:");
    console.log(await exec("host -t CNAME cn.xsheep.cn 2>&1"));

    console.log("\n🔍 域名 A 记录:");
    console.log(await exec("host -t A cn.xsheep.cn 2>&1"));

    console.log("\n🔍 curl 访问域名看响应头:");
    console.log(await exec("curl -sI https://cn.xsheep.cn/ 2>&1 | head -20"));

    console.log("\n🔍 服务器 IP:");
    console.log(await exec("curl -s ip.sb 2>&1; echo ''; hostname -I"));
  } catch (e) {
    console.error("Error:", e);
  }
  conn.end();
});

conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
