// 把公众号名字解析成 fakeid。
// 用法：node --import tsx scripts/wechat-resolve.ts 号名1 号名2 ...
import { setTimeout as sleep } from 'node:timers/promises';
import { MpClient } from '../server/collect/adapters/wechat/mp-client';
import { loadSession } from '../server/collect/adapters/wechat/session';

const names = process.argv.slice(2);
if (!names.length) {
  console.error('用法: node --import tsx scripts/wechat-resolve.ts 号名1 号名2 ...');
  process.exit(1);
}
const sess = loadSession();
if (!sess) {
  console.error('未登录，请先运行 scripts/wechat-login.ts');
  process.exit(1);
}
const client = new MpClient(sess);

for (const name of names) {
  try {
    const r = await client.searchBiz(name);
    if (r.base_resp?.ret !== 0) {
      console.log(`${name}\t搜索失败 ret=${r.base_resp?.ret} ${r.base_resp?.err_msg}`);
    } else {
      const list = r.list || [];
      const hit = list.find((x: any) => x.nickname === name) || list[0];
      if (hit) console.log(`${name}\tfakeid=${hit.fakeid}\t(匹配: ${hit.nickname})`);
      else console.log(`${name}\t无结果`);
    }
  } catch (e) {
    console.log(`${name}\t异常: ${(e as Error).message}`);
  }
  await sleep(3000); // 限速
}
