/* tushuo · 入口
   按 ?content=<slug> 载入对应的战役场景 src/scene-<slug>.js（默认 chibi-full）。
   引擎与通用画法在 src/engine.js；每个战役只写自己的时间轴与画面。 */
const slug=new URLSearchParams(location.search).get('content')||'chibi-full';
try{
  await import(`./scene-${slug}.js`);
}catch(err){
  console.error(`载入场景失败：scene-${slug}.js`,err);
  document.body.insertAdjacentHTML('afterbegin',
    `<pre style="color:#f7cdb0;font:16px/1.6 monospace;padding:24px">载入场景失败：src/scene-${slug}.js\n${err&&err.message||err}</pre>`);
}
