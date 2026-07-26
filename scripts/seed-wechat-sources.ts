// 把 AI/科技前沿公众号写入 source 表。
// 用法：node --env-file=.env --import tsx scripts/seed-wechat-sources.ts
import { upsertSource } from '../server/collect/sources';
import { closePool } from '../server/storage/db';

const ACCOUNTS = [
  { name: '数字生命卡兹克', fakeid: 'MzIyMzA5NjEyMA==' },
  { name: 'DeepTech深科技', fakeid: 'MzA3NTIyODUzNA==' },
  { name: 'PaperAgent', fakeid: 'Mzk0MTYzMzMxMA==' },
  { name: 'Andy730', fakeid: 'Mzg3MDY0OTQ0NA==' },
  { name: '逛逛GitHub', fakeid: 'MzUxNjg4NDEzNA==' },
  { name: 'Tech星球', fakeid: 'MzU5MTczNjIyNA==' },
  // AI潮局面 待确认(搜索匹配到"椒图AI"), 确认后再加
];

for (const a of ACCOUNTS) {
  await upsertSource({
    source_type: 'wechat',
    source_id: a.fakeid,
    name: a.name,
    config: { fakeid: a.fakeid, maxPages: 2, delayMs: 3000 },
  });
  console.log('  ✔', a.name);
}
console.log(`已写入 ${ACCOUNTS.length} 个微信源`);
await closePool();
