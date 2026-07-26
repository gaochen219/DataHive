// 微信公众平台扫码登录(headless)。
// 用法：node --import tsx scripts/wechat-login.ts
// 会在 cwd 下生成 .wechat-qr.png(扫码用) 和 .wechat-session.json(登录态)。
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { MpClient } from '../server/collect/adapters/wechat/mp-client';
import { saveSession, sessionFile } from '../server/collect/adapters/wechat/session';

const client = new MpClient();
const sid = 'datahive-' + Date.now();

console.log('1) startlogin ...');
await client.startLogin(sid);

console.log('2) 获取二维码 ...');
const qr = await client.getQrCode();
const qrPath = join(process.cwd(), '.wechat-qr.png');
writeFileSync(qrPath, qr);
console.log(`   二维码已保存: ${qrPath} (${qr.length} bytes)`);
console.log('   >>> 请用【公众号管理员微信】扫码并确认 <<<');

const deadline = Date.now() + 210000; // 3.5 分钟
let confirmed = false;
while (Date.now() < deadline) {
  await sleep(2500);
  let status: number | undefined;
  try {
    status = (await client.ask()).status;
  } catch (e) {
    console.log('   ask 出错，重试...', (e as Error).message);
    continue;
  }
  process.stdout.write(`   ask status=${status}\n`);
  if (status === 1) {
    confirmed = true;
    break;
  }
}

if (!confirmed) {
  console.error('❌ 超时未确认，请重跑');
  process.exit(1);
}

console.log('3) bizlogin 换取 token ...');
const { token } = await client.bizLogin();
saveSession(client.session());
console.log(`✅ 登录成功！token=${token.slice(0, 6)}...  会话已保存: ${sessionFile()}`);
