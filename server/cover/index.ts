// 封面引擎：金句 → SVG → PNG(1080×1440)。6 种文字卡风格，按种子轮换。
import sharp from 'sharp';

const W = 1080, H = 1440;
const SANS = 'Noto Sans CJK SC';
const SERIF = 'Noto Serif CJK SC';

function esc(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 中文按字数折行，优先在标点处断
function wrapCJK(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let s = (text || '').trim();
  while (s.length > maxChars) {
    let cut = maxChars;
    const seg = s.slice(0, maxChars + 1);
    const p = Math.max(seg.lastIndexOf('，'), seg.lastIndexOf('。'), seg.lastIndexOf('、'), seg.lastIndexOf(' '), seg.lastIndexOf('；'));
    if (p >= 4) cut = p + 1;
    lines.push(s.slice(0, cut).replace(/[，、；\s]$/, ''));
    s = s.slice(cut);
  }
  if (s) lines.push(s);
  return lines;
}

interface Style {
  key: string;
  name: string;
  defs?: string;
  bg: string;
  quoteColor: string;
  quoteFont: string;
  quoteWeight: number;
  srcColor: string;
  footColor: string;
  deco?: string;
}

const STYLES: Style[] = [
  {
    key: 'cream', name: '暖米衬线',
    bg: `<rect width="${W}" height="${H}" fill="#efe7d8"/>`,
    quoteColor: '#4a4034', quoteFont: SERIF, quoteWeight: 500, srcColor: '#8a7d6a', footColor: '#a89b86',
  },
  {
    key: 'sage', name: '森系柔绿',
    defs: `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfe8dc"/><stop offset="1" stop-color="#c7d6c0"/></linearGradient>`,
    bg: `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    quoteColor: '#3c4a38', quoteFont: SERIF, quoteWeight: 500, srcColor: '#5c6a54', footColor: '#6f7d66',
    deco: `<text x="96" y="150" font-family="${SANS}" font-size="30" letter-spacing="12" fill="#5c6a5488">SLOW LIVING</text>`,
  },
  {
    key: 'night', name: '夜空深蓝',
    defs: `<radialGradient id="bg" cx="30%" cy="20%" r="120%"><stop offset="0" stop-color="#2a3a5c"/><stop offset="1" stop-color="#141d33"/></radialGradient>`,
    bg: `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    quoteColor: '#eef2f8', quoteFont: SERIF, quoteWeight: 500, srcColor: '#aebbd2', footColor: '#8090a8',
    deco: `<circle cx="760" cy="250" r="4" fill="#ffffff88"/><circle cx="880" cy="420" r="3" fill="#ffffff66"/><circle cx="660" cy="330" r="3" fill="#ffffff55"/>`,
  },
  {
    key: 'creampink', name: '奶油渐变',
    defs: `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9d6"/><stop offset="0.55" stop-color="#ffd9d0"/><stop offset="1" stop-color="#f7c9d9"/></linearGradient>`,
    bg: `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    quoteColor: '#7a4a48', quoteFont: SERIF, quoteWeight: 700, srcColor: '#9a6a68', footColor: '#b5807e',
  },
  {
    key: 'paper', name: '纸质书摘',
    bg: `<rect width="${W}" height="${H}" fill="#faf8f3"/><rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="#e7e2d6" stroke-width="2"/>`,
    quoteColor: '#242424', quoteFont: SERIF, quoteWeight: 500, srcColor: '#6a6a6a', footColor: '#9a9a9a',
    deco: `<text x="120" y="380" font-family="${SERIF}" font-size="200" fill="#c9b48a">“</text>`,
  },
  {
    key: 'magazine', name: '杂志编辑',
    bg: `<rect width="${W}" height="${H}" fill="#1c1c1c"/>`,
    quoteColor: '#f2f2f2', quoteFont: SANS, quoteWeight: 700, srcColor: '#999999', footColor: '#777777',
    deco: `<text x="100" y="160" font-family="${SANS}" font-size="30" letter-spacing="10" fill="#e8b04b">SELF-GROWTH</text><rect x="100" y="${H - 200}" width="60" height="4" fill="#e8b04b"/>`,
  },
];

export function pickStyle(seed: number): Style {
  return STYLES[((seed % STYLES.length) + STYLES.length) % STYLES.length];
}
export const styleNames = STYLES.map((s) => s.name);

export async function renderCover(o: {
  quote: string;
  attribution: string;
  footer: string;
  seed: number;
}): Promise<{ png: Buffer; styleName: string }> {
  const style = pickStyle(o.seed);
  const lines = wrapCJK(o.quote, 9);
  const fs = lines.length <= 2 ? 92 : lines.length === 3 ? 78 : 64;
  const lh = fs * 1.5;
  const blockH = lines.length * lh;
  let y = H / 2 - blockH / 2 + fs * 0.8;
  const quoteSvg = lines
    .map((l) => {
      const t = `<text x="${W / 2}" y="${y.toFixed(0)}" font-family="${style.quoteFont}" font-weight="${style.quoteWeight}" font-size="${fs}" fill="${style.quoteColor}" text-anchor="middle">${esc(l)}</text>`;
      y += lh;
      return t;
    })
    .join('');
  const srcY = (H / 2 + blockH / 2 + 90).toFixed(0);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>${style.defs || ''}</defs>
  ${style.bg}
  ${style.deco || ''}
  ${quoteSvg}
  <text x="${W / 2}" y="${srcY}" font-family="${SANS}" font-size="40" fill="${style.srcColor}" text-anchor="middle">${esc(o.attribution)}</text>
  <text x="${W / 2}" y="${H - 96}" font-family="${SANS}" font-size="30" fill="${style.footColor}" text-anchor="middle">${esc(o.footer)}</text>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return { png, styleName: style.name };
}

// 照片背景封面：源图裁成 3:4 + 暗纱蒙层 + 白字
export async function renderPhotoCover(
  imageBuffer: Buffer,
  o: { quote: string; attribution: string; footer: string },
): Promise<Buffer> {
  const bg = await sharp(imageBuffer).resize(W, H, { fit: 'cover', position: 'attention' }).toBuffer();
  const lines = wrapCJK(o.quote, 9);
  const fs = lines.length <= 2 ? 92 : lines.length === 3 ? 78 : 64;
  const lh = fs * 1.5;
  const blockH = lines.length * lh;
  let y = H / 2 - blockH / 2 + fs * 0.8;
  const quoteSvg = lines
    .map((l) => {
      const t = `<text x="${W / 2}" y="${y.toFixed(0)}" font-family="${SERIF}" font-weight="600" font-size="${fs}" fill="#ffffff" paint-order="stroke" stroke="#00000066" stroke-width="3" text-anchor="middle">${esc(l)}</text>`;
      y += lh;
      return t;
    })
    .join('');
  const srcY = (H / 2 + blockH / 2 + 90).toFixed(0);
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000000" stop-opacity="0.15"/>
      <stop offset="0.5" stop-color="#000000" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.4"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#scrim)"/>
    ${quoteSvg}
    <text x="${W / 2}" y="${srcY}" font-family="${SANS}" font-size="40" fill="#ffffffdd" text-anchor="middle">${esc(o.attribution)}</text>
    <text x="${W / 2}" y="${H - 96}" font-family="${SANS}" font-size="30" fill="#ffffffbb" text-anchor="middle">${esc(o.footer)}</text>
  </svg>`;
  return sharp(bg).composite([{ input: Buffer.from(overlay), top: 0, left: 0 }]).png().toBuffer();
}

// 自动分派：有配图→照片背景；否则→文字卡(按种子轮换)
export async function makeCover(o: {
  quote: string;
  attribution: string;
  footer: string;
  seed: number;
  imageUrl?: string | null;
}): Promise<{ png: Buffer; styleName: string }> {
  if (o.imageUrl) {
    try {
      const r = await fetch(o.imageUrl, { signal: AbortSignal.timeout(12000) });
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 3000) {
          const png = await renderPhotoCover(buf, o);
          return { png, styleName: '照片背景' };
        }
      }
    } catch {
      /* 下载失败则退回文字卡 */
    }
  }
  return renderCover(o);
}
