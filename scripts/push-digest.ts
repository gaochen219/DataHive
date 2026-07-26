// 生成今日 AI 大事并推送到微信(Server酱)。
// 用法：node --env-file=.env --import tsx scripts/push-digest.ts
import { buildAiDigest } from '../server/enrich/digest';
import { digestToMarkdown } from '../server/deliver/format';
import { pushWeChat } from '../server/deliver/serverchan';
import { closePool } from '../server/storage/db';

const d = await buildAiDigest({ sinceHours: 48 });
console.log(`生成 ${d.events.length} 个事件，推送到微信...`);

if (d.events.length) {
  await pushWeChat(`今日AI大事·${d.date}(${d.events.length}条)`, digestToMarkdown(d));
  console.log('✅ 已推送到微信');
} else {
  await pushWeChat('DataHive AI日报', '今日暂无新的 AI 大事。');
  console.log('无事件，已推送提示');
}
await closePool();
