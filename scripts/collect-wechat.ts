// 采集所有启用的微信公众号源。
// 用法：node --env-file=.env --import tsx scripts/collect-wechat.ts
import { setTimeout as sleep } from 'node:timers/promises';
import { collect } from '../server/collect/core';
import { wechatAdapter } from '../server/collect/adapters/wechat';
import { listEnabledSources } from '../server/collect/sources';
import { closePool } from '../server/storage/db';

const since = new Date(Date.now() - 30 * 24 * 3600 * 1000); // 近 30 天
const sources = await listEnabledSources('wechat');
console.log(`微信源 ${sources.length} 个，开始采集(近30天)...\n`);

for (const s of sources) {
  try {
    const r = await collect(wechatAdapter, s, { since });
    console.log(`  ${s.name}: fetched=${r.fetched} stored=${r.stored} errors=${r.errors}`);
  } catch (e) {
    console.log(`  ${s.name}: 失败 ${(e as Error).message}`);
  }
  await sleep(3000); // 号间限速，防风控
}
console.log('\n✅ 微信采集完成');
await closePool();
