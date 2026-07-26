// 建表脚本：把 db/schema.sql 应用到 RDS。
// 用法：node --env-file=.env scripts/run-schema.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(__dirname, '../db/schema.sql'), 'utf8');

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true,
  charset: 'utf8mb4',
});
await conn.query(sql);
const [rows] = await conn.query(
  'SELECT table_name AS t FROM information_schema.tables WHERE table_schema=? ORDER BY table_name',
  [process.env.DB_NAME],
);
console.log('✅ schema applied. 表:', rows.map((r) => r.t).join(', '));
await conn.end();
