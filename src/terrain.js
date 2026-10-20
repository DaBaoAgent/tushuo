/* tushuo · 数据驱动地形层
   一场战役只写一份 terrain 配置：高度场（平原／丘陵／山脊）、河流、城池、关隘、
   渡口、粮仓、道路、势力范围与地名。buildTerrain() 一次烤成静态底图；
   势力色块、河水流动等随剧情变化的元素由其它函数逐帧画。

   设计原则：
   - 坐标一律 1920×1080，北向上；所有地望只作相对阵位示意，不做可量测复原。
   - 高度与水面掩膜按逐像素生成，保留晕渲的手绘明暗；河流用掩膜定水面范围，
     再用矢量线补岸线，避免出现「硬贴上去的蓝带子」。
   - 静态底图与动态层分离：底图一次成图，逐帧只画少量矢量与光效，保证 30fps。 */

import {W,H,PI,rng,smooth,SONG} from './engine.js';

export const TERRAIN_DEFAULTS={
  seed:200,
  palette:{
    low:[168,146,106],          /* 低地绢帛色 */
    high:[234,208,158],         /* 高处偏亮 */
    water:[78,124,112],
    waterDeep:[38,78,70],
    ink:'#33261a',
    paper:'#f2e8ce',
  },
  relief:{base:.44,amp:.20,detail:.10,range:.72,flat:.62,light:[-.62,-.66,.44]},
  plains:[],ridges:[],hills:[],
  rivers:[],sites:[],roads:[],labels:[],regions:[],
};

function withDefaults(cfg){
  const c=cfg||{},d=TERRAIN_DEFAULTS;
  return {
    ...d,...c,
    palette:{...d.palette,...(c.palette||{})},
    relief:{...d.relief,...(c.relief||{})},
    plains:c.plains||[],ridges:c.ridges||[],hills:c.hills||[],
    rivers:c.rivers||[],sites:c.sites||[],roads:c.roads||[],
    labels:c.labels||[],regions:c.regions||[],
  };
}

/* ================= 路径：Catmull-Rom 平滑与等距采样 ================= */
export function catmull(p0,p1,p2,p3,u){
  const u2=u*u,u3=u2*u;
  return [
    .5*(2*p1[0]+(-p0[0]+p2[0])*u+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*u2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*u3),
    .5*(2*p1[1]+(-p0[1]+p2[1])*u+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*u2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*u3),
  ];
}
export function smoothPath(pts,closed=false,step=14){
  if(!pts||pts.length<2)return (pts||[]).map(p=>[p[0],p[1]]);
  const p=closed?[pts[pts.length-1],...pts,pts[0],pts[1]]:[pts[0],...pts,pts[pts.length-1]];
  const out=[];
  for(let i=1;i<p.length-2;i++){
    const a=p[i-1],b=p[i],c=p[i+1],d=p[i+2];
    const n=Math.max(2,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/step));
    for(let k=0;k<n;k++)out.push(catmull(a,b,c,d,k/n));
  }
  const last=pts[pts.length-1];out.push([last[0],last[1]]);
  return out;
}
export function buildPath(pts,closed=false,step=14){
  const p=smoothPath(pts,closed,step);
  const cum=[0];
  for(let i=1;i<p.length;i++)cum.push(cum[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));
  return {pts:p,cum,len:cum[cum.length-1]||1,closed};
}
export function pointAtPath(path,u){
  const target=Math.max(0,Math.min(1,u))*path.len;
  let lo=0,hi=path.cum.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(path.cum[mid]<target)lo=mid+1;else hi=mid}
  const i=Math.max(1,lo),a=path.cum[i-1],b=path.cum[i],q=b>a?(target-a)/(b-a):0;
  const p0=path.pts[i-1],p1=path.pts[i];
  return [p0[0]+(p1[0]-p0[0])*q,p0[1]+(p1[1]-p0[1])*q];
}
export function tangentAtPath(path,u){
  const a=pointAtPath(path,Math.max(0,u-.004)),b=pointAtPath(path,Math.min(1,u+.004));
  const dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;
  return [dx/l,dy/l];
}
export function tracePath(g,path){
  const p=path.pts;g.beginPath();g.moveTo(p[0][0],p[0][1]);
  for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);
}

/* 同一份配置里的路径只平滑一次，逐帧复用 */
const pathCache=new WeakMap();
function cachePath(obj,key,pts,closed,step){
  let m=pathCache.get(obj);if(!m){m=new Map();pathCache.set(obj,m)}
  if(!m.has(key))m.set(key,buildPath(pts,closed,step));
  return m.get(key);
}

