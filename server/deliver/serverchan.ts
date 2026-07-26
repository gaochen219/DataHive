// 投递层 · Server酱(方糖)推送到微信
// 凭据从环境变量 SCT_SENDKEY 读取，绝不硬编码。
export async function pushWeChat(title: string, markdown: string): Promise<void> {
  const key = process.env.SCT_SENDKEY;
  if (!key) throw new Error('[deliver] 缺少 SCT_SENDKEY 环境变量');

  const resp = await fetch(`https://sctapi.ftqq.com/${key}.send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ title: title.slice(0, 32), desp: markdown }),
  });
  const data: any = await resp.json().catch(() => ({}));
  if (data.code !== 0) {
    throw new Error(`Server酱推送失败: ${JSON.stringify(data).slice(0, 200)}`);
  }
}
