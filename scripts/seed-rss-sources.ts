// 把 AI RSS 源写入 source 表(与微信源统一由 source 表管理)。
// 用法：node --env-file=.env --import tsx scripts/seed-rss-sources.ts
import { upsertSource } from '../server/collect/sources';
import { closePool } from '../server/storage/db';

const AI_FEEDS = [
  'https://techcrunch.com/feed/',
  'https://www.theverge.com/rss/index.xml',
  'https://www.wired.com/feed/tag/ai/latest/rss',
  'https://feeds.arstechnica.com/arstechnica/index',
  'https://venturebeat.com/category/ai/feed/',
];
const AI_MATCH =
  '(\\bAI\\b|artificial intelligence|LLM|GPT|OpenAI|Anthropic|Claude|Gemini|machine learning|neural|deep learning|大模型|人工智能|生成式)';

await upsertSource({
  source_type: 'rss',
  source_id: 'ai-daily',
  name: 'AI Daily (RSS)',
  config: { feeds: AI_FEEDS, match: AI_MATCH },
});
console.log('✅ RSS 源 ai-daily 已写入 source 表');
await closePool();
