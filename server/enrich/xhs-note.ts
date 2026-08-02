// 加工层 · 把外文疗愈/成长内容改写成中文小红书笔记
import { query } from '../storage/db';
import { deepseekChat } from './deepseek';

export interface XhsNote {
  source_title: string;
  source_url: string;
  title: string; // 小红书标题
  body: string; // 小红书正文
  quote: string; // 封面金句
  attribution: string; // 出处
  tags: string[]; // 话题标签(不带#)
}

const SYS = `你是资深小红书博主，专做"疗愈成长/文摘"赛道。给你一篇外文(英文)的成长/治愈/读书类文章的标题和摘要，请把它改写成一篇**中文小红书笔记**。要求：
1. 【标题】小红书爆款风，≤20字，有情绪钩子，可带1个emoji；
2. 【正文】温暖治愈口吻，短句短段，适度emoji，有共鸣感，可分点，结尾一句引导收藏/评论；150-300字；
3. 【金句】从文章里提炼或转化出1句最打动人的中文短句(≤25字)，用于封面；
4. 【出处】原作者/书名/文章(有就写，没有就写作者名或"外网好文")；
5. 【标签】3-5个小红书话题标签(不带#)，如 情绪疗愈、自我成长、读书笔记 等。
不要翻译腔，要像中文母语博主写的、真诚不做作。以 JSON 返回：{"title","body","quote","attribution","tags":[...]}`;

export async function makeXhsNote(item: {
  title: string;
  summary: string;
  url: string;
}): Promise<XhsNote | null> {
  const user = `原文标题：${item.title}\n原文摘要：${(item.summary || '').slice(0, 800)}\n\n请改写成小红书笔记 JSON。`;
  const raw = await deepseekChat(
    [
      { role: 'system', content: SYS },
      { role: 'user', content: user },
    ],
    { json: true, temperature: 0.7 },
  );
  try {
    const p = JSON.parse(raw);
    if (!p.title || !p.body) return null;
    return {
      source_title: item.title,
      source_url: item.url,
      title: p.title,
      body: p.body,
      quote: p.quote || '',
      attribution: p.attribution || '外网好文',
      tags: Array.isArray(p.tags) ? p.tags : [],
    };
  } catch {
    return null;
  }
}

// 取最近的疗愈内容(用于生成笔记)
export async function recentHealingItems(limit = 3): Promise<Array<{ title: string; summary: string; url: string }>> {
  const n = Math.max(1, Math.min(Math.floor(limit), 10));
  return query<any[]>(
    `SELECT title, summary, url FROM content_item
     WHERE source_id='healing-daily' AND summary IS NOT NULL AND CHAR_LENGTH(summary) > 60
     ORDER BY published_at DESC LIMIT ${n}`,
  );
}
