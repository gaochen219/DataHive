// DataHive 存储层 · content_item 数据访问(真 upsert + 查询)
import { createHash } from 'node:crypto';
import { query } from './db';

export interface ContentItem {
  content_sn: string;
  source_type: string;
  source_id?: string | null;
  source_name?: string | null;
  title: string;
  author?: string | null;
  url: string;
  published_at?: string | Date | null;
  summary?: string | null;
  category?: string | null;
  tags?: string | null;
  lang?: string | null;
  read_count?: number | null;
  like_count?: number | null;
  share_count?: number | null;
  comment_count?: number | null;
  content_oss_key?: string | null;
  content_text?: string | null;
  status?: number;
}

// 去重键：同一来源+URL 唯一。改 URL/改名不影响(以 source_type::url 为准)。
export function makeContentSn(sourceType: string, url: string): string {
  return createHash('sha256').update(`${sourceType}::${url}`).digest('hex').slice(0, 40);
}

// OSS 正文快照 key 规范：datahive/{source_type}/{source_id}/{yyyymm}/{sn}/index.html
export function ossKeyForSnapshot(
  sourceType: string,
  sourceId: string | null | undefined,
  publishedAt: Date,
  sn: string,
): string {
  const ym = `${publishedAt.getUTCFullYear()}${String(publishedAt.getUTCMonth() + 1).padStart(2, '0')}`;
  return `datahive/${sourceType}/${sourceId || 'unknown'}/${ym}/${sn}/index.html`;
}

// 真 upsert：按 content_sn 唯一键，存在则更新可变字段
export async function upsertContentItem(item: ContentItem): Promise<void> {
  const sql = `
    INSERT INTO content_item
      (content_sn, source_type, source_id, source_name, title, author, url,
       published_at, summary, category, tags, lang,
       read_count, like_count, share_count, comment_count,
       content_oss_key, content_text, status, fetched_at)
    VALUES (?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?, ?,?,?, NOW())
    ON DUPLICATE KEY UPDATE
      source_name=VALUES(source_name), title=VALUES(title), author=VALUES(author),
      published_at=VALUES(published_at), summary=VALUES(summary),
      category=VALUES(category), tags=VALUES(tags), lang=VALUES(lang),
      read_count=VALUES(read_count), like_count=VALUES(like_count),
      share_count=VALUES(share_count), comment_count=VALUES(comment_count),
      content_oss_key=VALUES(content_oss_key), content_text=VALUES(content_text),
      status=VALUES(status), fetched_at=NOW()`;
  await query(sql, [
    item.content_sn, item.source_type, item.source_id ?? null, item.source_name ?? null,
    item.title, item.author ?? null, item.url,
    item.published_at ?? null, item.summary ?? null, item.category ?? null,
    item.tags ?? null, item.lang ?? null,
    item.read_count ?? null, item.like_count ?? null, item.share_count ?? null, item.comment_count ?? null,
    item.content_oss_key ?? null, item.content_text ?? null, item.status ?? 1,
  ]);
}

export async function getByContentSn(sn: string): Promise<any | null> {
  const rows = await query<any[]>('SELECT * FROM content_item WHERE content_sn=? LIMIT 1', [sn]);
  return rows[0] ?? null;
}

// 列表查询(供前端)。limit/offset 已做整数消毒后内联，规避 mysql2 prepared LIMIT 占位符问题。
export async function listContent(opts: {
  sourceType?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<any[]> {
  const limit = Math.max(1, Math.min(Math.floor(opts.limit ?? 50), 200));
  const offset = Math.max(0, Math.floor(opts.offset ?? 0));
  const where = opts.sourceType ? 'WHERE source_type=?' : '';
  const params = opts.sourceType ? [opts.sourceType] : [];
  return query<any[]>(
    `SELECT id, content_sn, source_type, source_name, title, author, url, published_at,
            read_count, like_count, content_oss_key, fetched_at
     FROM content_item ${where}
     ORDER BY published_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
}
