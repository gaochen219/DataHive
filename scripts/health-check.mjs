// 阶段0 存储层自检：RDS 连通+建表 + OSS 读写+签名URL 端到端。
// 用法：node --env-file=.env scripts/health-check.mjs
import mysql from 'mysql2/promise';
import OSS from 'ali-oss';

const out = { db: {}, oss: {} };

// ── RDS ──
try {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const [r] = await c.query('SELECT 1 AS ok');
  const [t] = await c.query(
    "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema=? AND table_name IN ('content_item','content_asset','source')",
    [process.env.DB_NAME],
  );
  out.db = { ok: r[0].ok === 1, tables: t[0].c };
  await c.end();
} catch (e) {
  out.db = { ok: false, error: e.message };
}

// ── OSS ──
try {
  const base = {
    region: process.env.OSS_REGION,
    bucket: process.env.OSS_BUCKET,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    secure: true,
  };
  const oss = new OSS({ ...base, internal: process.env.OSS_INTERNAL !== 'false' });
  const key = 'datahive/_health/probe.txt';
  await oss.put(key, Buffer.from('datahive health ' + Date.now()));
  await oss.head(key);
  const pub = new OSS({ ...base, internal: false });
  const url = pub.signatureUrl(key, { expires: 300 });
  const resp = await fetch(url);
  out.oss = { ok: true, put: true, signedUrlHost: new URL(url).host, signedUrlFetchStatus: resp.status };
} catch (e) {
  out.oss = { ok: false, error: e.message };
}

out.healthy = out.db.ok === true && out.db.tables === 3 && out.oss.ok === true;
console.log(JSON.stringify(out, null, 2));
process.exit(out.healthy ? 0 : 1);
