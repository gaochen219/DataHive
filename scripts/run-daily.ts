// 每日任务：采集(RSS+微信) → 生成 AI 日报 → 推送微信。由 cron 每天 8:00 触发。
// 用法：node --env-file=.env --import tsx scripts/run-daily.ts
import { setTimeout as sleep } from 'node:timers/promises';
import { collect } from '../server/collect/core';
import { rssAdapter } from '../server/collect/adapters/rss';
import { wechatAdapter } from '../server/collect/adapters/wechat';
import { listEnabledSources } from '../server/collect/sources';
import { buildAiDigest } from '../server/enrich/digest';
import { digestToMarkdown } from '../server/deliver/format';
import { pushWeChat } from '../server/deliver/serverchan';
import { closePool } from '../server/storage/db';

const log = (...a: any[]) => console.log(new Date().toISOString(), ...a);
const DAY = 86400000;
let wechatExpired = false;

// 1) RSS 采集
for (const s of await listEnabledSources('rss')) {
  try {
    log('rss', s.name, await collect(rssAdapter, s, { since: new Date(Date.now() - 3 * DAY) }));
  } catch (e) {
    log('rss 失败', s.name, (e as Error).message);
  }
}

// 2) 微信采集
for (const s of await listEnabledSources('wechat')) {
  try {
    log('wechat', s.name, await collect(wechatAdapter, s, { since: new Date(Date.now() - 7 * DAY) }));
  } catch (e) {
    const msg = (e as Error).message;
    log('wechat 失败', s.name, msg);
    if (/登录态失效|200003/.test(msg)) wechatExpired = true;
  }
  await sleep(3000); // 号间限速
}

// 3) 生成日报
const d = await buildAiDigest({ sinceHours: 48 });
log('digest', d.events.length, '事件');

// 4) 推送微信
const warn = wechatExpired ? '> ⚠️ 微信登录态已过期，公众号今日未采集，请让 Claude 帮你重新扫码登录。\n\n' : '';
if (d.events.length) {
  await pushWeChat(`今日AI大事·${d.date}(${d.events.length}条)`, warn + digestToMarkdown(d));
} else {
  await pushWeChat('DataHive AI日报', warn + '今日暂无新的 AI 大事。');
}
log('已推送微信');
await closePool();
