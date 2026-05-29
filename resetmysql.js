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
    // Step 1: Stop MySQL
    console.log("⏸️ 停止 MySQL...");
    await exec("systemctl stop mysql 2>/dev/null || service mysql stop 2>/dev/null; sleep 2; echo 'stopped'");

    // Step 2: Start MySQL in safe mode (skip grant tables)
    console.log("🔧 以安全模式启动 MySQL（跳过认证）...");
    // Use a subshell to run mysqld_safe in background
    await exec("mysqld_safe --skip-grant-tables --skip-networking &");
    await exec("sleep 3; echo 'MySQL safe mode started'");

    // Step 3: Reset root password
    console.log("🔑 重置 root 密码...");
    await exec(`mysql -u root <<SQL
FLUSH PRIVILEGES;
ALTER USER 'root'@'localhost' IDENTIFIED BY 'root123456';
FLUSH PRIVILEGES;
SQL`);
    console.log("✅ root 密码已重置为 root123456");

    // Step 4: Stop safe mode
    console.log("⏸️ 停止安全模式...");
    await exec("mysqladmin -u root shutdown 2>/dev/null; sleep 2; echo 'safe mode stopped'");

    // Step 5: Start MySQL normally
    console.log("▶️ 正常启动 MySQL...");
    await exec("systemctl start mysql 2>/dev/null || service mysql start 2>/dev/null; sleep 3; echo 'mysql started'");

    // Step 6: Create werewolf user and database
    console.log("🔧 创建数据库和用户...");
    await exec(`mysql -u root -p'root123456' <<SQL
CREATE DATABASE IF NOT EXISTS weblangrensha CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'werewolf'@'localhost' IDENTIFIED BY 'biB8mGZr5DdpN7ZD';
GRANT ALL PRIVILEGES ON weblangrensha.* TO 'werewolf'@'localhost';
FLUSH PRIVILEGES;
SQL`);
    console.log("✅ 数据库和用户创建完成");

    // Step 7: Test werewolf connection
    await exec(`mysql -u werewolf -p'biB8mGZr5DdpN7ZD' -e "SELECT 'MySQL OK' AS status;"`);

    // Step 8: Run migrations
    console.log("\n🗄️ 运行数据库迁移...");
    await exec("cd /opt/weblangrensha/server && npx prisma migrate dev --name init 2>&1");

    // Step 9: Seed
    console.log("\n🌱 写入种子数据...");
    await exec("cd /opt/weblangrensha/server && npx prisma db seed 2>&1");

    console.log("\n✅ 数据库初始化完成！");

    // Step 10: Start with PM2
    console.log("\n🚀 启动服务...");
    await exec("npm install -g pm2 2>&1 | tail -3");
    await exec("pm2 delete weblangrensha 2>/dev/null; true");
    await exec("cd /opt/weblangrensha && pm2 start ecosystem.config.cjs");
    await exec("pm2 save");

    console.log("\n🎉🎉🎉 全部部署完成！");
    console.log("   http://60.205.92.184:3001");
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
