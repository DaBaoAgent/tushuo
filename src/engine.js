/* tushuo · 共享引擎
   画布 / 底图（晕渲地形、河流、岸线、城池）/ 单位（船、幡、主帅卡）/ UI 基元 /
   相机插值 / 时间轴映射 / 挂载与逐帧循环。
   各战役只写 scene-<slug>.js：给资源表、时间轴、每帧画什么。 */

export const W=1920,H=1080,PI=Math.PI;
export const canvas=document.querySelector('#stage');
export const ctx=canvas.getContext('2d',{alpha:false,desynchronized:false});
export const off=document.createElement('canvas');off.width=W;off.height=H;
export const map=off.getContext('2d',{alpha:false});
export const images={};

export async function loadImages(assetNames){
  await Promise.all(Object.entries(assetNames||{}).map(([key,url])=>new Promise(resolve=>{
    const im=new Image();im.onload=()=>{images[key]=im;resolve()};im.onerror=()=>resolve();im.src=url;
  })));
}

/* 字体：隶书用于地图地名/势力字，黑体用于 UI 与字幕 */
export const SONG='"STLiti","LiSu","隶书","SimLi","Microsoft YaHei",serif';
export const HEI='"Microsoft YaHei","PingFang SC",sans-serif';

/* ================= 基础工具 ================= */
export const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
export const range=(t,a,b)=>smooth((t-a)/(b-a));
export const fade=(t,a,b,c,d)=>range(t,a,b)*(1-range(t,c,d));
export function rng(seed){let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296)}
export const rand=rng(208122);
export const top=x=>320+24*Math.sin(x*.004+1.8)+10*Math.sin(x*.012);
export const bottom=x=>748+24*Math.sin(x*.003+2.6)+10*Math.sin(x*.011+1.4);
export function line(g,x1,y1,x2,y2,color,width=1,dash=[]){g.beginPath();g.setLineDash(dash);g.moveTo(x1,y1);g.lineTo(x2,y2);g.strokeStyle=color;g.lineWidth=width;g.stroke();g.setLineDash([])}
export function txt(g,s,x,y,size,color='#eee7d3',weight=600,align='left',font=HEI){
  g.font=`${weight} ${size}px ${font}`;g.textAlign=align;g.textBaseline='middle';g.fillStyle=color;g.fillText(s,x,y);
}
/* alpha 与父层 globalAlpha 相乘：整组淡入淡出时，文字要和同组的底版一起淡，
   否则会出现「底版已隐、字还亮着」的孤字。 */
export function song(g,s,x,y,size,color,alpha=1,align='center'){
  g.save();g.globalAlpha*=alpha;g.font=`700 ${size}px ${SONG}`;g.textAlign=align;g.textBaseline='middle';g.fillStyle=color;g.fillText(s,x,y);g.restore();
}
export function pill(g,s,x,y,color,fill='rgba(11,27,30,.88)',size=27){
  g.font=`600 ${size}px ${HEI}`;const w=g.measureText(s).width+36;
  g.fillStyle=fill;g.beginPath();g.roundRect(x-w/2,y-24,w,48,9);g.fill();
  g.strokeStyle=color;g.lineWidth=1.5;g.stroke();txt(g,s,x,y+1,size,color,600,'center');
}
/* 竖排文字（旗帜/幡） */
export function vtext(g,s,x,y,size,color,alpha=1,gap=1.06){
  g.save();g.globalAlpha*=alpha;g.font=`700 ${size}px ${SONG}`;g.textAlign='center';g.textBaseline='middle';g.fillStyle=color;
  const n=s.length,step=size*gap;for(let i=0;i<n;i++)g.fillText(s[i],x,y+(i-(n-1)/2)*step);
  g.restore();
}
export function arrow(g,x1,y1,x2,y2,color,width=5,head=16){
  g.save();g.strokeStyle=color;g.fillStyle=color;g.lineWidth=width;g.lineCap='round';g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();let a=Math.atan2(y2-y1,x2-x1);g.beginPath();g.moveTo(x2,y2);g.lineTo(x2-head*Math.cos(a-.48),y2-head*Math.sin(a-.48));g.lineTo(x2-head*Math.cos(a+.48),y2-head*Math.sin(a+.48));g.closePath();g.fill();g.restore();
}

