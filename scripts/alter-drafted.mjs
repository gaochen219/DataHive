// 给 content_item 加 drafted_at 列(记录已出过草稿的)，并把已发的近似标记掉。
import mysql from 'mysql2/promise';
const c = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
});
try {
  await c.query('ALTER TABLE content_item ADD COLUMN drafted_at DATETIME NULL');
  console.log('✅ drafted_at 列已添加');
} catch (e) {
  console.log('(列可能已存在)', e.message);
}
// 把已发的近似标记：healing-daily 里最新的 12 条视为已出过(用户已手动发布)
const [r] = await c.query(
  "UPDATE content_item SET drafted_at=NOW() WHERE source_id='healing-daily' AND drafted_at IS NULL ORDER BY published_at DESC LIMIT 12",
);
console.log('已标记(近似已发):', r.affectedRows, '条');
await c.end();
