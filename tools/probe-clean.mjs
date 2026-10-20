/* 纯净地形管线抽帧：node tools/probe-clean.mjs --times=4,8,12,20,45,70 */
import {existsSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {startServer} from './server.mjs';

const root=resolve(import.meta.dirname,'..');
const arg=(name,def)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.split('=').slice(1).join('=')??def;
const slug=arg('slug','guandu-clean');
const times=arg('times','4,8,12,20,45,70').split(',').map(Number);
const out=join(root,'output',slug,'_qa','probe-clean');
mkdirSync(out,{recursive:true});
const browserPaths=['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'];
const {server,url}=await startServer();
let browser;
try{
  const executablePath=browserPaths.find(existsSync);
  browser=await chromium.launch({headless:true,executablePath,args:['--disable-gpu-sandbox','--font-render-hinting=none']});
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  const errs=[];
  page.on('pageerror',e=>{errs.push(e.message);console.error('浏览器错误：',e.message)});
  await page.goto(`${url}/?render=1&content=${encodeURIComponent(slug)}`,{waitUntil:'load'});
  await page.waitForFunction(()=>!!(window.tushuo&&window.tushuo.ready),null,{timeout:90000});
  await page.evaluate(()=>window.tushuo.ready);
  for(const t of times){
    await page.evaluate(x=>window.tushuo.renderAt(x),t);
    const p=join(out,`c${String(t).padStart(3,'0')}.png`);
    await page.screenshot({path:p,type:'png'});
    console.log(p);
  }
  console.log(errs.length?`共 ${errs.length} 个页面错误`:'无页面错误');
}finally{await browser?.close();server.close()}
