// 微信公众号适配器
// source.config: { fakeid: string, maxPages?: number, delayMs?: number }
import { setTimeout as sleep } from 'node:timers/promises';
import type { SourceAdapter, SourceConfig, RawItem } from './types';
import { MpClient } from './wechat/mp-client';
import { loadSession } from './wechat/session';

export const wechatAdapter: SourceAdapter = {
  type: 'wechat',

  async fetchList(source: SourceConfig, since?: Date | null): Promise<RawItem[]> {
    const sess = loadSession();
    if (!sess) throw new Error('[wechat] 未登录，请先运行 scripts/wechat-login.ts 扫码登录');

    const fakeid = source.config?.fakeid;
    if (!fakeid) throw new Error('[wechat] source.config.fakeid 缺失');

    const client = new MpClient(sess);
    const pageSize = 20;
    const maxPages = source.config?.maxPages ?? 3;
    const delayMs = source.config?.delayMs ?? 3000; // 限速防风控
    const items: RawItem[] = [];

    for (let page = 0; page < maxPages; page++) {
      const resp = await client.appmsgPublish(fakeid, page * pageSize, pageSize);
      if (resp.base_resp?.ret !== 0) {
        if (resp.base_resp?.ret === 200003) throw new Error('[wechat] 登录态失效，请重新扫码登录');
        throw new Error(`[wechat] appmsgpublish ret=${resp.base_resp?.ret} ${resp.base_resp?.err_msg}`);
      }

      const publishPage = JSON.parse(resp.publish_page);
      const list = (publishPage.publish_list || []).filter((x: any) => x.publish_info);
      if (!list.length) break;

      let reachedOld = false;
      for (const it of list) {
        const info = JSON.parse(it.publish_info);
        for (const a of info.appmsgex || []) {
          if (!a.link) continue;
          const pub = a.create_time ? new Date(a.create_time * 1000) : null;
          if (since && pub && pub < since) {
            reachedOld = true;
            continue;
          }
          items.push({
            url: a.link,
            title: (a.title || '(无标题)').trim(),
            author: a.author_name || source.name || null,
            publishedAt: pub,
            summary: a.digest || null,
            text: a.digest || null,
            lang: 'zh',
            raw: { aid: a.aid, cover: a.cover, item_show_type: a.item_show_type },
          });
        }
      }
      if (reachedOld) break;
      if (page < maxPages - 1) await sleep(delayMs);
    }
    return items;
  },
};
