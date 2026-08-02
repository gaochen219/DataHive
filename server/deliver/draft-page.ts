// 投递层 · 每日草稿页面(自包含 HTML)
// 每篇：封面图 + 正文内容图(可多张) 逐张下载 + 一键复制"标题+标签"(正文已在图里，不用复制)
export interface DraftImage {
  b64: string;
  name: string; // 下载文件名用
  label: string; // 显示标签，如 封面/正文1
}
export interface DraftCard {
  title: string;
  tags: string[];
  attribution: string;
  images: DraftImage[];
}

function esc(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildDraftPage(date: string, drafts: DraftCard[]): string {
  const cards = drafts
    .map((d, i) => {
      const tagline = d.tags.map((t) => '#' + t).join(' ');
      const caption = `${d.title}\n\n${tagline}`;
      const capAttr = esc(caption).replace(/\n/g, '&#10;');
      const imgs = d.images
        .map(
          (im) => `<figure class="im">
        <img src="data:image/png;base64,${im.b64}" alt="${esc(im.label)}"/>
        <a class="dl" href="data:image/png;base64,${im.b64}" download="${esc(im.name)}.png">⬇ ${esc(im.label)}</a>
      </figure>`,
        )
        .join('');
      return `<article class="card">
    <div class="imgs">${imgs}</div>
    <div class="cap">
      <h2>${esc(d.title)}</h2>
      <div class="tags">${esc(tagline)}</div>
      <div class="meta">出处：${esc(d.attribution)}</div>
      <div class="btns">
        <button class="dlall">⬇ 下载全部图片(${d.images.length})</button>
        <button class="copy" data-text="${capAttr}">📋 复制标题+标签</button>
      </div>
      <div class="hint">下载全部图片直接发；标题+标签复制到正文框。（首次下载多图，浏览器可能提示"允许"）</div>
    </div>
  </article>`;
    })
    .join('\n');

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>山海与书 · 草稿 ${date}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#f4f2ee;color:#2b2b2b;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;padding:28px 16px 80px;line-height:1.6}
  header{max-width:1040px;margin:0 auto 24px}
  h1{font-size:22px}.sub{color:#888;font-size:14px;margin-top:6px}
  .grid{max-width:1040px;margin:0 auto;display:flex;flex-direction:column;gap:28px}
  .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.08)}
  .imgs{display:flex;gap:14px;overflow-x:auto;padding:18px;background:#faf9f6}
  .im{flex:0 0 auto;width:190px;text-align:center}
  .im img{width:190px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.12);display:block}
  .im .dl{display:inline-block;margin-top:8px;background:rgba(0,0,0,.62);color:#fff;font-size:12px;padding:5px 10px;border-radius:16px;text-decoration:none}
  .cap{padding:20px 24px}
  .cap h2{font-size:19px;margin-bottom:10px}
  .tags{color:#c0392b;font-size:14px;margin-bottom:8px}
  .meta{color:#999;font-size:13px;margin-bottom:14px}
  .btns{display:flex;flex-wrap:wrap;gap:10px}
  .copy,.dlall{color:#fff;border:0;border-radius:22px;padding:11px 20px;font-size:15px;cursor:pointer}
  .copy{background:#ff2e4d}.dlall{background:#3a3a3a}
  .copy:active,.dlall:active{transform:scale(.98)}.copy.done{background:#2ecc71}
  .hint{color:#aaa;font-size:12px;margin-top:10px}
</style></head><body>
<header><h1>🌿 山海与书 · 草稿 ${date}（${drafts.length} 篇）</h1>
<div class="sub">每篇：下载全部图片（封面+正文页）→ 小红书发图；复制"标题+标签"贴到正文框。电脑操作最顺。</div></header>
<div class="grid">
${cards}
</div>
<script>
document.querySelectorAll('.copy').forEach(function(b){
  b.addEventListener('click',function(){
    navigator.clipboard.writeText(b.getAttribute('data-text')).then(function(){
      var o=b.textContent;b.textContent='✅ 已复制';b.classList.add('done');
      setTimeout(function(){b.textContent=o;b.classList.remove('done');},1800);
    });
  });
});
document.querySelectorAll('.dlall').forEach(function(b){
  b.addEventListener('click',function(){
    var links=b.closest('.card').querySelectorAll('.im .dl');
    links.forEach(function(a,i){ setTimeout(function(){ a.click(); }, i*350); });
    var o=b.textContent;b.textContent='⬇ 下载中…';setTimeout(function(){b.textContent=o;},links.length*350+400);
  });
});
</script>
</body></html>`;
}
