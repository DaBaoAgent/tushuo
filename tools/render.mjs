import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
import {startServer} from './server.mjs';

const root=resolve(import.meta.dirname,'..');
const browserPaths=[
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const arg=(name,def)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.split('=').slice(1).join('=')??def;
const hasFlag=name=>process.argv.includes(`--${name}`);
const slug=arg('slug','chibi-full');
const out=join(root,'output',slug);
const ffmpeg=join(root,'vendor','gpt-sovits','runtime','ffmpeg.exe');
const fps=Number(arg('fps','30'));
const seconds=Number(arg('seconds','52'));
const start=Number(arg('start','0'));
const stills=arg('stills','');
const preview=hasFlag('preview');
const muxOnly=hasFlag('mux-only');
const cover=hasFlag('cover');           /* 封面模式：只画战场，不叠字幕/图例/UI 卡 */
const scale=Number(arg('scale','1'));   /* 截图倍率，封面出 2 倍图 */
const tag=arg('tag','');                 /* 片段产出名后缀，避免覆盖全片成片 */
const audioClip=hasFlag('audio');        /* 预览也混音（片段审核用） */
const AR='48000';
if(!(fps>0&&fps<=60&&seconds>0&&seconds<=(muxOnly?7200:600)&&start>=0))throw new Error('fps/seconds/start 参数无效');
await mkdir(out,{recursive:true});

/* 混音成片规格：旁白 loudnorm 后满电平、音效床 0.325（+3dB，已定稿）、
   BGM 床（bgm.wav，−40 LUFS）垫最底层，统一 48kHz 立体声再编码。
   只换音轨/只重混时用 `--mux-only`，直接拿现成的 picture.mp4 合成，不重渲画面。 */
const bedVolume=0.325;
const soloFilter=`apad,loudnorm=I=-17:TP=-1.5:LRA=7,aformat=sample_rates=${AR}:channel_layouts=stereo`;
async function muxAudio(video){
  const narration=join(out,'narration.mp3');
  if(!existsSync(narration)){console.log(`无声画面：${video}`);return}
  const soundbed=join(out,'soundbed.wav');
  const bgm=join(out,'bgm.wav');
  const withBgm=existsSync(soundbed)&&existsSync(bgm);
  /* 片段渲染：音轨同步跳转到 start，保证声画对位 */
  const seek=start>0?['-ss',String(start)]:[];
  const bedFilter=`[1:a]loudnorm=I=-17:TP=-1.5:LRA=7,aformat=sample_rates=${AR}:channel_layouts=stereo[v];`
    +`[2:a]volume=${bedVolume},aformat=sample_rates=${AR}:channel_layouts=stereo[m];`
    +(withBgm?`[3:a]aformat=sample_rates=${AR}:channel_layouts=stereo[b];`:'' )
    +`[v][m]${withBgm?'[b]':''}amix=inputs=${withBgm?3:2}:duration=longest:normalize=0,alimiter=limit=0.93,aformat=sample_rates=${AR}:channel_layouts=stereo[aout]`;
  const mix=existsSync(soundbed)
    ? [...seek,'-i',soundbed,...(withBgm?[...seek,'-i',bgm]:[]),'-filter_complex',bedFilter,'-map','0:v:0','-map','[aout]']
    : ['-map','0:v:0','-map','1:a:0','-af',soloFilter];
  const final=join(out,tag?`tushuo-${slug}-${tag}.mp4`:`tushuo-${slug}.mp4`);
  const mux=spawn(ffmpeg,['-y','-hide_banner','-loglevel','error','-i',video,...seek,'-i',narration,
    ...mix,'-c:v','copy','-c:a','aac','-b:a','192k','-ar',AR,'-ac','2',
    '-t',String(seconds),'-movflags','+faststart',final],{stdio:'inherit'});
  const [code]=await once(mux,'close');if(code!==0)throw new Error(`音视频合成失败：${code}`);
  console.log(`成片：${final}`);
}

if(muxOnly){
  const video=join(out,'picture.mp4');
  if(!existsSync(video))throw new Error('--mux-only 需要已存在的 picture.mp4');
  await muxAudio(video);
}else{
  const {server,url}=await startServer();
  let browser;
  try{
    const executablePath=browserPaths.find(existsSync);
    if(!executablePath)throw new Error('未找到本机 Chrome 或 Edge');
    browser=await chromium.launch({headless:true,executablePath,args:['--disable-gpu-sandbox','--font-render-hinting=none']});
    const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:scale});
    page.on('pageerror',e=>console.error('浏览器错误：',e.message));
    await page.goto(`${url}/?render=1&content=${encodeURIComponent(slug)}${cover?'&cover=1':''}`,{waitUntil:'load'});
    // 入口按 slug 动态 import 场景，window.tushuo 可能晚于 load 事件挂上
    await page.waitForFunction(()=>!!(window.tushuo&&window.tushuo.ready),null,{timeout:60000});
    await page.evaluate(()=>window.tushuo.ready);
    if(stills){
      const dest=join(out,cover?'stills-cover':'stills');await mkdir(dest,{recursive:true});
      for(const at of stills.split(',').map(Number)){
        await page.evaluate(t=>window.tushuo.renderAt(t),at);
        const path=join(dest,`t${String(at).padStart(2,'0')}.png`);
        await page.screenshot({path,type:'png'});
        console.log(path);
      }
    }else{
      const video=join(out,preview?`preview-${start}-${seconds}.mp4`:'picture.mp4');
      const cmd=['-y','-hide_banner','-loglevel','error','-f','image2pipe','-framerate',String(fps),
        '-vcodec','png','-i','pipe:0','-an','-c:v','libx264','-crf','20','-preset','veryfast',
        '-pix_fmt','yuv420p','-movflags','+faststart',video];
      const ff=spawn(ffmpeg,cmd,{stdio:['pipe','inherit','inherit']});
      const frames=Math.round(seconds*fps);const started=Date.now();
      for(let i=0;i<frames;i++){
        const t=start+i/fps;await page.evaluate(x=>window.tushuo.renderAt(x),t);
        const png=await page.screenshot({type:'png'});
        if(!ff.stdin.write(png))await once(ff.stdin,'drain');
        if(i%150===0)console.log(`渲染 ${i}/${frames} 帧，已用 ${((Date.now()-started)/1000).toFixed(1)} 秒`);
      }
      ff.stdin.end();const [code]=await once(ff,'close');if(code!==0)throw new Error(`FFmpeg 编码失败：${code}`);
      if(preview&&!audioClip)console.log(`预览（无音轨）：${video}`);else await muxAudio(video);
    }
  }finally{await browser?.close();server.close()}
}
