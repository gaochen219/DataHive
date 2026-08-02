// 正文内容页：把小红书正文渲染成"书感"图片(多种纸张底色)，超长自动分多页。
import sharp from 'sharp';
import { wrapCJK } from './index';

const W = 1080, H = 1440;
const SERIF = 'Noto Serif CJK SC';
const SANS = 'Noto Sans CJK SC';

function esc(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 书页里去掉 emoji(宋体渲染成方块)，保持纯净文字；emoji 留给标题
function stripEmoji(s: string): string {
  return String(s || '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}\u{2190}-\u{21FF}]/gu, '')
    .replace(/[ \t]{2,}/g, ' ');
}

interface Paper {
  name: string;
  bg: string;
  ink: string;
  sub: string;
  seal?: boolean;
}
const PAPERS: Paper[] = [
  { name: '宣纸', bg: '#f7f3e9', ink: '#2b2b2b', sub: '#8a8172' },
  { name: '牛皮纸', bg: '#d8c4a0', ink: '#40331f', sub: '#6e5c40' },
  { name: '古籍', bg: '#ece0c4', ink: '#3a2f1c', sub: '#7a6a4a', seal: true },
  { name: '素白', bg: '#faf8f3', ink: '#2a2a2a', sub: '#9a9a9a' },
];

export async function renderContentPages(
  body: string,
  opts: { footer: string; seed: number },
): Promise<{ pngs: Buffer[]; paperName: string }> {
  const paper = PAPERS[((opts.seed % PAPERS.length) + PAPERS.length) % PAPERS.length];
  const M = 120, fs = 42, lh = Math.round(fs * 2.0), maxChars = 20;
  const maxLines = Math.floor((H - 380) / lh); // 上下各留约 190

  // 段落 → 行(段间插空行)
  const paras = stripEmoji(body).split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const items: string[] = [];
  paras.forEach((p, pi) => {
    if (pi > 0) items.push('');
    for (const l of wrapCJK(p, maxChars)) items.push(l);
  });
  // 均衡分页：先算页数，再平均分，避免最后一页只剩一两行
  const pageCount = Math.max(1, Math.ceil(items.length / maxLines));
  const per = Math.ceil(items.length / pageCount);
  let pages: string[][] = [];
  for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per));
  // 去掉每页首尾空行
  pages = pages
    .map((pg) => {
      const a = [...pg];
      while (a.length && !a[0]) a.shift();
      while (a.length && !a[a.length - 1]) a.pop();
      return a;
    })
    .filter((a) => a.length);
  if (!pages.length) pages = [['']];

  const total = pages.length;
  const pngs: Buffer[] = [];
  for (let pi = 0; pi < total; pi++) {
    const blockH = pages[pi].length * lh;
    let y = Math.round((H - blockH) / 2 + fs * 0.72); // 垂直居中，阅读更舒适
    const lineSvg = pages[pi]
      .map((l) => {
        const t = l ? `<text x="${M}" y="${y.toFixed(0)}" font-family="${SERIF}" font-size="${fs}" fill="${paper.ink}">${esc(l)}</text>` : '';
        y += lh;
        return t;
      })
      .join('');
    const seal = paper.seal
      ? `<rect x="${W - M - 96}" y="90" width="96" height="96" rx="10" fill="#a63a2e"/><text x="${W - M - 48}" y="162" font-family="${SERIF}" font-size="56" fill="#f3ead4" text-anchor="middle">书</text>`
      : '';
    const pageMark = total > 1 ? `　·　${pi + 1}/${total}` : '';
    const footer = `<text x="${W / 2}" y="${H - 96}" font-family="${SANS}" font-size="28" fill="${paper.sub}" text-anchor="middle">${esc(opts.footer)}${pageMark}</text>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${paper.bg}"/>${seal}${lineSvg}${footer}</svg>`;
    pngs.push(await sharp(Buffer.from(svg)).png().toBuffer());
  }
  return { pngs, paperName: paper.name };
}
