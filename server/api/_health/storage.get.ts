// 阶段0 存储层健康自检：验证 RDS 连通 + OSS 读写。
// 用法：GET /api/_health/storage?key=<HEALTH_KEY>
// 需在 .env 设置 HEALTH_KEY；未设置则接口关闭。
import { ping as dbPing } from '~~/server/storage/db';
import { putObject, getSignedUrl, objectExists } from '~~/server/storage/oss';

export default defineEventHandler(async (event) => {
  const key = getQuery(event).key;
  if (!process.env.HEALTH_KEY || key !== process.env.HEALTH_KEY) {
    throw createError({ statusCode: 403, statusMessage: 'forbidden' });
  }

  const result: Record<string, any> = { db: {}, oss: {} };

  // RDS
  try {
    result.db.ok = await dbPing();
  } catch (e: any) {
    result.db.ok = false;
    result.db.error = e?.message ?? String(e);
  }

  // OSS：写一个探针对象 → 确认存在 → 生成签名URL
  try {
    const probeKey = 'datahive/_health/probe.txt';
    await putObject(probeKey, `datahive health ${Date.now()}`, { contentType: 'text/plain' });
    result.oss.ok = await objectExists(probeKey);
    result.oss.signedUrlSample = getSignedUrl(probeKey, 300).slice(0, 80) + '...';
  } catch (e: any) {
    result.oss.ok = false;
    result.oss.error = e?.message ?? String(e);
  }

  result.healthy = result.db.ok === true && result.oss.ok === true;
  return result;
});