/* ================= 高度场 ================= */
function distToSegment(px,py,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1;
  const l2=dx*dx+dy*dy;
  let t=l2>0?((px-x1)*dx+(py-y1)*dy)/l2:0;
  t=Math.max(0,Math.min(1,t));
  return Math.hypot(px-(x1+dx*t),py-(y1+dy*t));
}
function makeOctaves(seed){
  const o=(n,s)=>octaveLocal(seed+s,n);
  return [o(3,11),o(7,97),o(14,311),o(28,701),o(56,1301)];
}
/* 与 engine.octave 同构的局部实现：terrain 不依赖赤壁底图，便于单独演进 */
function octaveLocal(seed,N){
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
function buildHeightField(cfg){
  const {relief}=cfg;
  const [o1,o2,o3,o4,o5]=makeOctaves(cfg.seed);
  const ridges=(cfg.ridges||[]).map(r=>({
    pts:smoothPath(r.pts,false,24),width:r.width||100,
    height:r.height||.28,falloff:r.falloff??1.7,
  }));
  const hills=cfg.hills||[],plains=cfg.plains||[];
  const Hf=new Float32Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const u=x/W,v=y/H;
    let e=relief.base
      +relief.amp*(.56*(1-Math.abs(2*o1(u,v)-1))+.44*o2(u,v))
      +relief.detail*(o3(u,v)*.55+o4(u,v)*.3+o5(u,v)*.15);
    for(const r of ridges){
      let d=1e9;
      for(let i=1;i<r.pts.length;i++){
        const dd=distToSegment(x,y,r.pts[i-1][0],r.pts[i-1][1],r.pts[i][0],r.pts[i][1]);
        if(dd<d)d=dd;
      }
      e+=r.height*Math.exp(-Math.pow(d/r.width,2)*r.falloff);
    }
    for(const h of hills){
      const dx=(x-h.x)/(h.rx||180),dy=(y-h.y)/(h.ry||140);
      e+=(h.h||.16)*Math.exp(-(dx*dx+dy*dy)*1.6);
    }
    let flat=0;
    for(const p of plains){
      const dx=(x-p.x)/(p.rx||400),dy=(y-p.y)/(p.ry||300);
      const q=1-(dx*dx+dy*dy);
      if(q>flat)flat=Math.max(0,q);
    }
    e*=1-flat*relief.flat;
    Hf[y*W+x]=smooth(Math.max(0,Math.min(1,(e-.16)/relief.range)));
  }
  return Hf;
}

/* ================= 水面掩膜 ================= */
function buildWaterMask(cfg){
  const c=document.createElement('canvas');c.width=W;c.height=H;
  const g=c.getContext('2d',{alpha:true});
  g.clearRect(0,0,W,H);
  g.lineCap='round';g.lineJoin='round';
  for(const r of cfg.rivers){
    const path=cachePath(r,'mask',r.pts,false,10);
    const w=r.width||18;
    g.strokeStyle='rgba(255,255,255,.28)';g.lineWidth=w+14;tracePath(g,path);g.stroke();
    g.strokeStyle='rgba(255,255,255,.72)';g.lineWidth=w+5;tracePath(g,path);g.stroke();
    g.strokeStyle='#fff';g.lineWidth=w;tracePath(g,path);g.stroke();
  }
  return g.getImageData(0,0,W,H).data;
}

