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

const SYS = `你是专攻小红书"疗愈成长/文摘"赛道的爆款操盘手。给你一篇外文(英文)的成长/治愈/读书类文章的标题和摘要，请把它改写成一篇能上热门的**中文小红书笔记**。
【标题】≤20字，必须用爆款钩子(任选一种)：制造悬念/反差；戳痛点或身份代入(如"内耗的人"、"30岁才敢承认")；名人背书(如"荣格说：")；数字+承诺(如"存下这7句")；情绪词(破防/狠狠共鸣/戳中无数人)。配1个贴切emoji。
【正文】150-300字：开头1-2句强钩子(提问/金句/反差)；短句短段、多留白；重共鸣、轻说教；可分点便于扫读；结尾一句引导收藏或评论("存下来慢慢看"、"你呢？")；适度emoji。
【金句】从文章提炼或转化1句最戳心的中文短句(≤22字)，用于封面，要让人想收藏。
【出处】原作者/书名/文章，没有就写作者名。
【标签】5个精准小红书话题词(不带#)。
不要翻译腔，像中文母语博主、真诚不做作。以 JSON 返回：{"title","body","quote","attribution","tags":[...]}`;

// 分层标签：LLM精准标签 + 大流量泛标签 + 当前活动话题
const BASE_TAGS = ['情绪疗愈', '自我成长', '治愈系文案', '读书笔记'];
const ACTIVITY_TAGS = ['身边的心理学']; // 小红书当前活动，随时可增改

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
    const llmTags: string[] = Array.isArray(p.tags) ? p.tags : [];
    const tags = [...new Set([...llmTags, ...BASE_TAGS, ...ACTIVITY_TAGS])].slice(0, 10);
    return {
      source_title: item.title,
      source_url: item.url,
      title: p.title,
      body: p.body,
      quote: p.quote || '',
      attribution: p.attribution || '外网好文',
      tags,
    };
  } catch {
    return null;
  }
}

// 取最近的疗愈内容(用于生成笔记)
export async function recentHealingItems(
  limit = 3,
): Promise<Array<{ title: string; summary: string; url: string; image_url: string | null }>> {
  const n = Math.max(1, Math.min(Math.floor(limit), 10));
  return query<any[]>(
    `SELECT title, summary, url, image_url FROM content_item
     WHERE source_id='healing-daily' AND summary IS NOT NULL AND CHAR_LENGTH(summary) > 60
     ORDER BY published_at DESC LIMIT ${n}`,
  );
}
