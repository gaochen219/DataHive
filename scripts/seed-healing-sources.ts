// 把「疗愈成长」外网源写入 source 表。
// 用法：node --env-file=.env --import tsx scripts/seed-healing-sources.ts
import { upsertSource } from '../server/collect/sources';
import { closePool } from '../server/storage/db';

// 从杭州 ECS 实测可直连的优质疗愈/成长源（编辑类站点，未被墙）
const FEEDS = [
  'https://www.themarginalian.org/feed/', // Maria Popova · 读书/哲思/治愈
  'https://fs.blog/feed/', // Farnam Street · 思维/成长
  'https://tinybuddha.com/feed/', // Tiny Buddha · 治愈/正念
  'https://www.positive.news/feed/', // Positive News · 正能量故事
  'https://markmanson.net/feed', // Mark Manson · 成长(犀利)
  'https://psyche.co/feed', // Psyche · 心理成长美文
  'https://aeon.co/feed.rss', // Aeon · 深度随笔(哲学/科学/文化)
  'https://www.raptitude.com/feed/', // Raptitude · 生活反思/自我觉察
  'https://nesslabs.com/feed', // Ness Labs · 正念/成长/效率
];

await upsertSource({
  source_type: 'rss',
  source_id: 'healing-daily',
  name: '疗愈成长(外网)',
  config: { feeds: FEEDS },
});
console.log('✅ 疗愈源 healing-daily 已写入 source 表');
await closePool();
