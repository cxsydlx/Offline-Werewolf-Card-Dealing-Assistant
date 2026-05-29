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
    console.log("🔧 修复 MySQL 用户认证...\n");

    // Create user and grant privileges using sudo mysql
    await exec(`sudo mysql <<SQL
CREATE USER IF NOT EXISTS 'werewolf'@'localhost' IDENTIFIED BY 'biB8mGZr5DdpN7ZD';
GRANT ALL PRIVILEGES ON weblangrensha.* TO 'werewolf'@'localhost';
FLUSH PRIVILEGES;
SELECT 'User created successfully';
SQL`);

    console.log("\n✅ MySQL 用户已创建");

    // Test connection
    console.log("\n🔍 测试连接...");
    await exec(`mysql -u werewolf -p'biB8mGZr5DdpN7ZD' -e "SELECT 'Connection OK';"`);

    // Run migration
    console.log("\n🗄️ 运行数据库迁移...");
    await exec(`cd /opt/weblangrensha/server && npx prisma migrate dev --name init`);

    // Seed
    console.log("\n🌱 写入种子数据...");
    await exec(`cd /opt/weblangrensha/server && npx prisma db seed`);

    console.log("\n✅ 数据库初始化完成！");

    // Install PM2 and start
    console.log("\n🚀 安装 PM2 并启动服务...");
    await exec(`npm install -g pm2`);
    await exec(`cd /opt/weblangrensha && pm2 delete weblangrensha 2>/dev/null; pm2 start ecosystem.config.cjs`);
    await exec(`pm2 save`);

    console.log("\n🎉🎉🎉 部署完成！");
    console.log("访问地址: http://60.205.92.184:3001\n");
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
