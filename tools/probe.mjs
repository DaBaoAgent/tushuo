/* 关键时刻冒烟抽帧：给定时刻列表，逐帧截图到 output/chibi-full/_qa/probe/。
   用法：node tools/probe.mjs --slug=chibi-full */
import {existsSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {startServer} from './server.mjs';

const root=resolve(import.meta.dirname,'..');
const arg=(name,def)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.split('=').slice(1).join('=')??def;
const slug=arg('slug','chibi-full');
const out=join(root,'output',slug,'_qa','probe');
mkdirSync(out,{recursive:true});
const TIMES=[
  [1.2,'t01-开头抖动'],[4.4,'t02-曹操南下'],[25.0,'t03-数字牌'],
  [37.6,'t04-孙权三万'],[38.4,'t05-刘备两万'],
  [49.5,'t06-曹船队-曹操跟船'],[54.0,'t07-刘船队-刘备跟船'],[55.6,'t08-孙权朝堂'],
  [77.5,'t09-孙军旗列'],[80.0,'t10-旗列-逆江而上'],[119.0,'t11-黄盖献计'],
  [158.2,'t12-火船突击-箭头在后'],[161.0,'t13-后队继进'],[172.5,'t14-黄盖撤离船'],
  [181.5,'t15-联军压上箭头'],[205.8,'t16-曹操随船北撤'],
  [211.0,'t17-黄盖中箭韩当'],[209.5,'t18-后头是兵'],
  [251.2,'t19-曹仁守江陵'],[256.0,'t20-刘备取荆南'],[258.0,'t21-孙权守江东'],
  [267.2,'t22-孙权悼周瑜'],[275.0,'t23-周瑜病逝']
];
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
