// 快速查看 content_item 里最近入库的内容。
// 用法：node --env-file=.env scripts/list-content.mjs
import mysql from 'mysql2/promise';

const c = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [[cnt]] = await c.query('SELECT COUNT(*) AS c FROM content_item');
const [bySource] = await c.query(
  'SELECT source_name, COUNT(*) AS c FROM content_item GROUP BY source_name ORDER BY c DESC',
);
const [rows] = await c.query(
  "SELECT source_name, DATE_FORMAT(published_at,'%m-%d %H:%i') AS pub, LEFT(title,90) AS title " +
    'FROM content_item ORDER BY published_at DESC LIMIT 15',
);

console.log('content_item 总数:', cnt.c);
console.log('按来源:', bySource.map((r) => `${r.source_name}=${r.c}`).join('  '));
console.log('\n最近 15 条:');
for (const r of rows) console.log(`  [${r.pub || '  ?  '}] ${r.title}`);
await c.end();
