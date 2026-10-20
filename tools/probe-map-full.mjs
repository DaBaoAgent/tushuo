/* 全片相机数值探针：按 fps 采样整段，报告单帧位移、句边界跳变与机位数量。 */
import {existsSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {startServer} from './server.mjs';

const root=resolve(import.meta.dirname,'..');
const arg=(n,d)=>process.argv.find(v=>v.startsWith(`--${n}=`))?.split('=').slice(1).join('=')??d;
const slug=arg('slug','guandu-map');
const fps=Number(arg('fps','30'));
const caps=JSON.parse(readFileSync(join(root,'output',slug,'captions.json'),'utf8')).lines;
const browserPaths=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'];
const {server,url}=await startServer();
let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:browserPaths.find(existsSync),args:['--disable-gpu-sandbox']});
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  page.on('pageerror',e=>console.error('pageerror:',e.message));
  page.on('console',m=>{if(m.type()==='warning')console.log('console:',m.text())});
  await page.goto(`${url}/?render=1&content=${encodeURIComponent(slug)}`,{waitUntil:'load'});
  await page.waitForFunction(()=>!!(window.tushuo&&window.tushuo.ready),null,{timeout:90000});
  await page.evaluate(()=>window.tushuo.ready);

  const res=await page.evaluate(({fps})=>{
    const cam=window.tushuo.camera, D=window.tushuo.duration;
    const step=1/fps, n=Math.floor(D*fps)+1;
    let prev=null,max=0,sum=0,maxAt=0,top=[];
    for(let i=0;i<n;i++){
      const t=i*step, c=cam(t);
      if(prev){
        const dx=(c[1]-prev[1])*c[0], dy=(c[2]-prev[2])*c[0];
        const dz=Math.abs(c[0]-prev[0])/c[0]*Math.hypot(960,540);
        const px=Math.hypot(dx,dy)+dz;
        sum+=px;
        if(px>max){max=px;maxAt=t}
        top.push([+t.toFixed(3),+px.toFixed(1)]);
      }
      prev=c;
    }
    top.sort((a,b)=>b[1]-a[1]);
    return {duration:+D.toFixed(3),frames:n,max:+max.toFixed(2),maxAt:+maxAt.toFixed(3),
      avg:+(sum/(n-1)).toFixed(2),plan:window.tushuo.plan?window.tushuo.plan.length:0,
      top:top.slice(0,20)};
  },{fps});

  /* 每个口播句起点前后 0.1ms 的相机差：连续运镜应≈0，硬切会立刻暴露 */
  const jumps=await page.evaluate(({times})=>{
    const cam=window.tushuo.camera, out=[];
    for(const {t,text} of times){
      const a=cam(Math.max(0,t-0.0001)), b=cam(t+0.0001);
      const px=Math.hypot((b[1]-a[1])*b[0],(b[2]-a[2])*b[0])
        +Math.abs(b[0]-a[0])/b[0]*Math.hypot(960,540);
      if(px>0.05) out.push([+t.toFixed(2),+px.toFixed(3),text]);
    }
    return out;
  },{times:caps.map(c=>({t:c.t,text:c.text}))});

  console.log(`时长 ${res.duration}s  ${res.frames} 帧 @${fps}fps  机位 ${res.plan}`);
  console.log(`单帧位移 max ${res.max}px @${res.maxAt}s  avg ${res.avg}px`);
  console.log('最大 20 帧：', res.top.map(x=>`${x[0]}s:${x[1]}px`).join('  '));
  jumps.sort((a,b)=>b[1]-a[1]);
  const hard=jumps.filter(j=>j[1]>1).length;
  console.log(`句边界跳变：${jumps.length} 处 >0.05px，其中 >1px ${hard} 处；最大 ${jumps[0]?jumps[0][1]:0}px`);
  for(const [t,px,text] of jumps.slice(0,5)) console.log(`  ${t}s  ${px}px  ${text}`);
}finally{await browser?.close();server.close()}
