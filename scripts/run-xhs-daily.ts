// 小红书每日任务：取疗愈内容 → 生成笔记 → 渲染封面(轮换风格) → 出草稿页面 → 传OSS → 微信推链接。
// 用法：node --env-file=.env --import tsx scripts/run-xhs-daily.ts [篇数=5]
import { writeFileSync, mkdirSync } from 'node:fs';
import { recentHealingItems, makeXhsNote } from '../server/enrich/xhs-note';
import { renderCover } from '../server/cover';
import { buildDraftPage, type DraftCard } from '../server/deliver/draft-page';
import { putObject, getSignedUrl } from '../server/storage/oss';
import { pushWeChat } from '../server/deliver/serverchan';
import { closePool } from '../server/storage/db';

const N = Number(process.argv[2]) || 5;
const date = new Date().toISOString().slice(0, 10);
const daySeed = Math.floor(Date.now() / 86400000); // 每天换一组风格起点
const FOOTER = '@你的账号 · 每日治愈';

const items = await recentHealingItems(N);
console.log(`取 ${items.length} 篇疗愈内容，生成笔记+封面...`);
const OUT = '/opt/datahive/xhs-out';
mkdirSync(OUT, { recursive: true });

const cards: DraftCard[] = [];
for (let i = 0; i < items.length; i++) {
  const note = await makeXhsNote(items[i]);
  if (!note) {
    console.log('  跳过(生成失败):', items[i].title);
    continue;
  }
  const { png, styleName } = await renderCover({
    quote: note.quote,
    attribution: note.attribution,
    footer: FOOTER,
    seed: daySeed + i,
  });
  cards.push({
    title: note.title,
    body: note.body,
    quote: note.quote,
    attribution: note.attribution,
    tags: note.tags,
    sourceUrl: note.source_url,
    styleName,
    coverB64: png.toString('base64'),
  });
  writeFileSync(`${OUT}/${i + 1}-${styleName}.png`, png);
  console.log(`  ✔ [${styleName}] ${note.title}`);
}

if (!cards.length) {
  console.log('无草稿');
  await closePool();
  process.exit(0);
}

const html = buildDraftPage(date, cards);
writeFileSync(`${OUT}/${date}.html`, html);
const key = `xhs/drafts/${date}-${Date.now()}.html`;
await putObject(key, html, { contentType: 'text/html; charset=utf-8', disposition: 'inline' });
const url = getSignedUrl(key, 172800); // 48 小时有效

await pushWeChat(
  `小红书草稿·${date}(${cards.length}篇)`,
  `今日 ${cards.length} 篇草稿(含封面)已就绪 🌿\n\n👉 [点开查看 · 复制文案 · 下载封面](${url})\n\n电脑打开最顺：下载封面 + 复制文案，去小红书批量定时发。\n(链接 48 小时有效)`,
);
console.log(`✅ 已推送微信。草稿页：${url}`);
await closePool();
