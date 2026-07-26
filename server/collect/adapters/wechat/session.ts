// 微信登录态的本地持久化(存 token + 会话 cookies)。
// 文件默认在 cwd 下 .wechat-session.json(已 gitignore)，是敏感凭据，权限 600。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { WechatSessionData } from './mp-client';

export interface StoredSession extends WechatSessionData {
  savedAt: number;
}

function file(): string {
  return process.env.WECHAT_SESSION_FILE || join(process.cwd(), '.wechat-session.json');
}

export function sessionFile(): string {
  return file();
}

export function saveSession(s: WechatSessionData): void {
  writeFileSync(file(), JSON.stringify({ ...s, savedAt: Date.now() }), { mode: 0o600 });
}

export function loadSession(): StoredSession | null {
  const f = file();
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}
