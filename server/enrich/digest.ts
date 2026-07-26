// 加工层 · 生成"今日 AI 大事"日报
// 从 content_item 取最近条目 → DeepSeek 去重/聚类成事件/摘要/排序 → 结构化日报
import { query } from '../storage/db';
import { deepseekChat } from './deepseek';

export interface DigestEvent {
  title: string; // 中文事件标题
  summary: string; // 2-3 句中文要点
  importance: number; // 1-5
  sources: string[]; // 代表性原文 URL
}

export interface Digest {
  date: string;
  count: number;
  events: DigestEvent[];
  raw: string; // 模型原始返回(排查用)
}

const SYS_PROMPT = `你是资深 AI 行业分析师。给你一批最近的 AI 相关新闻条目，请：
1) 去重：把讲同一件事的条目合并成一个"事件"；
2) 只保留真正重要的 AI 事件（最多 10 个），把噪音/蹭热点/无关的丢弃；
3) 按对 AI 从业者与决策者的重要性排序（重要在前）；
4) 每个事件给：一句中文标题、2-3 句中文要点摘要、重要性分(1-5)、代表性原文 URL(1-2 个)。
只以 JSON 返回，格式：{"events":[{"title":"","summary":"","importance":5,"sources":["url"]}]}`;

export async function buildAiDigest(opts: { sinceHours?: number; max?: number } = {}): Promise<Digest> {
  const sinceHours = opts.sinceHours ?? 48;
  const rows = await query<any[]>(
    `SELECT title, source_name, url, summary, DATE_FORMAT(published_at,'%Y-%m-%d %H:%i') AS pub
     FROM content_item
     WHERE source_type IN ('rss','wechat') AND published_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     ORDER BY published_at DESC LIMIT 60`,
    [sinceHours],
  );

  const list = rows
    .map((r, i) => `${i + 1}. [${r.pub}] ${r.title}\n   摘要:${(r.summary || '').slice(0, 220)}\n   URL:${r.url}`)
    .join('\n');

  const user = `以下是最近 ${sinceHours} 小时采集到的 AI 新闻条目(共 ${rows.length} 条)：\n\n${list}\n\n请输出"今日 AI 大事"JSON。`;

  const raw = await deepseekChat(
    [
      { role: 'system', content: SYS_PROMPT },
      { role: 'user', content: user },
    ],
    { json: true, temperature: 0.2 },
  );

  let events: DigestEvent[] = [];
  try {
    events = JSON.parse(raw).events ?? [];
  } catch {
    /* 保留 raw 供排查 */
  }
  events.sort((a, b) => (b.importance || 0) - (a.importance || 0));

  return { date: new Date().toISOString().slice(0, 10), count: rows.length, events, raw };
}
