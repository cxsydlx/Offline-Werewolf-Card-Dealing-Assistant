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
    // 1. Grant werewolf full privileges including CREATE DATABASE
    console.log("🔧 授予权限...");
    await exec(`mysql -u root -p'${MYSQL_ROOT_PASS}' <<SQL
GRANT ALL PRIVILEGES ON *.* TO '${MYSQL_USER}'@'localhost' WITH GRANT OPTION;
FLUSH PRIVILEGES;
SELECT 'Privileges granted' AS result;
SQL`);
    console.log("✅ 权限已授予");

    // 2. Test
    await exec(`mysql -u ${MYSQL_USER} -p'${MYSQL_PASS}' -e "SELECT 'OK' AS status;"`);

    // 3. Migration using werewolf (now has full privs)
    console.log("\n🗄️ 数据库迁移...");
    await exec("cd /opt/weblangrensha/server && npx prisma migrate dev --name init 2>&1");

    // 4. Seed
    console.log("\n🌱 种子数据...");
    await exec("cd /opt/weblangrensha/server && npx prisma db seed 2>&1");

    console.log("\n✅ 数据库就绪");

    // 5. Start
    console.log("\n🚀 启动服务...");
    try { await exec("npm install -g pm2 2>&1 | tail -5"); } catch(e) {}
    try { await exec("pm2 delete weblangrensha 2>/dev/null"); } catch(e) {}
    await exec("cd /opt/weblangrensha && pm2 start ecosystem.config.cjs");
    await exec("pm2 save");

    console.log("\n🎉🎉🎉 部署完成！");
    console.log("   http://60.205.92.184:3001\n");
  } catch (e) {
    console.error("\n❌ 错误:", e.message);
  }
  conn.end();
});

conn.on("error", (err) => { console.error("❌ 连接失败:", err.message); process.exit(1); });
console.log("🔗 连接...");
conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
