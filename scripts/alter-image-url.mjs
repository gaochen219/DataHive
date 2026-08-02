// 给 content_item 加 image_url 列(幂等)。
import mysql from 'mysql2/promise';
const c = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
});
try {
  await c.query('ALTER TABLE content_item ADD COLUMN image_url VARCHAR(1024) NULL AFTER content_text');
  console.log('✅ image_url 列已添加');
} catch (e) {
  console.log('(列可能已存在)', e.message);
}
await c.end();