/* ================= 底图：逐像素晕渲 + 势力色块 ================= */
export const NORTH={r:158,g:112,b:66},SOUTH={r:82,g:126,b:110};
export const WATER_TOP={r:38,g:88,b:100},WATER_BOT={r:18,g:48,b:60};
export function octave(seed,N){
  const d=new Float32Array((N+1)*(N+1)),r=rng(seed);
  for(let i=0;i<d.length;i++)d[i]=r();
  const N1=N+1;
  return (x,y)=>{
    const gx=Math.min(.999999,Math.max(0,x))*N,gy=Math.min(.999999,Math.max(0,y))*N;
    const ix=Math.floor(gx),iy=Math.floor(gy),u=smooth(gx-ix),v=smooth(gy-iy);
    const a=d[iy*N1+ix],b=d[iy*N1+ix+1],c=d[(iy+1)*N1+ix],e=d[(iy+1)*N1+ix+1];
    return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+e*u)*v;
  };
}
/* 高度场：脊状噪声叠 fBm，再压平低处 → 山地条带与平原自然分界 */
export function buildHeight(w,h){
  const o1=octave(311,3),o2=octave(977,7),o3=octave(1451,14),o4=octave(2003,28),o5=octave(3203,56);
  const Hf=new Float32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=x/w,v=y/h;
    let e=.34*(1-Math.abs(2*o1(u,v)-1))+.28*(1-Math.abs(2*o2(u,v)-1))+.18*o3(u,v)+.12*o4(u,v)+.06*o5(u,v);
    e=smooth(Math.max(0,Math.min(1,(e-.42)/.30)));
    Hf[y*w+x]=e;
  }
  return Hf;
}
/* 逐像素：西北向光晕渲 × 势力底色；水面沿江给渐变。一次成图，不留糊块。 */
export function paintBase(g){
  const w=W,h=H,Hf=buildHeight(w,h),img=g.createImageData(w,h),d=img.data;
  const k=19,Lx=-.6,Ly=-.62,Lz=.5,Ln=Math.hypot(Lx,Ly,Lz);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;
    const hx=(x>0&&x<w-1)?Hf[i+1]-Hf[i-1]:0,hy=(y>0&&y<h-1)?Hf[i+w]-Hf[i-w]:0;
    let nx=-hx*k,ny=-hy*k,nz=1;const nl=Math.hypot(nx,ny,nz);nx/=nl;ny/=nl;nz/=nl;
    let sh=(nx*Lx+ny*Ly+nz*Lz)/Ln;sh=Math.max(0,sh);sh=.62+.72*sh;if(sh>1.32)sh=1.32;
    const ty=top(x),by=bottom(x);let R,G,B;
    if(y>ty&&y<by){const p=(y-ty)/(by-ty);R=WATER_TOP.r+(WATER_BOT.r-WATER_TOP.r)*p;G=WATER_TOP.g+(WATER_BOT.g-WATER_TOP.g)*p;B=WATER_TOP.b+(WATER_BOT.b-WATER_TOP.b)*p}
    else{const c=y<ty?NORTH:SOUTH;R=c.r*sh;G=c.g*sh;B=c.b*sh}
    d[i*4]=R>255?255:R;d[i*4+1]=G>255?255:G;d[i*4+2]=B>255?255:B;d[i*4+3]=255;
  }
  g.putImageData(img,0,0);
}
/* 细粒质感：只落在陆地，避免水面起麻点 */
export function drawTexture(g){
  for(let i=0;i<9000;i++){
    const x=rand()*W,y=rand()*H;
    if(y>top(x)&&y<bottom(x))continue;
    const s=rand()*2+.6;g.fillStyle=rand()>.5?'rgba(255,246,214,.06)':'rgba(18,34,28,.07)';g.fillRect(x,y,s,s);
  }
}
/* 河流支汊：与主江连通，示意走向 */
export function drawRivers(g){
  const trib=[
    {pts:[[1516,-10],[1448,120],[1478,240],[1438,318]],name:'汉水',lx:1512,ly:150,size:30},
    {pts:[[284,-10],[354,140],[300,250],[338,318]],name:'涢水',lx:248,ly:150,size:26},
  ];
  const through=(pts)=>{
    for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
      if(i===0)g.moveTo(a[0],a[1]);else g.quadraticCurveTo(a[0],a[1],mx,my);}
    const p=pts[pts.length-1];g.lineTo(p[0],p[1]);
  };
  g.lineCap='round';
  for(const tr of trib){
    g.beginPath();through(tr.pts);g.strokeStyle='rgba(58,186,208,.20)';g.lineWidth=16;g.stroke();
    g.beginPath();through(tr.pts);g.strokeStyle='rgba(60,190,210,.95)';g.lineWidth=6;g.stroke();
    g.beginPath();through(tr.pts);g.strokeStyle='rgba(190,240,244,.5)';g.lineWidth=2;g.stroke();
    song(g,tr.name,tr.lx,tr.ly,tr.size,'rgba(232,250,252,.94)',1,'center');
  }
}
/* 主江隶书大字：白描，压在江面中段 */
export function drawBigRiver(g){
  song(g,'长',548,468,74,'rgba(216,242,246,.52)',1,'center');
  song(g,'江',924,514,74,'rgba(216,242,246,.52)',1,'center');
}
/* 岸线：深描打底 + 亮白边，像图纸上的阵营分界 */
export function drawBanks(g){
  for(let which=0;which<2;which++){
    g.beginPath();for(let x=0;x<=W;x+=7){const y=which?bottom(x):top(x);x?g.lineTo(x,y):g.moveTo(x,y)}
    g.strokeStyle='rgba(8,28,32,.82)';g.lineWidth=12;g.stroke();
    g.strokeStyle='rgba(242,240,222,.95)';g.lineWidth=5.5;g.stroke();
  }
  /* 近岸村道，仅作地貌感 */
  g.setLineDash([5,8]);g.beginPath();g.moveTo(40,166);g.bezierCurveTo(350,260,620,188,850,320);g.strokeStyle='rgba(232,214,160,.32)';g.lineWidth=3;g.stroke();g.beginPath();g.moveTo(148,912);g.bezierCurveTo(520,864,700,1002,1020,760);g.stroke();g.setLineDash([]);
}
/* 江面流动线：随时间横向漂移，读作水流 */
export let currents=null;
export function makeCurrents(){const r=rng(5150);currents=Array.from({length:210},()=>({x:r()*W,y:r(),len:r()*46+16,sp:.3+r()*.7,ph:r()*60}))}
export function drawCurrents(g,t){
  if(!currents)return;g.save();g.lineCap='round';
  for(const c of currents){
    const ty=top(c.x)+22,by=bottom(c.x)-22,y=ty+(by-ty)*c.y;
    const x=((c.x+t*c.sp*30+c.ph*30)%(W+240)+W+240)%(W+240)-120;
    line(g,x,y,x+c.len,y-1.5,'rgba(196,232,220,.11)',1.6);
  }
  g.restore();
}
export function drawCity(g,name,x,y,up=true){
  g.save();
  g.fillStyle='rgba(10,14,16,.92)';g.beginPath();g.arc(x,y,7,0,2*PI);g.fill();
  g.strokeStyle='rgba(240,232,200,.9)';g.lineWidth=2;g.stroke();
  g.font=`700 25px ${SONG}`;g.textAlign='center';g.textBaseline='middle';g.fillStyle='rgba(240,233,206,.95)';
  g.shadowColor='rgba(0,0,0,.7)';g.shadowBlur=7;
  g.fillText(name,x,y+(up?-26:28));
  g.restore();
}
/* 赤壁战场底图：两片用同一张地形，城池地望作示意 */
export const CITIES=[
  ['江陵',244,252,true],['乌林',1046,244,true],['夏口',1638,252,true],
  ['赤壁',250,846,false],['樊口',1128,858,false],
];
export function makeMap(cities=CITIES){
  paintBase(map);
  drawTexture(map);
  drawRivers(map);
  drawBigRiver(map);
  drawBanks(map);
  for(const c of cities)drawCity(map,...c);
}

