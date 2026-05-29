const { Client } = require("ssh2");
const fs = require("fs");
const path = require("path");

const HOST = "60.205.92.184";
const PORT = 22;
const USER = "root";
const PASS = "Fat55722";
const LOCAL_FILE = "C:\\Users\\19171\\AppData\\Local\\Temp\\weblangrensha.tar.gz";
const REMOTE_DIR = "/opt/";
const REMOTE_FILE = "/opt/weblangrensha.tar.gz";
const APP_DIR = "/opt/weblangrensha";

const conn = new Client();

function exec(cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "", errOut = "";
      stream.on("data", (d) => { out += d.toString(); process.stdout.write(d); });
      stream.stderr.on("data", (d) => { errOut += d.toString(); process.stderr.write(d); });
      stream.on("close", (code) => {
        if (code !== 0) reject(new Error(`Exit ${code}: ${errOut}`));
        else resolve(out);
      });
    });
  });
}

conn.on("ready", async () => {
  console.log("✅ SSH 连接成功");

  try {
    // Step 1: Upload tar.gz via SFTP
    console.log("\n📤 上传项目文件...");
    await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);
        sftp.fastPut(LOCAL_FILE, REMOTE_FILE, (err) => {
          if (err) return reject(err);
          console.log("✅ 上传完成 (88KB)");
          resolve();
        });
      });
    });

    // Step 2: Clean old directory and extract
    console.log("\n📦 解压项目...");
    await exec(`rm -rf ${APP_DIR} && mkdir -p ${APP_DIR} && tar -xzf ${REMOTE_FILE} -C /opt/ && rm ${REMOTE_FILE}`);
    console.log("✅ 解压完成");

    // Step 3: Check environment
    console.log("\n🔍 检查环境...");
    await exec("node --version || echo 'Node未安装'");
    await exec("mysql --version || echo 'MySQL未安装'");

    // Step 4: Run install
    console.log("\n🚀 开始一键安装...");
    await exec(`cd ${APP_DIR} && chmod +x install.sh && bash install.sh`);

    console.log("\n🎉 部署完成！");
  } catch (e) {
    console.error("\n❌ 错误:", e.message);
  }
  conn.end();
});

conn.on("error", (err) => {
  console.error("❌ 连接失败:", err.message);
  process.exit(1);
});

console.log(`🔗 正在连接 ${USER}@${HOST}:${PORT}...`);
conn.connect({ host: HOST, port: PORT, username: USER, password: PASS, readyTimeout: 15000 });
