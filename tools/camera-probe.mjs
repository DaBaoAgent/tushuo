/* 相机数值探针：打印每个镜头切点的 z / cx / cy，确认“真的推近”。 */
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {startServer} from './server.mjs';

const arg=(n,d)=>process.argv.find(v=>v.startsWith(`--${n}=`))?.split('=').slice(1).join('=')??d;
const slug=arg('slug','guandu-full');
const browserPaths=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'];
const {server,url}=await startServer();
let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:browserPaths.find(existsSync),args:['--disable-gpu-sandbox']});
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  page.on('pageerror',e=>console.error('pageerror:',e.message));
  const t0=Date.now();
  await page.goto(`${url}/?render=1&content=${encodeURIComponent(slug)}`,{waitUntil:'load'});
  await page.waitForFunction(()=>!!(window.tushuo&&window.tushuo.shots),null,{timeout:90000});
  const rows=await page.evaluate(()=>window.tushuo.shots.map(s=>[s.i,s.t0,+s.t1.toFixed(2),s.z,s.cx,s.cy,s.label,s.fac]));
  console.log(`加载 ${((Date.now()-t0)/1000).toFixed(1)}s，镜头 ${rows.length} 个`);
  console.log('i     t0     t1     z     cx   cy    name / fac');
  for(const r of rows.slice(0,40)) console.log(r.map((v,i)=>i>=4?String(v).padEnd(5):String(v).padEnd(7)).join(''));
  const probe=[1.6,4.1,7.9,11.2,13.9,20.3];
  for(const t of probe){
    const c=await page.evaluate(x=>window.tushuo.camera(x),t);
    console.log(`t=${t}s  z=${c[0].toFixed(2)}  cx=${c[1].toFixed(0)}  cy=${c[2].toFixed(0)}  视窗=${(1920/c[0]).toFixed(0)}x${(1080/c[0]).toFixed(0)} 世界px`);
  }
}finally{await browser?.close();server.close()}
