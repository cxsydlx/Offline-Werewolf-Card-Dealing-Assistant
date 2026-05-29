const { Client } = require("ssh2");

const MYSQL_ROOT_PASS = "26155ea03d31318d";
const MYSQL_USER = "werewolf";
const MYSQL_PASS = "biB8mGZr5DdpN7ZD";

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
  console.log("✅ SSH 连接成功\n");
  try {
    // 1. Create user and database
    console.log("🔧 创建数据库和用户...");
    await exec(`mysql -u root -p'${MYSQL_ROOT_PASS}' <<SQL
CREATE DATABASE IF NOT EXISTS weblangrensha CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PASS}';
GRANT ALL PRIVILEGES ON weblangrensha.* TO '${MYSQL_USER}'@'localhost';
FLUSH PRIVILEGES;
SELECT 'DB and User created' AS result;
SQL`);
    console.log("✅ 数据库和用户就绪");

    // 2. Test connection
    await exec(`mysql -u ${MYSQL_USER} -p'${MYSQL_PASS}' -e "SELECT 'Connection OK' AS status;"`);

    // 3. Migration
    console.log("\n🗄️ 运行数据库迁移...");
    await exec("cd /opt/weblangrensha/server && npx prisma migrate dev --name init 2>&1");

    // 4. Seed
    console.log("\n🌱 写入种子数据...");
    await exec("cd /opt/weblangrensha/server && npx prisma db seed 2>&1");

    console.log("\n✅ 数据库初始化完成");

    // 5. Start PM2
    console.log("\n🚀 启动服务...");
    try { await exec("npm install -g pm2 2>&1 | tail -3"); } catch(e) {}
    try { await exec("pm2 delete weblangrensha 2>/dev/null"); } catch(e) {}
    await exec("cd /opt/weblangrensha && pm2 start ecosystem.config.cjs");
    await exec("pm2 save");

    console.log("\n🎉🎉🎉 部署完成！");
    console.log("   http://60.205.92.184:3001");
    console.log("   查看日志: pm2 logs weblangrensha\n");
  } catch (e) {
    console.error("\n❌ 错误:", e.message);
  }
  conn.end();
});

conn.on("error", (err) => { console.error("❌ 连接失败:", err.message); process.exit(1); });
console.log("🔗 连接 root@60.205.92.184...");
conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
