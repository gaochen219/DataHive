// 通用 RSS/Atom 适配器
// source.config: { feeds: string[], match?: string(正则字符串，匹配 标题+摘要，用于按关键词筛选) }
import Parser from 'rss-parser';
import type { SourceAdapter, SourceConfig, RawItem } from '../types';

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DataHive/0.1)' },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail'],
    ],
  },
});

function extractImage(it: any): string | null {
  if (it.enclosure?.url && /\.(jpg|jpeg|png|webp)/i.test(it.enclosure.url)) return it.enclosure.url;
  if (Array.isArray(it.mediaContent)) {
    for (const m of it.mediaContent) if (m?.$?.url) return m.$.url;
  }
  if (it.mediaThumbnail?.$?.url) return it.mediaThumbnail.$.url;
  const html = it['content:encoded'] || it.content || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

export const rssAdapter: SourceAdapter = {
  type: 'rss',

  async fetchList(source: SourceConfig, since?: Date | null): Promise<RawItem[]> {
    const feeds: string[] = source.config?.feeds ?? [];
    const matchRe = source.config?.match ? new RegExp(source.config.match, 'i') : null;
    const items: RawItem[] = [];

    for (const feedUrl of feeds) {
      try {
        const feed = await parser.parseURL(feedUrl);
        for (const it of feed.items) {
          const link = (it.link || (it as any).guid || '').trim();
          if (!link) continue;

          const pub = it.isoDate ? new Date(it.isoDate) : it.pubDate ? new Date(it.pubDate) : null;
          if (since && pub && pub < since) continue;

          const summary = String(it.contentSnippet || (it as any).summary || '').trim();
          if (matchRe && !matchRe.test(`${it.title ?? ''} ${summary}`)) continue;

          items.push({
            url: link,
            title: (it.title || '(无标题)').trim(),
            author: (it.creator || (it as any).author || feed.title || null) as string | null,
            publishedAt: pub,
            summary: summary ? summary.slice(0, 2000) : null,
            text: summary || null,
            image: extractImage(it),
            raw: { feed: feed.title, categories: it.categories ?? [] },
          });
        }
      } catch (e) {
        console.error('[rss] feed failed:', feedUrl, '·', (e as Error).message);
      }
    }
    return items;
  },
};