/* ================= 动态层：单位与兵棋 ================= */
/* 头像圆形裁切表：源图已由 tools/unify_commander_cards.py 统一为 480×480
   （按 Haar 人脸框缩放平移：脸高 200px、脸心居中；高冠/高盔人物单独下移留头顶），
   因此全部走同一方形裁切 [0,0,480]，14 张卡的头脸比例与居中度一致。
   原始素材：三国人物/*.png。新卡已定稿，旧卡与中间产物已清理。
   本表与 assets/commanders/crops.json 必须保持一致（改卡后两处同步）。 */
const PORTRAIT_CROP={
  zhouyu:[0,0,480],sunquan:[0,0,480],cao:[0,0,480],liu:[0,0,480],
  caoren:[0,0,480],chengpu:[0,0,480],handang:[0,0,480],zhoutai:[0,0,480],
  ganning:[0,0,480],taishici:[0,0,480],lingtong:[0,0,480],lvmeng:[0,0,480],
  liuxun:[0,0,480],huanggai:[0,0,480],
  yuan:[0,0,480],
  zhanghe:[0,0,480],xunyu:[0,0,480],xunyou:[0,0,480],xuhuang:[0,0,480],
  tianfeng:[0,0,480],shenpei:[0,0,480],fengji:[0,0,480],guotu:[0,0,480],jiaxu:[0,0,480],
  yanliang:[0,0,480],wenchou:[0,0,480],
  guojia:[0,0,480],zhangliao:[0,0,480],yujin:[0,0,480],lejin:[0,0,480],
  xuchu:[0,0,480],caohong:[0,0,480],xiahouyuan:[0,0,480]
};
/* 世界坐标版头像盘：跟地图一起缩放（用于钉在营地/城头的将官卡）。
   r/z 由调用方给出，边框线宽也按 1/z 缩放，保证视觉粗细稳定。 */
