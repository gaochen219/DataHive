// 预览小红书草稿(打印完整内容，不推送)。
// 用法：node --env-file=.env --import tsx scripts/preview-xhs.ts [篇数=2]
import { recentHealingItems, makeXhsNote } from '../server/enrich/xhs-note';
import { closePool } from '../server/storage/db';

const N = Number(process.argv[2]) || 2;
const items = await recentHealingItems(N);
for (const it of items) {
  const note = await makeXhsNote(it);
  if (!note) continue;
  console.log('==================================================');
  console.log('【标题】' + note.title);
  console.log('【正文】\n' + note.body);
  console.log('【封面金句】' + note.quote);
  console.log('【出处】' + note.attribution + '　【标签】' + note.tags.map((t) => '#' + t).join(' '));
  console.log('【原文】' + note.source_url);
}
await closePool();
