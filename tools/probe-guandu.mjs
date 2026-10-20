/* 官渡关键时刻抽帧：逐帧截图到 output/guandu-full/_qa/probe-guandu/。
   用法：node tools/probe-guandu.mjs            （默认前 24 秒）
        node tools/probe-guandu.mjs --from=0 --to=24
   叠加：抖动的第一帧、曹营、袁营、官渡、粮道、方阵、邺城、逃路、主帅卡切换。 */
import {existsSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {startServer} from './server.mjs';

const root=resolve(import.meta.dirname,'..');
const arg=(name,def)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.split('=').slice(1).join('=')??def;
const slug=arg('slug','guandu-full');
const tFrom=Number(arg('from','0')),tTo=Number(arg('to','24'));
const out=join(root,'output',slug,'_qa','probe-guandu');
mkdirSync(out,{recursive:true});

const ALL=[
  [0.30,'t00-开场抖动'],[0.85,'t01-抖动末'],
  [1.60,'t02-曹操营'],[2.70,'t03-袁绍营'],
  [4.10,'t04-官渡'],[5.00,'t05-中牟'],
  [6.30,'t06-曹操-粮道'],[7.90,'t07-袁绍-精兵'],
  [9.00,'t08-袁军方阵'],[10.10,'t09-战马'],
  [11.20,'t10-邺城'],[12.50,'t11-全图'],
  [13.90,'t12-八百骑'],[15.50,'t13-定北方'],
  [18.20,'t14-不是阵前斩将'],[20.30,'t15-情报'],
  [22.10,'t16-怎么推的'],[23.40,'t17-从头算'],
];
const TIMES=ALL.filter(([t])=>t>=tFrom&&t<=tTo);

const browserPaths=[
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const {server,url}=await startServer();
let browser;
try{
  const executablePath=browserPaths.find(existsSync);
  browser=await chromium.launch({headless:true,executablePath,args:['--disable-gpu-sandbox','--font-render-hinting=none']});
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  const errs=[];
  page.on('pageerror',e=>{errs.push(e.message);console.error('浏览器错误：',e.message)});
  await page.goto(`${url}/?render=1&content=${encodeURIComponent(slug)}`,{waitUntil:'load'});
  await page.waitForFunction(()=>!!(window.tushuo&&window.tushuo.shots),null,{timeout:90000});
  await page.evaluate(()=>window.tushuo.ready);
  for(const [t,tag] of TIMES){
    await page.evaluate(x=>window.tushuo.renderAt(x),t);
    await page.screenshot({path:join(out,`${tag}.png`),type:'png'});
    console.log(`${tag}  ${t}s`);
  }
  console.log(errs.length?`共 ${errs.length} 个页面错误`:'无页面错误');
}finally{await browser?.close();server.close()}
