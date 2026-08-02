// 生成"疗愈成长"小红书草稿并推送到微信。
// 用法：node --env-file=.env --import tsx scripts/gen-xhs-drafts.ts [篇数=3]
import { recentHealingItems, makeXhsNote } from '../server/enrich/xhs-note';
import { pushWeChat } from '../server/deliver/serverchan';
import { closePool } from '../server/storage/db';

const N = Number(process.argv[2]) || 3;
const items = await recentHealingItems(N);
console.log(`取 ${items.length} 篇疗愈内容，逐篇生成小红书草稿...`);

let md = '';
let ok = 0;
for (const it of items) {
  const note = await makeXhsNote(it);
  if (!note) {
    console.log('  跳过(生成失败):', it.title);
    continue;
  }
  ok++;
  console.log(`  ✔ ${note.title}`);
  md += `## ${ok}. ${note.title}\n\n${note.body}\n\n`;
  md += `**封面金句**：${note.quote}\n\n`;
  md += `**出处**：${note.attribution}　**标签**：${note.tags.map((t) => '#' + t).join(' ')}\n\n`;
  md += `[原文](${note.source_url})\n\n---\n\n`;
}

if (ok) {
  await pushWeChat(`小红书草稿·疗愈(${ok}篇)`, md);
  console.log('✅ 已推送到微信');
} else {
  console.log('无草稿生成');
}
await closePool();