/* ================= 底图：逐像素晕渲＋水面融合 ================= */
export function buildTerrain(g,rawCfg){
  const cfg=withDefaults(rawCfg);
  const pal=cfg.palette,rel=cfg.relief;
  const Hf=buildHeightField(cfg);
  const wm=buildWaterMask(cfg);
  const img=g.createImageData(W,H),d=img.data;
  const k=22,Lx=rel.light[0],Ly=rel.light[1],Lz=rel.light[2],Ln=Math.hypot(Lx,Ly,Lz);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x;
    const hx=(x>0&&x<W-1)?Hf[i+1]-Hf[i-1]:0,hy=(y>0&&y<H-1)?Hf[i+W]-Hf[i-W]:0;
    let nx=-hx*k,ny=-hy*k,nz=1;const nl=Math.hypot(nx,ny,nz);nx/=nl;ny/=nl;nz/=nl;
    let sh=(nx*Lx+ny*Ly+nz*Lz)/Ln;sh=Math.max(0,sh);sh=.70+.62*sh;
    const e=Hf[i];
    const fiber=Math.sin(x*.021+y*.017)*3.2+Math.sin(x*.113-y*.087)*1.6;
    let lr=pal.low[0]+(pal.high[0]-pal.low[0])*e+fiber;
    let lg=pal.low[1]+(pal.high[1]-pal.low[1])*e+fiber;
    let lb=pal.low[2]+(pal.high[2]-pal.low[2])*e+fiber*.7;
    lr*=sh;lg*=sh;lb*=sh;
    const wa=wm[i*4+3]/255;
    if(wa>0){
      const depth=smooth(Math.min(1,wa*1.25));
      const flow=Math.sin(x*.019+y*.043)*2.4+Math.sin(x*.051-y*.021)*1.2;
      const wr=pal.water[0]+(pal.waterDeep[0]-pal.water[0])*depth+flow;
      const wg=pal.water[1]+(pal.waterDeep[1]-pal.water[1])*depth+flow;
      const wb=pal.water[2]+(pal.waterDeep[2]-pal.water[2])*depth+flow;
      const a=Math.pow(wa,.72);
      lr=lr*(1-a)+wr*a;lg=lg*(1-a)+wg*a;lb=lb*(1-a)+wb*a;
    }
    d[i*4]=Math.max(0,Math.min(255,lr));
    d[i*4+1]=Math.max(0,Math.min(255,lg));
    d[i*4+2]=Math.max(0,Math.min(255,lb));
    d[i*4+3]=255;
  }
  g.putImageData(img,0,0);
  drawFibers(g,cfg,wm);
  drawRivers(g,cfg);
  drawRoads(g,cfg);
  drawHillSymbols(g,cfg);
  drawLabels(g,cfg);
  drawSites(g,cfg);
  return {cfg,height:Hf,water:wm};
}

function drawFibers(g,cfg,wm){
  const r=rng(cfg.seed+51);
  const waterAt=(x,y)=>wm[((y|0)*W+(x|0))*4+3]>50;
  for(let i=0;i<8200;i++){
    const x=r()*W,y=r()*H;if(waterAt(x,y))continue;
    const s=.6+r()*2.0;
    g.fillStyle=r()>.5?'rgba(255,246,214,.055)':'rgba(42,32,18,.06)';
    g.fillRect(x,y,s,s);
  }
  for(let i=0;i<260;i++){
    const x=r()*W,y=r()*H;if(waterAt(x,y))continue;
    const len=8+r()*30,a=-.35+r()*.7;
    g.strokeStyle=r()>.5?'rgba(255,248,220,.045)':'rgba(48,38,22,.05)';
    g.lineWidth=.8;
    g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len);g.stroke();
  }
}

/* ================= 矢量层：河流 / 道路 / 山形 / 地名 / 点位 ================= */
function drawRivers(g,cfg){
  g.save();g.lineCap='round';g.lineJoin='round';
  for(const r of cfg.rivers){
    const path=cachePath(r,'draw',r.pts,false,12);
    const w=r.width||18;
    tracePath(g,path);g.strokeStyle='rgba(242,232,206,.46)';g.lineWidth=w+10;g.stroke();
    tracePath(g,path);g.strokeStyle='rgba(28,68,60,.20)';g.lineWidth=w+3;g.stroke();
    tracePath(g,path);g.strokeStyle='rgba(218,242,230,.34)';g.lineWidth=Math.max(1.2,w*.075);g.stroke();
    if(r.name&&r.label!==false){
      const at=r.labelAt||[.5,.5];
      const p=pointAtPath(path,at[0]);
      inkLabel(g,r.name,(r.labelX??p[0]),r.labelY??(p[1]-w*.8),(r.labelSize||27),g._terrainAlpha??1);
    }
  }
  g.restore();
}
function drawRoads(g,cfg){
  g.save();g.setLineDash([7,8]);g.lineCap='round';
  for(const r of cfg.roads||[]){
    const path=cachePath(r,'road',r.pts,false,16);
    tracePath(g,path);g.strokeStyle=r.color||'rgba(92,72,44,.38)';g.lineWidth=r.width||2.4;g.stroke();
  }
  g.setLineDash([]);g.restore();
}
function drawHillSymbols(g,cfg){
  g.save();g.lineCap='round';
  for(const h of cfg.hills||[]){
    if(h.symbol===false)continue;
    const s=h.symbolScale||1;
    g.strokeStyle='rgba(64,50,30,.34)';g.lineWidth=1.8;
    for(let k=0;k<3;k++){
      const x=h.x-s*34+k*s*7,y=h.y+18-k*s*11;
      g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+s*12,y-12*s,x+s*26,y-2*s);g.stroke();
    }
    if(h.name)inkLabel(g,h.name,h.nameX??h.x,h.nameY??(h.y-42),22,.62);
  }
  g.restore();
}
function drawLabels(g,cfg){
  for(const l of cfg.labels||[]){
    const size=l.size||72,alpha=l.alpha??.20,color=l.color||'rgba(58,44,26,1)';
    g.save();g.globalAlpha*=alpha;
    g.font=`700 ${size}px ${SONG}`;g.textAlign='center';g.textBaseline='middle';g.fillStyle=color;
    const gap=l.gap??size*.28,chars=[...l.text],total=chars.length*size+gap*(chars.length-1);
    let x=l.x-total/2+size/2;
    if(l.vertical){
      let y=(l.y||0)-(chars.length-1)*(size+gap)/2;
      for(const c of chars){g.fillText(c,l.x,y);y+=size+gap}
    }else{
      for(const c of chars){g.fillText(c,x,l.y);x+=size+gap}
    }
    g.restore();
  }
}
function inkLabel(g,s,x,y,size,alpha=1,align='center'){
  if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;g.font=`700 ${size}px ${SONG}`;g.textAlign=align;g.textBaseline='middle';g.lineJoin='round';
  g.strokeStyle='rgba(242,232,206,.82)';g.lineWidth=Math.max(3,size*.18);g.strokeText(s,x,y);
  g.fillStyle='#33261a';g.fillText(s,x,y);g.restore();
}