export function portraitDisc(g,key,x,y,r,color,lw,z){
  g.save();
  g.shadowColor='rgba(0,0,0,.55)';g.shadowBlur=14/z;
  g.fillStyle='#10242a';g.beginPath();g.arc(x,y,r+3/z,0,PI*2);g.fill();
  g.shadowBlur=0;
  g.beginPath();g.arc(x,y,r,0,PI*2);g.clip();
  const im=images[key];
  if(im){
    const c=PORTRAIT_CROP[key];
    if(c&&im.width===480)g.drawImage(im,c[0],c[1],c[2],c[2],x-r,y-r,2*r,2*r);
    else g.drawImage(im,0,0,im.width,im.height,x-r,y-r,2*r,2*r);
  }
  g.restore();
  g.strokeStyle=color;g.lineWidth=lw;g.beginPath();g.arc(x,y,r+1.5/z,0,PI*2);g.stroke();
}
export function circlePortrait(g,key,x,y,r,color,label){
  /* 记录本帧已出现的主帅（alpha 足够高才算）：势力/阵营常驻小卡据此让位，
     避免同一帧里同一个人出现两张卡。每帧开始时由场景清空该集合。 */
  if(g.globalAlpha>.35)(g._cmdSeen||(g._cmdSeen=new Set())).add(key);
  g.save();g.shadowColor='rgba(0,0,0,.55)';g.shadowBlur=15;g.fillStyle='#10242a';g.beginPath();g.arc(x,y,r+4,0,PI*2);g.fill();g.shadowBlur=0;
  g.beginPath();g.arc(x,y,r,0,PI*2);g.clip();const im=images[key];
  if(im){
    const c=PORTRAIT_CROP[key];
    if(c&&im.width===480)g.drawImage(im,c[0],c[1],c[2],c[2],x-r,y-r,2*r,2*r);   /* 面部居中方形，无拉伸 */
    else g.drawImage(im,0,0,im.width,im.height,x-r,y-r,2*r,2*r);
  }
  g.restore();
  g.strokeStyle=color;g.lineWidth=4;g.beginPath();g.arc(x,y,r+2,0,PI*2);g.stroke();
  if(label){g.fillStyle='rgba(8,26,31,.9)';g.beginPath();g.roundRect(x-r-10,y+r-2,2*r+20,27,5);g.fill();txt(g,label,x,y+r+11,20,'#f7edda',700,'center')}
}
export function boat(g,x,y,a,scale,color,fire=0,flag=''){
  g.save();g.translate(x,y);
  /* 船体随航向旋转 */
  g.save();g.rotate(a);g.scale(scale,scale);
  g.shadowColor='rgba(0,0,0,.6)';g.shadowBlur=8;g.shadowOffsetY=6;
  g.fillStyle='#071c22';g.beginPath();g.moveTo(35,0);g.lineTo(19,-13);g.lineTo(-27,-13);g.quadraticCurveTo(-36,0,-27,13);g.lineTo(19,13);g.closePath();g.fill();g.shadowBlur=0;g.shadowOffsetY=0;
  g.fillStyle=color;g.beginPath();g.moveTo(29,0);g.lineTo(16,-9);g.lineTo(-25,-9);g.lineTo(-29,0);g.lineTo(-25,9);g.lineTo(16,9);g.closePath();g.fill();
  g.fillStyle='rgba(245,226,182,.38)';g.fillRect(-20,-5,34,10);g.fillStyle='#0e2428';g.fillRect(-6,-7,10,14);
  line(g,-7,0,-7,-25,'#dec58c',2);if(flag){g.fillStyle=flag==='黄'?'#55d6b3':'#c86550';g.beginPath();g.moveTo(-7,-25);g.lineTo(15,-20);g.lineTo(-7,-15);g.fill()}
  g.restore();
  /* 火苗：不随船身旋转，始终垂直向上 */
  if(fire>0){
    g.save();g.scale(scale,scale);
    g.shadowColor='#ff8c2f';g.shadowBlur=26;
    for(let k=0;k<5;k++){const fx=-26+k*13,wob=Math.sin(k*2.3)*2.4,top=-30-fire*42-((k*9)%14);
      g.fillStyle=k%2?'#ffc35c':'#ff743b';
      g.beginPath();g.moveTo(fx-6,12);g.quadraticCurveTo(fx-8+wob,top*.55,fx+wob,top);g.quadraticCurveTo(fx+5+wob,top*.55,fx+6,12);g.closePath();g.fill();}
    g.shadowBlur=0;
    for(let k=0;k<3;k++){const fx=-18+k*13,top=-14-fire*26;
      g.fillStyle='rgba(255,242,196,.85)';
      g.beginPath();g.moveTo(fx-3,9);g.quadraticCurveTo(fx-2,top*.6,fx,top);g.quadraticCurveTo(fx+2,top*.6,fx+3,9);g.closePath();g.fill();}
    g.restore();
  }
  g.restore();
}
/* 竖幡：示意军旗与阵营（带随风轻摆） */
export function pennant(g,x,y,text,accent,tt=0){
  const h=text.length*30+34,w=44,sway=Math.sin(tt*2.1+x*.01)*3.2;
  g.save();
  g.strokeStyle='#5a4a30';g.lineWidth=3;g.beginPath();g.moveTo(x,y+18);g.lineTo(x,y+h+30);g.stroke();
  g.fillStyle='rgba(232,222,190,.94)';g.beginPath();g.roundRect(x-w/2+sway,y-2,w,h,5);g.fill();
  g.strokeStyle=accent;g.lineWidth=2.5;g.stroke();
  g.fillStyle=accent;g.beginPath();g.moveTo(x-w/2+sway,y);g.lineTo(x+w/2+sway,y);g.lineTo(x+sway,y+12);g.closePath();g.fill();
  vtext(g,text,x+sway,y+h/2+10,26,'#3a2c1c',1,1.06);
  g.restore();
}

