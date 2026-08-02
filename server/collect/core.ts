// 采集内核 · 编排流程：fetch → (fetchDetail) → 正文快照入 OSS → 元数据 upsert 入 RDS
// 与具体来源无关。加新数据源=写一个实现 SourceAdapter 的适配器，这里不用改。
import { upsertContentItem, makeContentSn, ossKeyForSnapshot, type ContentItem } from '../storage/repo';
import { putObject } from '../storage/oss';
import type { SourceAdapter, SourceConfig, RawItem } from './types';

export interface CollectResult {
  fetched: number;
  stored: number;
  errors: number;
}

async function* toAsyncIterable(
  x: Promise<RawItem[]> | AsyncIterable<RawItem>,
): AsyncIterable<RawItem> {
  if (typeof (x as any)[Symbol.asyncIterator] === 'function') {
    yield* x as AsyncIterable<RawItem>;
    return;
  }
  for (const it of await (x as Promise<RawItem[]>)) yield it;
}

export async function collect(
  adapter: SourceAdapter,
  source: SourceConfig,
  opts: { since?: Date | null } = {},
): Promise<CollectResult> {
  const res: CollectResult = { fetched: 0, stored: 0, errors: 0 };

  for await (let item of toAsyncIterable(adapter.fetchList(source, opts.since ?? null))) {
    res.fetched++;
    try {
      if (adapter.fetchDetail) item = await adapter.fetchDetail(item, source);

      const sn = makeContentSn(adapter.type, item.url);

      // 正文 HTML 快照 → OSS，DB 只留 key 指针
      let ossKey: string | null = null;
      if (item.html) {
        ossKey = ossKeyForSnapshot(adapter.type, source.source_id, item.publishedAt ?? new Date(), sn);
        await putObject(ossKey, item.html, { contentType: 'text/html; charset=utf-8' });
      }

      const row: ContentItem = {
        content_sn: sn,
        source_type: adapter.type,
        source_id: source.source_id ?? null,
        source_name: source.name ?? null,
        title: item.title,
        author: item.author ?? null,
        url: item.url,
        published_at: item.publishedAt ?? null,
        summary: item.summary ?? null,
        category: item.category ?? null,
        tags: item.tags ?? null,
        lang: item.lang ?? null,
        read_count: item.metrics?.read ?? null,
        like_count: item.metrics?.like ?? null,
        share_count: item.metrics?.share ?? null,
        comment_count: item.metrics?.comment ?? null,
        content_oss_key: ossKey,
        content_text: item.text ?? null,
        image_url: item.image ?? null,
        status: 1,
      };
      await upsertContentItem(row);
      res.stored++;
    } catch (e) {
      res.errors++;
      console.error('[collect] item failed:', (e as Error)?.message, '·', item?.url);
    }
  }
  return res;
}