/* 点位：都城 / 城 / 关 / 津 / 粮仓 / 垒 */
function siteLabel(g,s,x,y,size,sc,offset=30){
  const dy=(s.up===false?1:-1)*offset*sc;
  inkLabel(g,s.name,x,y+dy,size);
}
function drawSites(g,cfg){
  for(const s of cfg.sites||[]){
    const k=s.kind||'city',x=s.x,y=s.y,sc=s.size||1;
    g.save();
    if(k==='capital'){
      drawWalled(g,x,y,sc);
      siteLabel(g,s,x,y,s.fontSize||29,sc,38);
    }else if(k==='city'){
      g.fillStyle='rgba(242,232,206,.95)';g.beginPath();g.arc(x,y,8*sc,0,PI*2);g.fill();
      g.strokeStyle='rgba(52,40,26,.85)';g.lineWidth=2;g.stroke();
      g.fillStyle='#3a2b1a';g.beginPath();g.arc(x,y,4.2*sc,0,PI*2);g.fill();
      siteLabel(g,s,x,y,s.fontSize||24,sc,27);
    }else if(k==='pass'){
      g.strokeStyle='rgba(52,40,26,.9)';g.lineWidth=3.2;
      g.beginPath();g.moveTo(x-11*sc,y+8*sc);g.lineTo(x-11*sc,y-7*sc);g.moveTo(x+11*sc,y+8*sc);g.lineTo(x+11*sc,y-7*sc);
      g.moveTo(x-15*sc,y-7*sc);g.lineTo(x+15*sc,y-7*sc);g.stroke();
      g.fillStyle='rgba(242,232,206,.9)';g.fillRect(x-4*sc,y-17*sc,8*sc,9*sc);
      siteLabel(g,s,x,y,s.fontSize||24,sc,33);
    }else if(k==='ford'){
      g.strokeStyle='rgba(52,40,26,.85)';g.lineWidth=2.4;
      for(let i=0;i<3;i++){
        g.beginPath();
        g.moveTo(x-13*sc,y-5*sc+i*6*sc);
        g.quadraticCurveTo(x-5*sc,y-10*sc+i*6*sc,x,y-5*sc+i*6*sc);
        g.quadraticCurveTo(x+5*sc,y+i*6*sc,x+13*sc,y-5*sc+i*6*sc);
        g.stroke();
      }
      siteLabel(g,s,x,y,s.fontSize||24,sc,31);
    }else if(k==='granary'){
      for(let i=-1;i<=1;i++){
        const px=x+i*14*sc,py=y+(i===0?-3*sc:3*sc);
        g.fillStyle='rgba(238,226,196,.95)';g.beginPath();g.arc(px,py,7*sc,0,PI*2);g.fill();
        g.strokeStyle='rgba(64,48,28,.85)';g.lineWidth=1.8;g.stroke();
        g.beginPath();g.moveTo(px-7*sc,py-3*sc);g.lineTo(px,py-11*sc);g.lineTo(px+7*sc,py-3*sc);g.stroke();
      }
      siteLabel(g,s,x,y,s.fontSize||26,sc,33);
      if(s.note)inkLabel(g,s.note,x,y+18*sc,16,.85);
    }else if(k==='fort'){
      g.strokeStyle='rgba(58,44,28,.9)';g.lineWidth=2.6;
      g.strokeRect(x-13*sc,y-13*sc,26*sc,26*sc);
      g.beginPath();g.moveTo(x-13*sc,y-6*sc);g.lineTo(x+13*sc,y-6*sc);g.stroke();
      g.fillStyle='rgba(242,232,206,.9)';g.fillRect(x-5*sc,y-13*sc,10*sc,7*sc);
      siteLabel(g,s,x,y,s.fontSize||26,sc,33);
    }else if(k==='campSite'){
      g.strokeStyle='rgba(58,44,28,.75)';g.lineWidth=2;g.setLineDash([5,4]);
      g.strokeRect(x-20*sc,y-14*sc,40*sc,28*sc);g.setLineDash([]);
      siteLabel(g,s,x,y,s.fontSize||22,sc,30);
    }
    g.restore();
  }
}
function drawWalled(g,x,y,sc){
  const w=26*sc,h=20*sc;
  g.fillStyle='rgba(242,232,206,.92)';g.fillRect(x-w/2,y-h/2,w,h);
  g.strokeStyle='rgba(52,40,26,.92)';g.lineWidth=2.2;g.strokeRect(x-w/2,y-h/2,w,h);
  g.fillStyle='rgba(52,40,26,.9)';
  for(let i=0;i<4;i++)g.fillRect(x-w/2+i*w/4+1,y-h/2-4*sc,w/8,4*sc);
  g.beginPath();g.arc(x,y,4*sc,0,PI*2);g.fill();
}

