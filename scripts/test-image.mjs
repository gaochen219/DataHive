// 测试：能否从疗愈源的 RSS 里取到配图、并从 ECS 下载
import Parser from 'rss-parser';
const p = new Parser({
  timeout: 15000,
  customFields: { item: [['media:content', 'mediaContent', { keepArray: true }], ['media:thumbnail', 'mediaThumbnail']] },
});
const feeds = [
  'https://www.themarginalian.org/feed/',
  'https://psyche.co/feed',
  'https://tinybuddha.com/feed/',
  'https://www.positive.news/feed/',
  'https://markmanson.net/feed',
];
for (const fu of feeds) {
  try {
    const f = await p.parseURL(fu);
    const it = f.items[0];
    let url = it.enclosure?.url;
    if (!url && Array.isArray(it.mediaContent)) url = it.mediaContent[0]?.$?.url;
    if (!url && it.mediaThumbnail?.$?.url) url = it.mediaThumbnail.$.url;
    if (!url) {
      const html = it['content:encoded'] || it.content || '';
      const m = html.match(/<img[^>]+src=["']([^"']+)/i);
      if (m) url = m[1];
    }
    let dl = 'n/a';
    if (url) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
        const b = Buffer.from(await r.arrayBuffer());
        dl = `${r.status} ${(b.length / 1024).toFixed(0)}KB ${r.headers.get('content-type')}`;
      } catch (e) {
        dl = 'DL失败 ' + e.message;
      }
    }
    console.log(`【${f.title}】\n  图: ${(url || '无').slice(0, 70)}\n  下载: ${dl}`);
  } catch (e) {
    console.log(`${fu} feed失败 ${e.message}`);
  }
}
