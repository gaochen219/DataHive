// 封面渲染验证：SVG(中文+渐变) → sharp → PNG
import sharp from 'sharp';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ffe9d6"/><stop offset="1" stop-color="#f7c9d9"/>
  </linearGradient></defs>
  <rect width="1080" height="1440" fill="url(#g)"/>
  <text x="540" y="640" font-family="Noto Serif CJK SC" font-weight="700" font-size="88" fill="#7a4a48" text-anchor="middle">你不必成为谁</text>
  <text x="540" y="770" font-family="Noto Serif CJK SC" font-weight="700" font-size="88" fill="#7a4a48" text-anchor="middle">只需成为你自己</text>
  <text x="540" y="980" font-family="Noto Sans CJK SC" font-size="42" fill="#9a6a68" text-anchor="middle">—— 《当下的力量》</text>
  <text x="540" y="1360" font-family="Noto Sans CJK SC" font-size="30" fill="#b5807e" text-anchor="middle">@你的账号 · 每日治愈</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('/opt/datahive/test-cover.png');
console.log('rendered');
