// 投递层 · 生成"每日草稿页面"(自包含 HTML，封面图内嵌，可复制文案/下载封面)
export interface DraftCard {
  title: string;
  body: string;
  quote: string;
  attribution: string;
  tags: string[];
  sourceUrl: string;
  styleName: string;
  coverB64: string; // PNG base64(不含前缀)
}

function esc(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildDraftPage(date: string, drafts: DraftCard[]): string {
  const cards = drafts
    .map((d, i) => {
      const tagline = d.tags.map((t) => '#' + t).join(' ');
      // 供"复制文案"用的完整文案(标题+正文+标签)
      const full = `${d.title}\n\n${d.body}\n\n${tagline}`;
      const fullAttr = esc(full).replace(/\n/g, '&#10;');
      return `<article class="card">
    <div class="cover"><img src="data:image/png;base64,${d.coverB64}" alt="封面"/>
      <a class="dl" href="data:image/png;base64,${d.coverB64}" download="cover-${date}-${i + 1}.png">⬇ 下载封面</a>
      <span class="style">${esc(d.styleName)}</span>
    </div>
    <div class="txt">
      <h2>${esc(d.title)}</h2>
      <pre class="body">${esc(d.body)}</pre>
      <div class="tags">${esc(tagline)}</div>
      <div class="meta">出处：${esc(d.attribution)}</div>
      <button class="copy" data-text="${fullAttr}">📋 复制文案(标题+正文+标签)</button>
    </div>
  </article>`;
    })
    .join('\n');

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>小红书草稿 · ${date}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#f4f2ee;color:#2b2b2b;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;padding:28px 16px 80px;line-height:1.6}
  header{max-width:1000px;margin:0 auto 24px}
  h1{font-size:22px}.sub{color:#888;font-size:14px;margin-top:6px}
  .grid{max-width:1000px;margin:0 auto;display:flex;flex-direction:column;gap:28px}
  .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.08);display:grid;grid-template-columns:320px 1fr}
  @media(max-width:720px){.card{grid-template-columns:1fr}}
  .cover{position:relative;background:#eee}
  .cover img{width:100%;display:block}
  .cover .dl{position:absolute;bottom:12px;left:12px;background:rgba(0,0,0,.6);color:#fff;font-size:13px;padding:6px 12px;border-radius:20px;text-decoration:none}
  .cover .style{position:absolute;top:12px;right:12px;background:rgba(255,255,255,.85);font-size:12px;padding:4px 10px;border-radius:12px;color:#666}
  .txt{padding:22px 24px}
  .txt h2{font-size:19px;margin-bottom:12px}
  .body{font-family:inherit;white-space:pre-wrap;font-size:15px;color:#333;background:#faf9f6;padding:14px;border-radius:10px}
  .tags{color:#c0392b;font-size:14px;margin:12px 0}
  .meta{color:#999;font-size:13px;margin-bottom:14px}.meta a{color:#888}
  .copy{background:#ff2e4d;color:#fff;border:0;border-radius:22px;padding:11px 20px;font-size:15px;cursor:pointer}
  .copy:active{transform:scale(.98)}.copy.done{background:#2ecc71}
</style></head><body>
<header><h1>🌿 小红书草稿 · ${date}（${drafts.length} 篇）</h1>
<div class="sub">每篇：下载封面 + 复制文案 → 去小红书发布/定时发布。电脑上操作最顺。</div></header>
<div class="grid">
${cards}
</div>
<script>
document.querySelectorAll('.copy').forEach(function(b){
  b.addEventListener('click',function(){
    var t=b.getAttribute('data-text');
    navigator.clipboard.writeText(t).then(function(){
      var o=b.textContent;b.textContent='✅ 已复制';b.classList.add('done');
      setTimeout(function(){b.textContent=o;b.classList.remove('done');},1800);
    });
  });
});
</script>
</body></html>`;
}
