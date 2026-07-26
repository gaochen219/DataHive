// 微信公众平台 headless 客户端(自管 cookie jar)。
// 直连 mp.weixin.qq.com(杭州可直连，无需境外代理)。逻辑对照 DataBee 的 proxy-request/login/mp 接口 port。
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36 WAE/1.0';
const MP = 'https://mp.weixin.qq.com';

export interface WechatSessionData {
  token: string;
  cookies: Record<string, string>;
}

export class MpClient {
  private jar = new Map<string, string>();
  token: string | null = null;

  constructor(session?: WechatSessionData) {
    if (session) {
      this.token = session.token;
      for (const [k, v] of Object.entries(session.cookies || {})) this.jar.set(k, v);
    }
  }

  private cookieHeader(): string {
    return [...this.jar.entries()]
      .filter(([, v]) => v && v !== 'EXPIRED')
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private absorb(resp: Response): void {
    for (const sc of resp.headers.getSetCookie()) {
      const first = sc.split(';')[0];
      const idx = first.indexOf('=');
      if (idx > 0) this.jar.set(first.slice(0, idx).trim(), first.slice(idx + 1).trim());
    }
  }

  private headers(): Headers {
    const h = new Headers({
      Referer: MP + '/',
      Origin: MP,
      'User-Agent': UA,
      'Accept-Encoding': 'identity',
    });
    const c = this.cookieHeader();
    if (c) h.set('Cookie', c);
    return h;
  }

  // ── 登录四步 ──
  async startLogin(sid: string): Promise<any> {
    const body = new URLSearchParams({
      userlang: 'zh_CN', redirect_url: '', login_type: '3', sessionid: sid,
      token: '', lang: 'zh_CN', f: 'json', ajax: '1',
    });
    const r = await fetch(`${MP}/cgi-bin/bizlogin?action=startlogin`, { method: 'POST', headers: this.headers(), body });
    this.absorb(r);
    return r.json();
  }

  async getQrCode(): Promise<Buffer> {
    const r = await fetch(`${MP}/cgi-bin/scanloginqrcode?action=getqrcode&random=${Date.now()}`, { headers: this.headers() });
    this.absorb(r);
    return Buffer.from(await r.arrayBuffer());
  }

  async ask(): Promise<any> {
    const r = await fetch(`${MP}/cgi-bin/scanloginqrcode?action=ask&token=&lang=zh_CN&f=json&ajax=1`, { headers: this.headers() });
    this.absorb(r);
    return r.json();
  }

  async bizLogin(): Promise<{ token: string }> {
    const body = new URLSearchParams({
      userlang: 'zh_CN', redirect_url: '', cookie_forbidden: '0', cookie_cleaned: '0',
      plugin_used: '0', login_type: '3', token: '', lang: 'zh_CN', f: 'json', ajax: '1',
    });
    const r = await fetch(`${MP}/cgi-bin/bizlogin?action=login`, { method: 'POST', headers: this.headers(), body });
    this.absorb(r);
    const data = await r.json();
    const redirect = data?.redirect_url;
    if (!redirect) throw new Error('bizlogin 无 redirect_url: ' + JSON.stringify(data).slice(0, 200));
    const token = new URL('http://localhost' + redirect).searchParams.get('token');
    if (!token) throw new Error('无法从 redirect_url 提取 token');
    this.token = token;
    return { token };
  }

  session(): WechatSessionData {
    return { token: this.token!, cookies: Object.fromEntries(this.jar) };
  }

  // ── 搜号 / 拉文章列表 ──
  async searchBiz(keyword: string, begin = 0, count = 5): Promise<any> {
    const q = new URLSearchParams({
      action: 'search_biz', begin: String(begin), count: String(count), query: keyword,
      token: this.token!, lang: 'zh_CN', f: 'json', ajax: '1',
    });
    const r = await fetch(`${MP}/cgi-bin/searchbiz?${q}`, { headers: this.headers() });
    return r.json();
  }

  async appmsgPublish(fakeid: string, begin = 0, count = 20): Promise<any> {
    const q = new URLSearchParams({
      sub: 'list', search_field: 'null', begin: String(begin), count: String(count), query: '',
      fakeid, type: '101_1', free_publish_type: '1', sub_action: 'list_ex',
      token: this.token!, lang: 'zh_CN', f: 'json', ajax: '1',
    });
    const r = await fetch(`${MP}/cgi-bin/appmsgpublish?${q}`, { headers: this.headers() });
    return r.json();
  }
}