/* ================= UI 基元 / 后处理 / 字幕 ================= */
export function makeGrain(seed=7000){
  const tiles=[];
  for(let n=0;n<3;n++){
    const c=document.createElement('canvas');c.width=480;c.height=270;const q=c.getContext('2d');
    const im=q.createImageData(480,270),d=im.data,r=rng(seed+n*137);
    for(let i=0;i<d.length;i+=4){const v=90+r()*76;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}
    q.putImageData(im,0,0);tiles.push(c);
  }
  return tiles;
}
export function makeEmbers(seed,x0,xw,y0,yh,count=70){
  const r=rng(seed);return Array.from({length:count},()=>({x:x0+r()*xw,y0:y0+r()*yh,ph:r()*6.28,sp:.5+r()*.9,sz:1.4+r()*2.4}));
}
export function drawEmbers(g,t,embers,a,rngSpan=430,rise=430){
  if(!embers||a<=0)return;g.save();g.globalAlpha=a;
  for(const e of embers){
    const p=((t*e.sp+e.ph)%4)/4,x=e.x+Math.sin(t*1.3+e.ph)*26,y=e.y0-p*rise;
    if(y<150)continue;g.fillStyle=p>.5?'rgba(255,206,120,.9)':'rgba(255,132,60,.9)';
    g.beginPath();g.arc(x,y,e.sz*(1-p*.4),0,2*PI);g.fill();
  }
  g.restore();
}
/* 调色 + 暗角 + 胶片颗粒（与剧情无关的底噪层） */
export function postFXBase(g,t,grainTiles){
  g.save();g.globalCompositeOperation='overlay';
  g.fillStyle='rgba(255,196,120,.05)';g.fillRect(0,0,W,H);
  g.fillStyle='rgba(20,60,80,.05)';g.fillRect(0,0,W,H);g.restore();
  const vg=g.createRadialGradient(960,520,430,960,520,1120);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(2,13,17,.66)');g.fillStyle=vg;g.fillRect(0,0,W,H);
  if(grainTiles){const idx=Math.floor(t*30)%3;g.save();g.globalAlpha=.06;g.globalCompositeOperation='overlay';
    for(let x=0;x<W;x+=480)for(let y=0;y<H;y+=270)g.drawImage(grainTiles[idx],x+(idx*13)%17,y+(idx*7)%11);g.restore();}
}
/* 字幕：一行一条（数据侧已按标点断句、去标点、≤15 字），白字 + 紧贴文字的窄黑框 */
export const CAPTION_SIZE=48;
export function drawCaption(g,t,captions){
  const c=(captions||[]).find(([a,b])=>t>=a&&t<b);if(!c)return;
  const s=c[2];g.save();
  g.font=`700 ${CAPTION_SIZE}px ${HEI}`;g.textAlign='center';g.textBaseline='middle';
  const tw=g.measureText(s).width,padX=30,padY=17;
  const boxW=tw+padX*2,boxH=CAPTION_SIZE+padY*2,cx=W/2,cy=952;
  g.fillStyle='rgba(0,0,0,.84)';
  g.beginPath();g.roundRect(cx-boxW/2,cy-boxH/2,boxW,boxH,9);g.fill();
  g.strokeStyle='rgba(255,255,255,.16)';g.lineWidth=2;g.stroke();
  g.fillStyle='#fff';g.fillText(s,cx,cy+2);
  g.restore();
}

