// 加工层 · DeepSeek 客户端(OpenAI 兼容)
// 凭据从环境变量读取(DEEPSEEK_API_KEY)，绝不硬编码。
export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function deepseekChat(
  messages: ChatMsg[],
  opts: { model?: string; temperature?: number; json?: boolean } = {},
): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  const base = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  if (!key) throw new Error('[enrich] 缺少 DEEPSEEK_API_KEY 环境变量');

  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: opts.model || 'deepseek-chat',
      messages,
      temperature: opts.temperature ?? 0.3,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!resp.ok) {
    throw new Error(`DeepSeek ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? '';
}
