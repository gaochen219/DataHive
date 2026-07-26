// 采集"AI 每日大事"(RSS)。
// 用法：node --env-file=.env --import tsx scripts/collect-ai.ts
import { collect } from '../server/collect/core';
import { rssAdapter } from '../server/collect/adapters/rss';
import { closePool } from '../server/storage/db';
import type { SourceConfig } from '../server/collect/types';

// 第一版源：从杭州可直连的 AI/科技 RSS（个别不通的会自动跳过，非致命）
const AI_FEEDS = [
  'https://techcrunch.com/feed/',
  'https://www.theverge.com/rss/index.xml',
  'https://www.wired.com/feed/tag/ai/latest/rss',
  'https://feeds.arstechnica.com/arstechnica/index',
  'https://venturebeat.com/category/ai/feed/',
];

// 关键词过滤：只留 AI 相关条目（在 加工层 之前先粗筛）
const AI_MATCH =
  '(\\bAI\\b|artificial intelligence|LLM|GPT|OpenAI|Anthropic|Claude|Gemini|machine learning|neural|deep learning|大模型|人工智能|生成式)';

const source: SourceConfig = {
  source_type: 'rss',
  source_id: 'ai-daily',
  name: 'AI Daily',
  config: { feeds: AI_FEEDS, match: AI_MATCH },
};

// 只要最近 3 天
const since = new Date(Date.now() - 3 * 24 * 3600 * 1000);

const res = await collect(rssAdapter, source, { since });
console.log('✅ 采集结果:', JSON.stringify(res));
await closePool();
