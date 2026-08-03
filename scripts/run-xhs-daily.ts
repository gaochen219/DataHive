// 小红书每日任务：取疗愈内容 → 笔记 → 封面 + 正文内容图(书感) → 草稿页 → 传OSS → 微信推链接。
// 用法：node --env-file=.env --import tsx scripts/run-xhs-daily.ts [篇数=5]
import { writeFileSync, mkdirSync } from 'node:fs';
import { recentHealingItems, makeXhsNote, markDrafted } from '../server/enrich/xhs-note';
import { makeCover } from '../server/cover';
import { renderContentPages } from '../server/cover/content-page';
import { buildDraftPage, type DraftCard } from '../server/deliver/draft-page';
import { putObject, getSignedUrl } from '../server/storage/oss';
import { pushWeChat } from '../server/deliver/serverchan';
import { closePool } from '../server/storage/db';

const N = Number(process.argv[2]) || 5;
const OFFSET = Number(process.argv[3]) || 0; // 跳过前 N 篇(避开已发的)
const date = new Date().toISOString().slice(0, 10);
const daySeed = Math.floor(Date.now() / 86400000);
const FOOTER = '@山海与书 · 每日治愈';
const OUT = '/opt/datahive/xhs-out';
mkdirSync(OUT, { recursive: true });

const items = await recentHealingItems(N, OFFSET);
console.log(`取 ${items.length} 篇疗愈内容，生成笔记+封面+正文图...`);

const cards: DraftCard[] = [];
const usedSns: string[] = [];
for (let i = 0; i < items.length; i++) {
  const note = await makeXhsNote(items[i]);
  if (!note) {
    console.log('  跳过(生成失败):', items[i].title);
    continue;
  }
  usedSns.push(items[i].content_sn);
  const cover = await makeCover({
    quote: note.quote,
    attribution: note.attribution,
    footer: FOOTER,
    seed: daySeed + i,
    imageUrl: items[i].image_url,
  });
  const content = await renderContentPages(note.body, { footer: FOOTER, seed: daySeed + i });

  const images = [
    { b64: cover.png.toString('base64'), name: `${date}-${i + 1}-封面`, label: '封面' },
    ...content.pngs.map((p, pi) => ({
      b64: p.toString('base64'),
      name: `${date}-${i + 1}-正文${pi + 1}`,
      label: content.pngs.length > 1 ? `正文${pi + 1}` : '正文',
    })),
  ];
  cards.push({ title: note.title, tags: note.tags, attribution: note.attribution, images });

  writeFileSync(`${OUT}/${i + 1}-封面.png`, cover.png);
  content.pngs.forEach((p, pi) => writeFileSync(`${OUT}/${i + 1}-正文${pi + 1}.png`, p));
  console.log(`  ✔ [封面:${cover.styleName} · 正文:${content.paperName}×${content.pngs.length}] ${note.title}`);
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
const url = getSignedUrl(key, 172800);

await pushWeChat(
  `山海与书·草稿·${date}(${cards.length}篇)`,
  `今日 ${cards.length} 篇草稿(封面+正文图)已就绪 🌿\n\n👉 [点开 · 下载图 · 复制标题标签](${url})\n\n电脑打开：下载全部图片直接发；标题+标签复制到正文框。\n(链接 48 小时有效)`,
);
await markDrafted(usedSns); // 标记本批已出草稿，下次自动跳过
console.log(`✅ 已推送微信(已标记 ${usedSns.length} 篇为已出)。草稿页：${url}`);
await closePool();