/* ================= 相机：关键帧区间插值 ================= */
export function cameraMoment(moments,t){
  let i=0;while(i<moments.length-2&&t>moments[i+1][0])i++;
  const p=smooth((t-moments[i][0])/(moments[i+1][0]-moments[i][0]));
  const g=(k)=>moments[i][k]*(1-p)+moments[i+1][k]*p;
  return [g(1),g(2),g(3),g(4)];
}

/* ================= 时间轴映射 =================
   画面按「设计时间」编排；配音收紧后总长变短，以字幕行起点为锚，
   把「新配音时间」分段线性映射回「设计时间」：挂在第 k 句上的关键帧
   落到新配音里第 k 句的同一相对位置。字幕直接用新时间，画面/音效走 WARP。 */
export function makeWarp(designStarts,designEnd,newStarts,newEnd){
  if(!newStarts||newStarts.length!==designStarts.length)return null;   // 稿子行数变了就不硬套，退回原节奏
  const X=[],Y=[];
  for(let i=0;i<newStarts.length;i++){
    const s=Number(newStarts[i]);if(!isFinite(s)||!X.length&&!isFinite(s))continue;
    if(X.length&&s<=X[X.length-1])continue;
    X.push(s);Y.push(designStarts[i]);
  }
  if(!X.length||!(newEnd>X[X.length-1]))return null;
  X.push(Number(newEnd));Y.push(designEnd);
  const warp=t=>{
    const n=X.length;
    if(t<=X[0])return Y[0];
    if(t>=X[n-1])return Y[n-1];
    let i=0;while(i<n-2&&t>=X[i+1])i++;
    const x0=X[i],x1=X[i+1];
    return x1>x0?Y[i]+(Y[i+1]-Y[i])*(t-x0)/(x1-x0):Y[i];
  };
  return {warp,filmEnd:Number(newEnd)};
}

