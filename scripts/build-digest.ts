// 生成并打印"今日 AI 大事"日报(先看效果，下一步再接邮件)。
// 用法：node --env-file=.env --import tsx scripts/build-digest.ts
import { buildAiDigest } from '../server/enrich/digest';
import { closePool } from '../server/storage/db';

const d = await buildAiDigest({ sinceHours: 48 });

console.log(`\n===== 今日 AI 大事 (${d.date})  素材 ${d.count} 条 → ${d.events.length} 个事件 =====\n`);
d.events.forEach((e, i) => {
  console.log(`【${i + 1}】(重要性 ${e.importance}) ${e.title}`);
  console.log(`     ${e.summary}`);
  if (e.sources?.length) console.log(`     来源: ${e.sources.join('  ')}`);
  console.log('');
});
if (!d.events.length) console.log('(没解析出事件，模型原始返回:)\n', d.raw.slice(0, 800));

await closePool();
