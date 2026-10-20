/* 审核用逐镜截图：读页面里的镜头表（window.tushuo.shots），
   每个镜头取「推稳之后」的一帧，画面右上角叠镜头号/名称/时码。
   用法：node tools/shots.mjs --slug=chibi-full */
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {startServer} from './server.mjs';

const root=resolve(import.meta.dirname,'..');
const arg=(name,def)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.split('=').slice(1).join('=')??def;
const slug=arg('slug','chibi-full');
const out=join(root,'output',slug,'review-shots');
const browserPaths=[
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
await mkdir(out,{recursive:true});
const {server,url}=await startServer();
let browser;
try{
  const executablePath=browserPaths.find(existsSync);
  if(!executablePath)throw new Error('未找到本机 Chrome 或 Edge');
  browser=await chromium.launch({headless:true,executablePath,args:['--disable-gpu-sandbox','--font-render-hinting=none']});
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  page.on('pageerror',e=>console.error('浏览器错误：',e.message));
  await page.goto(`${url}/?render=1&content=${encodeURIComponent(slug)}`,{waitUntil:'load'});
  await page.waitForFunction(()=>!!(window.tushuo&&window.tushuo.shots),null,{timeout:90000});
  await page.evaluate(()=>window.tushuo.ready);
  const shots=await page.evaluate(()=>window.tushuo.shots.map(s=>({i:s.i,t0:s.t0,t1:s.t1,z:s.z,cx:s.cx,cy:s.cy,label:s.label,fac:s.fac})));
  await page.evaluate(()=>{
    const d=document.createElement('div');
    d.id='review-tag';
    d.style.cssText='position:fixed;bottom:26px;right:28px;z-index:99;pointer-events:none;'
      +'font:700 26px "Microsoft YaHei",sans-serif;color:#f7ecd3;background:rgba(24,19,14,.88);'
      +'border:2px solid rgba(214,184,126,.7);border-radius:10px;padding:12px 20px;letter-spacing:.5px';
    document.body.appendChild(d);
  });
  const manifest=[];
  for(const s of shots){
    const span=Math.max(.3,s.t1-s.t0);
    let at=s.t0+Math.min(Math.max(.9,span*.62),Math.max(.9,span-.25));
    if(s.label==='开场 · 全图')at=4.3;              /* 等开场大字落下去再截全图 */
    at=Math.max(s.t0+.05,Math.min(s.t1-.12,at));
    await page.evaluate(t=>window.tushuo.renderAt(t),at);
    const tag=`S${String(s.i+1).padStart(2,'0')} ${s.label} · ${at.toFixed(1)}s`;
    await page.evaluate(t=>{document.getElementById('review-tag').textContent=t},tag);
    const safe=s.label.replace(/[·＝/\s]+/g,'-').replace(/[\\:*?"<>|]/g,'');
    const name=`s${String(s.i+1).padStart(2,'0')}_${safe}.png`;
    await page.screenshot({path:join(out,name),type:'png'});
    manifest.push({shot:s.i+1,name,t0:+s.t0.toFixed(2),t1:+s.t1.toFixed(2),at:+at.toFixed(2),label:s.label,fac:s.fac,z:s.z,cx:s.cx,cy:s.cy});
    console.log(`${name}  ${s.t0.toFixed(1)}–${s.t1.toFixed(1)}s`);
  }
  /* 演义对照是一个长镜头里连出四张卡，单帧截不全，补四帧给审核 */
  const extra=[
    [276.5,'S70a 演义卡 · 草船借箭','x70a_演义卡-草船借箭'],
    [280.8,'S70b 演义卡 · 借东风','x70b_演义卡-借东风'],
    [284.0,'S70c 演义卡 · 华容道','x70c_演义卡-华容道'],
    [286.8,'S70d 演义卡 · 周瑜打黄盖','x70d_演义卡-周瑜打黄盖']
  ];
  for(const [t,tag,name] of extra){
    await page.evaluate(x=>window.tushuo.renderAt(x),t);
    await page.evaluate(s=>{document.getElementById('review-tag').textContent=s},`${tag} · ${t.toFixed(1)}s`);
    await page.screenshot({path:join(out,name+'.png'),type:'png'});
    console.log(`${name}.png  ${t.toFixed(1)}s`);
  }
  await writeFile(join(out,'manifest.json'),JSON.stringify(manifest,null,2),'utf8');
  console.log(`共 ${manifest.length} 个镜头 + ${extra.length} 帧补充，输出：${out}`);
}finally{await browser?.close();server.close()}