/* ================= 挂载：加载资源 → 取字幕 → 逐帧循环 ================= */
export function mount(scene){
  const cover=new URLSearchParams(location.search).has('cover');
  const state={
    captions:(scene.captions||[]).map(c=>c.slice()),
    filmEnd:scene.seconds||60,
    warp:t=>t,
  };
  function renderAt(t){
    t=Math.max(0,Math.min(state.filmEnd,Number(t)||0));
    const v=state.warp(t);
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);
    scene.draw(ctx,{t,v,captions:state.captions,filmEnd:state.filmEnd,cover});
    return true;
  }
  window.tushuo={renderAt,duration:state.filmEnd,ready:Promise.resolve()};
  const ready=(async()=>{
    await loadImages(scene.assets);
    const content=new URLSearchParams(location.search).get('content')||scene.slug;
    try{
      const res=await fetch(`/output/${content}/captions.json`);
      if(res.ok){
        const data=await res.json();
        if(data.lines&&data.lines.length){
          state.captions=data.lines.map(x=>[x.t,x.end,x.text]);
          const dur=Number(data.duration)||0;
          if(dur>0)state.filmEnd=dur;
          const w=scene.buildTimeline?scene.buildTimeline(data.lines.map(x=>x.t),dur):null;
          if(w){state.warp=w.warp;state.filmEnd=w.filmEnd}
        }
      }
    }catch{}
    scene.prepare&&scene.prepare({W,H,PI,map,images,captions:state.captions,filmEnd:state.filmEnd});
    renderAt(0);
    window.tushuo.duration=state.filmEnd;
  })();
  window.tushuo.ready=ready;
  if(!new URLSearchParams(location.search).has('render')){
    const start=performance.now();
    const go=()=>{renderAt(((performance.now()-start)/1000)%state.filmEnd);requestAnimationFrame(go)};
    ready.then(go);
  }
  return ready;
}