/* ================= 动态层 ================= */
/* 势力范围：多边形色块。每帧调用，alpha 由剧情控制。 */
export function drawRegionWash(g,cfg,opts={}){
  const {alpha=1,key=null,border=false,color=null}=opts;
  for(const r of cfg.regions||[]){
    if(key&&r.key!==key)continue;
    const a=(r.alpha??.07)*alpha;
    if(a<=0)continue;
    const path=cachePath(r,'region',r.pts,true,24);
    g.save();g.globalAlpha*=a;
    tracePath(g,path);g.closePath();
    g.fillStyle=color||r.color||'#b4553e';g.fill();
    if(border){g.globalAlpha*=.5;g.strokeStyle=g.fillStyle;g.lineWidth=2;g.setLineDash([10,8]);g.stroke();g.setLineDash([])}
    g.restore();
  }
}
/* 河水流动：沿河道的细亮线，随时间向下游漂移；只作动态质感，不表现真实流速。 */
const currentCache=new WeakMap();
function riverParticles(river,seed){
  let m=currentCache.get(river);if(m)return m;
  const r=rng(seed),arr=[];
  for(let i=0;i<46;i++)arr.push({u:r(),sp:.012+r()*.028,len:9+r()*20,ph:r()*6.28});
  currentCache.set(river,arr);return arr;
}
export function drawRiverCurrents(g,cfg,t=0,alpha=.5){
  if(alpha<=0)return;
  g.save();g.lineCap='round';
  cfg.rivers.forEach((r,ri)=>{
    const path=cachePath(r,'draw',r.pts,false,12);
    const parts=riverParticles(r,cfg.seed+ri*71);
    for(const p of parts){
      const u=((p.u+t*p.sp)%1+1)%1;
      const pt=pointAtPath(path,u),tg=tangentAtPath(path,u);
      const l=p.len*(.7+.3*Math.sin(t*1.6+p.ph));
      g.strokeStyle=`rgba(214,242,232,${(.10+.07*Math.sin(t*1.3+p.ph))*alpha})`;
      g.lineWidth=1.5;
      g.beginPath();g.moveTo(pt[0]-tg[0]*l/2,pt[1]-tg[1]*l/2);g.lineTo(pt[0]+tg[0]*l/2,pt[1]+tg[1]*l/2);g.stroke();
    }
  });
  g.restore();
}
/* 给场景用的点位查询与描边（有时需要在动态层补画/高亮） */
export function siteOf(cfg,name){return (cfg.sites||[]).find(s=>s.name===name)}
export function drawSiteHalo(g,x,y,r,color,alpha=1,t=0){
  if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;
  const pulse=1+.06*Math.sin(t*3.1);
  g.strokeStyle=color;g.lineWidth=2.4;g.setLineDash([9,7]);
  g.beginPath();g.arc(x,y,r*pulse,0,PI*2);g.stroke();g.setLineDash([]);
  g.restore();
}
