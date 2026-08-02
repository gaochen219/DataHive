// 采集单个指定的源(按 source_id)。
// 用法：node --env-file=.env --import tsx scripts/collect-source.ts <source_id>
import { collect } from '../server/collect/core';
import { rssAdapter } from '../server/collect/adapters/rss';
import { wechatAdapter } from '../server/collect/adapters/wechat';
import { getSource } from '../server/collect/sources';
import { closePool } from '../server/storage/db';

const ADAPTERS: Record<string, any> = { rss: rssAdapter, wechat: wechatAdapter };

const id = process.argv[2];
if (!id) {
  console.error('用法: node --env-file=.env --import tsx scripts/collect-source.ts <source_id>');
  process.exit(1);
}
const s = await getSource(id);
if (!s) {
  console.error('源不存在:', id);
  process.exit(1);
}
const adapter = ADAPTERS[s.source_type];
if (!adapter) {
  console.error('无对应 adapter:', s.source_type);
  process.exit(1);
}
const r = await collect(adapter, s, { since: new Date(Date.now() - 30 * 86400000) });
console.log(`${s.name}:`, JSON.stringify(r));
await closePool();
