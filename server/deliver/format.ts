// 投递层 · 把日报格式化成微信/邮件用的 Markdown
import type { Digest } from '../enrich/digest';

export function digestToMarkdown(d: Digest): string {
  const lines = [`### 今日 AI 大事 · ${d.date}`, `> 素材 ${d.count} 条 → ${d.events.length} 个事件`, ''];
  d.events.forEach((e, i) => {
    const stars = '⭐'.repeat(Math.max(1, Math.min(5, e.importance || 3)));
    lines.push(`**${i + 1}. ${e.title}** ${stars}`);
    lines.push(e.summary);
    if (e.sources?.length) lines.push(e.sources.map((s) => `[原文](${s})`).join(' · '));
    lines.push('');
  });
  return lines.join('\n');
}
