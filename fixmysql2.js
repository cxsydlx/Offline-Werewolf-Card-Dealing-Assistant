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
        if (code !== 0) reject(new Error(`Exit ${code}: ${errOut}`));
        else resolve(out);
      });
    });
  });
}

conn.on("ready", async () => {
  console.log("✅ SSH 连接成功\n");
  try {
    // Try to find existing MySQL admin credentials
    console.log("🔍 查找 MySQL 凭据...\n");

    // Try debian-sys-maint (common on Ubuntu)
    let maintUser = "";
    let maintPass = "";
    try {
      const debianCnf = await exec("cat /etc/mysql/debian.cnf 2>/dev/null");
      const userMatch = debianCnf.match(/user\s*=\s*(\S+)/);
      const passMatch = debianCnf.match(/password\s*=\s*(\S+)/);
      if (userMatch) maintUser = userMatch[1];
      if (passMatch) maintPass = passMatch[1];
      console.log(`debian-sys-maint: user=${maintUser}, pass=${maintPass}`);
    } catch (e) {}

    // Try root with password
    console.log("\n🔧 尝试用 root + root123456 创建 werewolf 用户...\n");
    try {
      await exec(`mysql -u root -p'root123456' <<SQL
CREATE USER IF NOT EXISTS 'werewolf'@'localhost' IDENTIFIED BY 'biB8mGZr5DdpN7ZD';
GRANT ALL PRIVILEGES ON weblangrensha.* TO 'werewolf'@'localhost';
FLUSH PRIVILEGES;
SQL`);
      console.log("✅ 用 root 密码创建成功");
    } catch (e) {
      console.log("root 密码方式失败，尝试其他方式...");

      // Try with ALTER USER first to set root password
      try {
        // On Ubuntu, mysql with sudo might use auth_socket
        await exec(`sudo mysql -u root -e "
CREATE USER IF NOT EXISTS 'werewolf'@'localhost' IDENTIFIED BY 'biB8mGZr5DdpN7ZD';
GRANT ALL PRIVILEGES ON weblangrensha.* TO 'werewolf'@'localhost';
FLUSH PRIVILEGES;
"`);
        console.log("✅ 用 sudo mysql 创建成功");
      } catch (e2) {
        console.log("sudo mysql 也失败了");

        // Last resort: try auth_socket
        try {
          // Check if we can use auth_socket to connect
          await exec(`sudo mysql --user=root --socket=/var/run/mysqld/mysqld.sock -e "SELECT 1;"`);
        } catch (e3) {
          console.log("socket 方式也失败");
        }

        throw new Error("无法连接到 MySQL，请手动检查 MySQL root 密码");
      }
    }

    // Test connection
    console.log("\n🔍 测试 werewolf 用户连接...");
    await exec(`mysql -u werewolf -p'biB8mGZr5DdpN7ZD' -e "SELECT 'Connection OK' AS status;"`);

    // Check if DB exists
    console.log("\n📦 确保数据库存在...");
    await exec(`mysql -u werewolf -p'biB8mGZr5DdpN7ZD' -e "CREATE DATABASE IF NOT EXISTS weblangrensha CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`);

    // Migration
    console.log("\n🗄️ 运行数据库迁移...");
    await exec(`cd /opt/weblangrensha/server && npx prisma migrate dev --name init 2>&1`);

    // Seed
    console.log("\n🌱 写入种子数据...");
    await exec(`cd /opt/weblangrensha/server && npx prisma db seed 2>&1`);

    console.log("\n✅ 数据库初始化完成！");

    // PM2 start
    console.log("\n🚀 启动服务...");
    try {
      await exec(`npm install -g pm2 2>&1`);
    } catch (e) {}
    try {
      await exec(`pm2 delete weblangrensha 2>/dev/null; true`);
    } catch (e) {}
    await exec(`cd /opt/weblangrensha && pm2 start ecosystem.config.cjs`);
    await exec(`pm2 save`);

    console.log("\n🎉🎉🎉 部署完成！");
    console.log("   访问地址: http://60.205.92.184:3001");
    console.log("   查看日志: pm2 logs weblangrensha");
  } catch (e) {
    console.error("\n❌ 错误:", e.message);
  }
  conn.end();
});

conn.on("error", (err) => {
  console.error("❌ 连接失败:", err.message);
  process.exit(1);
});

console.log("🔗 连接 root@60.205.92.184...");
conn.connect({ host: "60.205.92.184", port: 22, username: "root", password: "Fat55722", readyTimeout: 15000 });
