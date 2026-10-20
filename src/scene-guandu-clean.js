/* 官渡之战 · 纯净地形版（clean 管线）
   —— 与 guandu-full 完全独立：没有军营、方阵、人马、行军路线。
   画面只有：写实地形（山脉/河流/森林/草地/平原/城镇）+ 两方势力色 + 随口播移动的主帅卡。
   口播里提到谁，谁的卡就浮到对应地理位置；镜头缓慢跟随，不切硬镜。 */
import {W,H,PI,HEI,txt,smooth,range,fade,drawCaption,mount,postFXBase,makeGrain} from './engine.js';

const SEED=208122;
const rnd=(s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296})(SEED);

/* ---------- 地理：与正片同一套相对位置 ---------- */
const RIVER=[[-60,442],[120,400],[330,362],[560,334],[790,307],[1020,282],[1250,252],[1470,216],[1690,186],[1980,154]];
const HUANGHE=[[-60,430],[140,392],[360,356],[600,326],[840,300],[1080,274],[1320,244],[1560,208],[1980,152]];
const SITES=[
  {n:'邺城',x:1310,y:175,kind:'cap',s:1.20},
  {n:'许都',x:845,y:915,kind:'cap',s:1.12},
  {n:'官渡',x:948,y:700,kind:'fort',s:1.16},
  {n:'白马',x:268,y:420,kind:'town',s:1.0},
  {n:'延津',x:640,y:404,kind:'ford',s:1.0},
  {n:'乌巢',x:570,y:500,kind:'gra',s:1.05},
  {n:'中牟',x:1120,y:790,kind:'town',s:.92},
];
const MOUNTAINS=[
  {pts:[[-40,40],[120,86],[300,60],[440,120],[560,96],[700,150]],w:120,h:.9,n:'太行'},
  {pts:[[-40,760],[120,800],[300,780],[440,850],[560,820]],w:110,h:.7,n:'嵩山'},
  {pts:[[1500,960],[1660,900],[1800,940],[1940,880]],w:100,h:.6},
];
const FORESTS=[
  {x:300,y:230,r:90,n:46},{x:760,y:150,r:70,n:30},{x:1220,y:640,r:80,n:36},
  {x:420,y:620,r:70,n:28},{x:1600,y:520,r:100,n:44},{x:980,y:1000,r:80,n:32},
  {x:150,y:980,r:70,n:26},{x:1420,y:760,r:66,n:24},
];
const GRASS=[
  {x:700,y:520,rx:330,ry:150},{x:1120,y:430,rx:260,ry:130},
  {x:520,y:830,rx:300,ry:140},{x:1500,y:330,rx:240,ry:110},
];

/* ---------- 人物卡：key / 名字 / 地理锚点 / 阵营 ---------- */
const FIGS=[
  {k:'yuan',    n:'袁绍', x:1310, y:175, side:'yuan', r:54},
  {k:'guotu',   n:'郭图', x:1268, y:262, side:'yuan', r:32},
  {k:'zhanghe', n:'张郃', x:1140, y:392, side:'yuan', r:34},
  {k:'tianfeng',n:'田丰', x:1372, y:120, side:'yuan', r:28},
  {k:'shenpei', n:'审配', x:1392, y:196, side:'yuan', r:28},
  {k:'cao',     n:'曹操', x:845,  y:915, side:'cao',  r:54},
  {k:'xunyou',  n:'荀攸', x:900,  y:812, side:'cao',  r:30},
  {k:'xuhuang', n:'徐晃', x:1010, y:742, side:'cao',  r:30},
  {k:'xunyu',   n:'荀彧', x:845,  y:915, side:'cao',  r:26},
  {k:'caoren',  n:'曹仁', x:1120, y:790, side:'cao',  r:28},
];
const FAC={yuan:'#d92f1f',cao:'#1f7fd0'};
const CLR={yuan:'#ff6a4d',cao:'#5ec8ff'};

let CAPS=[],TARGETS=[],FILM=600,CURZ=1,grain=null;
const STATE={};  /* key -> {x,y,r,a} 屏幕态，指数平滑 */

/* ---------- 口播 → 人物/地点 ---------- */
function readLine(text){
  const hit=[];
  const order=['袁绍','张郃','郭图','田丰','审配','曹操','荀攸','徐晃','荀彧','曹仁'];
  for(const nm of order){ if(text.includes(nm)){ const f=FIGS.find(v=>v.n===nm); if(f)hit.push(f); } }
  let fac=null;
  if(hit.length){ fac=hit[0].side; }
  else if(/袁|河北|邺城|十万|精兵/.test(text)) fac='yuan';
  else if(/曹操|许都|官渡|粮|兵不满|一万/.test(text)) fac='cao';
  return {hit,fac};
}
function legendClean(g){
  const x=64,y=H-176;
  g.save();
  g.fillStyle='rgba(18,26,24,.62)';g.beginPath();g.roundRect(x-14,y-26,320,86,10);g.fill();
  g.strokeStyle='rgba(226,214,180,.22)';g.lineWidth=1.2;g.stroke();
  g.font=`600 19px ${HEI}`;g.textAlign='left';g.textBaseline='middle';
  g.fillStyle='#e8dcc0';g.fillText('势力范围',x+2,y-4);
  const rows=[['#d92f1f','袁绍 · 河北四州'],['#1f7fd0','曹操 · 河南兖豫']];
  rows.forEach(([c,t],i)=>{
    const ry=y+24+i*30;
    g.fillStyle=c;g.beginPath();g.roundRect(x+2,ry-9,26,18,4);g.fill();
    g.fillStyle='#efe6cf';g.font=`500 18px ${HEI}`;g.fillText(t,x+40,ry);
  });
  g.restore();
}
function siteByName2(n){return SITES.find(s=>s.n===n)}

function buildTargets(caps){
  const out=[];
  for(let i=0;i<caps.length;i++){
    const [t0,t1,txt0]=caps[i];
    const {hit,fac}=readLine(txt0);
    let cx=960,cy=540,z=1.03;
    if(hit.length){
      const f=hit[0];
      cx=f.x;cy=f.y;z=f.r>40?1.42:1.30;
    }else if(fac==='yuan'){cx=1180;cy=330;z=1.12}
    else if(fac==='cao'){cx=900;cy=760;z=1.12}
    else{
      /* 中性句：按句子里出现的城名取景 */
      let s=null;
      for(const q of SITES) if(txt0.includes(q.n)){s=q;break}
      if(s){cx=s.x;cy=s.y;z=1.20}
    }
    out.push({t0,t1,cx,cy,z,hit,fac});
  }
  return out;
}
function targetAt(v){
  if(!TARGETS.length)return {cx:960,cy:540,z:1.02,hit:[],fac:null};
  let k=0;while(k<TARGETS.length-1&&v>=TARGETS[k].t1)k++;
  return TARGETS[k];
}
/* 慢速平滑跟随：0.9 秒过渡，缓入缓出 */
function cameraAt(v){
  if(!TARGETS.length)return [1.02,960,540];
  const a=targetAt(v);
  const k=Math.max(0,TARGETS.indexOf(a));
  const prev=TARGETS[Math.max(0,k-1)];
  const f=smooth(v,a.t0,a.t0+0.9);
  const z=prev.z+(a.z-prev.z)*f, cx=prev.cx+(a.cx-prev.cx)*f, cy=prev.cy+(a.cy-prev.cy)*f;
  const br=Math.sin(v*.55)*.004+1;         /* 轻微呼吸 */
  return [z*br, cx+Math.sin(v*.33)*7, cy+Math.cos(v*.27)*5];
}

/* ---------- 地形绘制 ---------- */
function ridge(g,pts,w,h){
  /* 山体块面：沿脊线生成带噪声的上下边缘，整体做西北亮、东南暗的坡面明暗，
     再叠脊线与冲沟，避免“复制三角锥”的假感。 */
  const spine=[];
  for(let i=0;i<pts.length-1;i++){
    const [x0,y0]=pts[i],[x1,y1]=pts[i+1];
    const n=Math.max(4,Math.round(Math.hypot(x1-x0,y1-y0)/36));
    for(let j=0;j<n;j++){const u=j/n;spine.push([x0+(x1-x0)*u,y0+(y1-y0)*u])}
  }
  spine.push(pts[pts.length-1]);
  const up=[],dn=[];
  spine.forEach((p,i)=>{
    const t=i/Math.max(1,spine.length-1);
    const bulge=Math.sin(t*PI)*(0.55+0.45*Math.sin(i*0.9));
    const ww=w*(0.45+0.85*bulge)*(0.85+0.3*rnd())*h;
    up.push([p[0]-ww*0.92,p[1]-ww*0.62]);
    dn.push([p[0]+ww*0.95,p[1]+ww*0.78]);
  });
  g.save();
  /* 山体投影：整体向右下压一层，制造体量 */
  g.beginPath();g.moveTo(up[0][0]+10,up[0][1]+14);
  for(const p of up)g.lineTo(p[0]+10,p[1]+14);
  for(let i=dn.length-1;i>=0;i--)g.lineTo(dn[i][0]+10,dn[i][1]+14);
  g.closePath();g.fillStyle='rgba(58,42,26,.22)';g.fill();
  g.beginPath();g.moveTo(up[0][0],up[0][1]);
  for(const p of up)g.lineTo(p[0],p[1]);
  for(let i=dn.length-1;i>=0;i--)g.lineTo(dn[i][0],dn[i][1]);
  g.closePath();
  const y0=Math.min(...up.map(p=>p[1])),y1=Math.max(...dn.map(p=>p[1]));
  const gr=g.createLinearGradient(0,y0,0,y1);
  gr.addColorStop(0,'rgba(186,204,180,.94)');
  gr.addColorStop(.42,'rgba(132,166,148,.92)');
  gr.addColorStop(.78,'rgba(96,132,118,.90)');
  gr.addColorStop(1,'rgba(78,108,96,.88)');
  g.fillStyle=gr;g.fill();
  g.strokeStyle='rgba(52,60,50,.55)';g.lineWidth=2.2;g.stroke();
  /* 山脊线 + 两侧冲沟 */
  g.strokeStyle='rgba(72,56,36,.55)';g.lineWidth=2.4;g.lineJoin='round';
  g.beginPath();spine.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();
  for(let k=0;k<spine.length;k+=2){
    const p=spine[k],u=up[k],d=dn[k];
    g.strokeStyle='rgba(74,58,38,.34)';g.lineWidth=1.2;
    g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(u[0],u[1]);g.stroke();
    g.strokeStyle='rgba(58,44,28,.30)';
    g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(d[0],d[1]);g.stroke();
  }
  /* 高处受光：沿脊线提亮一条 */
  g.strokeStyle='rgba(238,224,192,.55)';g.lineWidth=5;
  g.beginPath();spine.forEach((p,i)=>{const q=[p[0]-2,p[1]-3];i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1])});g.stroke();
  g.restore();
}
function farmland(g){
  /* 中原农田：细碎地块，绿/麦黄交替，压低饱和度避免抢戏 */
  const zones=[[820,470,300,150],[1080,560,260,130],[560,700,280,150],[1240,430,220,110]];
  for(const [zx,zy,zw,zh] of zones){
    for(let i=0;i<90;i++){
      const x=zx+(rnd()-.5)*zw, y=zy+(rnd()-.5)*zh;
      const w=14+rnd()*26, h=8+rnd()*14, a=(rnd()-.5)*.25;
      g.save();g.translate(x,y);g.rotate(a);
      g.fillStyle=rnd()>.5?`rgba(${150+rnd()*30|0},${146+rnd()*28|0},${88+rnd()*26|0},.22)`
                          :`rgba(${196+rnd()*26|0},${178+rnd()*24|0},${112+rnd()*24|0},.20)`;
      g.fillRect(-w/2,-h/2,w,h);
      g.strokeStyle='rgba(120,100,66,.13)';g.lineWidth=.8;g.strokeRect(-w/2,-h/2,w,h);
      g.restore();
    }
  }
}
function forest(g,f){
  /* 三层树冠：远树小且淡、近树大且深；成簇而非均匀散点 */
  for(let c=0;c<3;c++){
    const cx=f.x+(rnd()-.5)*f.r*.9, cy=f.y+(rnd()-.5)*f.r*.7;
    for(let i=0;i<Math.round(f.n/3);i++){
      const a=rnd()*PI*2, d=Math.sqrt(rnd())*f.r*.55;
      const x=cx+Math.cos(a)*d, y=cy+Math.sin(a)*d*.75;
      const s=(c===0?10:(c===1?7:5))+rnd()*3;
      g.fillStyle='rgba(40,52,26,.26)';
      g.beginPath();g.ellipse(x+s*.3,y+s*.55,s*.95,s*.42,0,0,PI*2);g.fill();
      const g1=58+rnd()*26, g2=42+rnd()*20;
      g.fillStyle=`rgba(${30+rnd()*16|0},${g1|0},${34+rnd()*14|0},${c===0?.95:.85})`;
      g.beginPath();g.arc(x,y,s,0,PI*2);g.fill();
      g.fillStyle=`rgba(${96+rnd()*30|0},${g1+34|0},${56+rnd()*18|0},.55)`;
      g.beginPath();g.arc(x-s*.30,y-s*.34,s*.52,0,PI*2);g.fill();
    }
  }
}
function grass(g,p){
  g.save();
  const gr=g.createRadialGradient(p.x,p.y,10,p.x,p.y,p.rx);
  gr.addColorStop(0,'rgba(146,158,96,.30)');gr.addColorStop(1,'rgba(146,158,96,0)');
  g.fillStyle=gr;g.beginPath();g.ellipse(p.x,p.y,p.rx,p.ry,0,0,PI*2);g.fill();
  g.restore();
  for(let i=0;i<260;i++){
    const a=rnd()*PI*2,d=Math.sqrt(rnd());
    const x=p.x+Math.cos(a)*p.rx*d,y=p.y+Math.sin(a)*p.ry*d;
    g.strokeStyle='rgba(108,120,70,.30)';g.lineWidth=1;
    g.beginPath();g.moveTo(x,y);g.lineTo(x+(rnd()-.5)*4,y-3-rnd()*3);g.stroke();
  }
}
function river(g,pts,w,t){
  /* 沿曲线采样，河宽做随机起伏（0.55–1.25 倍），带河岸滩地、沙洲与流动高光 */
  const P=pts.map(p=>[p[0],p[1]]);
  const N=260, S=[];
  for(let i=0;i<N;i++){
    const u=i/(N-1)*(P.length-1);
    const k=Math.min(P.length-2,Math.floor(u)), f=u-k;
    const p0=P[Math.max(0,k-1)],p1=P[k],p2=P[k+1],p3=P[Math.min(P.length-1,k+2)];
    const cr=(a,b,c,d)=>0.5*((2*b)+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f);
    S.push([cr(p0[0],p1[0],p2[0],p3[0]),cr(p0[1],p1[1],p2[1],p3[1])]);
  }
  const half=[];
  for(let i=0;i<N;i++){
    const a=S[Math.max(0,i-1)],b=S[Math.min(N-1,i+1)];
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
    const nx=-dy/len,ny=dx/len;
    const wob=Math.max(0.4,0.62+0.48*Math.sin(i*0.17)+0.22*Math.sin(i*0.53+1.7));
    half.push(w*0.5*wob);
    S[i].push(nx,ny);
  }
  const left=S.map((p,i)=>[p[0]+p[2]*half[i],p[1]+p[3]*half[i]]);
  const right=S.map((p,i)=>[p[0]-p[2]*half[i],p[1]-p[3]*half[i]]);
  /* 河漫滩 */
  g.beginPath();
  g.moveTo(S[0][0]+S[0][2]*half[0]*1.9,S[0][1]+S[0][3]*half[0]*1.9);
  for(let i=1;i<N;i++)g.lineTo(S[i][0]+S[i][2]*half[i]*1.9,S[i][1]+S[i][3]*half[i]*1.9);
  for(let i=N-1;i>=0;i--)g.lineTo(S[i][0]-S[i][2]*half[i]*1.9,S[i][1]-S[i][3]*half[i]*1.9);
  g.closePath();g.fillStyle='rgba(120,150,138,.12)';g.fill();
  g.strokeStyle='rgba(58,96,108,.30)';g.lineWidth=2.2;g.stroke();
  /* 水体 */
  g.beginPath();g.moveTo(left[0][0],left[0][1]);
  for(let i=1;i<N;i++)g.lineTo(left[i][0],left[i][1]);
  for(let i=N-1;i>=0;i--)g.lineTo(right[i][0],right[i][1]);
  g.closePath();
  const gr=g.createLinearGradient(0,220,0,700);
  gr.addColorStop(0,'rgba(168,208,220,.98)');
  gr.addColorStop(.55,'rgba(124,176,198,.98)');
  gr.addColorStop(1,'rgba(96,150,178,.98)');
  g.fillStyle=gr;g.fill();
  /* 水纹 */
  g.beginPath();g.moveTo(S[0][0],S[0][1]);
  for(let i=1;i<N;i++)g.lineTo(S[i][0],S[i][1]);
  g.strokeStyle='rgba(70,124,152,.45)';g.lineWidth=w*0.22;g.stroke();
  /* 流动高光 */
  g.save();
  g.strokeStyle='rgba(238,226,190,.34)';g.lineWidth=w*0.10;
  g.setLineDash([40,58]);g.lineDashOffset=-t*34;g.stroke();
  g.restore();
  /* 沙洲 */
  for(let i=0;i<14;i++){
    const u=0.05+i*0.068, k=Math.min(N-2,Math.floor(u*(N-1)));
    const p=S[k], h=half[k]*(0.35+rnd()*0.45);
    g.fillStyle='rgba(214,196,152,.55)';
    g.beginPath();g.ellipse(p[0]+(rnd()-.5)*half[k],p[1]+(rnd()-.5)*half[k]*.4,h*0.9,h*0.32,0,0,PI*2);g.fill();
  }
}
function town(g,s){
  const k=s.s,x=s.x,y=s.y;
  g.save();g.translate(x,y);g.scale(k,k);
  const w=s.kind==='cap'?52:(s.kind==='fort'?44:30);
  const h=s.kind==='cap'?36:(s.kind==='fort'?32:22);
  const d=Math.round(h*0.42);
  /* 落影 */
  g.fillStyle='rgba(70,58,40,.18)';
  g.beginPath();g.ellipse(8,h+12,w*1.12,h*.42,0,0,PI*2);g.fill();
  if(s.kind==='gra'){
    for(const [dx,dy] of [[-24,-8],[0,-14],[22,-6],[-14,14],[8,16],[28,14]]){
      g.fillStyle='rgba(226,208,166,.98)';g.beginPath();g.arc(dx,dy,9,0,PI*2);g.fill();
      g.strokeStyle='rgba(110,86,54,.9)';g.lineWidth=1.5;g.stroke();
      g.fillStyle='rgba(150,112,64,.96)';
      g.beginPath();g.moveTo(dx-11,dy-1);g.quadraticCurveTo(dx,dy-16,dx+11,dy-1);g.closePath();g.fill();
    }
    g.restore();return;
  }
  /* 城基 */
  g.fillStyle='rgba(198,180,146,.98)';
  g.beginPath();g.rect(-w,-h,2*w,2*h+ d*0.5);g.fill();
  /* 城墙正面（略深的夯土色） */
  g.fillStyle='rgba(176,154,116,.98)';
  g.beginPath();g.moveTo(-w,h);g.lineTo(w,h);g.lineTo(w,h+d*0.55);g.lineTo(-w,h+d*0.55);g.closePath();g.fill();
  /* 顶面（受光） */
  g.fillStyle='rgba(232,218,186,.99)';
  g.beginPath();g.rect(-w,-h-d,2*w,2*h+d);g.fill();
  g.strokeStyle='rgba(92,74,48,.85)';g.lineWidth=1.8;g.stroke();
  /* 垛口 */
  g.fillStyle='rgba(240,228,200,.99)';
  const step=Math.max(8,Math.round(w/5));
  for(let i=-w+2;i<=w-step;i+=step){
    g.fillRect(i,-h-d-4,step*.55,5);
    g.fillRect(i,h-2,step*.55,5);
  }
  for(let j=-h-d+6;j<=h-6;j+=step){
    g.fillRect(-w-4,j,5,step*.55);
    g.fillRect(w-1,j,5,step*.55);
  }
  /* 四角城楼 */
  for(const [cx,cy] of [[-w,-h-d],[w,-h-d],[-w,h],[w,h]]){
    g.fillStyle='rgba(150,90,58,.98)';g.fillRect(cx-7,cy-7,14,14);
    g.fillStyle='rgba(184,116,74,.98)';
    g.beginPath();g.moveTo(cx-10,cy-6);g.lineTo(cx,cy-15);g.lineTo(cx+10,cy-6);g.closePath();g.fill();
  }
  /* 城门：南面正中 */
  g.fillStyle='rgba(96,68,42,.95)';g.fillRect(-9,h-2,18,10);
  g.fillStyle='rgba(168,104,64,.98)';
  g.beginPath();g.moveTo(-14,h-2);g.lineTo(0,h-16);g.lineTo(14,h-2);g.closePath();g.fill();
  /* 城内屋舍 */
  for(let i=0;i<9;i++){
    const rx=-w+10+rnd()*(2*w-24), ry=-h-d+10+rnd()*(2*h-20);
    g.fillStyle='rgba(206,188,152,.95)';g.fillRect(rx,ry,10,7);
    g.fillStyle='rgba(122,78,50,.95)';
    g.beginPath();g.moveTo(rx-2,ry);g.lineTo(rx+5,ry-6);g.lineTo(rx+12,ry);g.closePath();g.fill();
  }
  /* 城外柏树 */
  for(let i=0;i<10;i++){
    const a=rnd()*PI*2, rr=w*1.18+rnd()*14;
    const tx=Math.cos(a)*rr, ty=Math.sin(a)*rr*.62+h*.4;
    g.fillStyle='rgba(58,92,66,.85)';g.beginPath();g.ellipse(tx,ty+4,5,2.2,0,0,PI*2);g.fill();
    g.fillStyle='rgba(48,84,60,.95)';g.beginPath();g.arc(tx,ty,4.5,0,PI*2);g.fill();
  }
  g.restore();
}
function siteLabel(g,s){
  const t=s.n;
  const fs=s.kind==='cap'?30:24;
  const y=s.y+(s.kind==='cap'?76:62);
  g.font=`600 ${fs}px ${KAI}`;
  g.textAlign='left';g.textBaseline='middle';
  /* ○ 地标符号 + 地名（参考古地图样式，无描边） */
  g.fillStyle='rgba(46,42,34,.95)';
  g.beginPath();g.arc(s.x-g.measureText(t).width/2-14,y,4,0,PI*2);g.strokeStyle='rgba(46,42,34,.9)';g.lineWidth=1.6;g.stroke();
  g.fillText(t,s.x-(g.measureText(t).width/2),y);
}

/* ---------- 势力范围 ---------- */
function territory(g,v){
  /* 河北=袁（朱红），河南=曹（湛蓝）；以黄河为界，边缘羽化 */
  const yR=[[-40,-40],[1960,-40],[1960,120],[1690,186],[1470,216],[1250,252],[1020,282],[790,307],[560,334],[330,362],[120,400],[-40,430]];
  const yC=[[-40,430],[120,400],[330,362],[560,334],[790,307],[1020,282],[1250,252],[1470,216],[1690,186],[1960,120],[1960,1120],[-40,1120]];
  const poly=(pts,fill)=>{g.beginPath();g.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);g.closePath();g.fillStyle=fill;g.fill()};
  g.save();
  poly(yR,'rgba(198,38,20,.20)');
  poly(yC,'rgba(16,74,170,.22)');
  /* 边界：沿黄河两岸各压一条同色描边，让分界一眼看清 */
  g.strokeStyle='rgba(178,32,18,.55)';g.lineWidth=5.5;
  g.beginPath();HUANGHE.forEach((p,i)=>{const y=p[1]-13;i?g.lineTo(p[0],y):g.moveTo(p[0],y)});g.stroke();
  g.strokeStyle='rgba(18,74,158,.55)';
  g.beginPath();HUANGHE.forEach((p,i)=>{const y=p[1]+15;i?g.lineTo(p[0],y):g.moveTo(p[0],y)});g.stroke();
  g.restore();
}
function paper(g){
  g.fillStyle='#f4eedd';g.fillRect(-300,-300,W+600,H+600);
  /* 柔和晕染：邺城暖橘、许都青绿、太行青灰，模仿宣纸水彩 */
  const wash=(x,y,r,c)=>{
    const gr=g.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,c);gr.addColorStop(.55,c.replace(/[\d.]+\)$/,'0.06)'));gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,PI*2);g.fill();
  };
  wash(1310,175,430,'rgba(212,118,72,.17)');
  wash(845,915,430,'rgba(92,148,118,.14)');
  wash(200,150,400,'rgba(108,148,138,.13)');
  wash(1000,540,520,'rgba(196,178,132,.10)');
  /* 纸纤维 */
  for(let i=0;i<700;i++){
    const x=rnd()*(W+600)-300,y=rnd()*(H+600)-300;
    g.fillStyle=`rgba(160,136,96,${.015+rnd()*.025})`;
    g.beginPath();g.arc(x,y,1+rnd()*7,0,PI*2);g.fill();
  }
  /* 大块墨晕，压住“数字平涂”感 */
  for(let i=0;i<26;i++){
    const x=rnd()*W,y=rnd()*H,r=90+rnd()*190;
    const gr=g.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,'rgba(186,164,120,.055)');gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,PI*2);g.fill();
  }
}
function labels(g){
  const L=[['河北',1500,96,80,.13],['河南',400,930,80,.12],['中原',1080,880,60,.09]];
  for(const [t,x,y,s,a] of L){
    g.font=`400 ${s}px ${KAI}`;g.textAlign='center';g.textBaseline='middle';
    g.fillStyle=`rgba(96,70,40,${a})`;g.fillText(t,x,y);
  }
  /* 水系名：楷体，贴着河道 */
  const R=[['黄河',1180,214,34],['官渡水',648,640,24],['颍水',1160,860,24],['洧水',1352,960,24]];
  for(const [t,x,y,s] of R){
    g.font=`600 ${s}px ${KAI}`;g.textAlign='center';g.textBaseline='middle';
    g.fillStyle='rgba(58,96,116,.85)';g.fillText(t,x,y);
  }
}
const SONGF=`"Songti SC","SimSun",serif`;
const KAI=`"Kaiti SC","KaiTi","STKaiti",serif`;

/* ---------- 人物卡：随口播浮动 ---------- */
function cards(g,v){
  const cur=targetAt(v);
  const want={};
  cur.hit.forEach(f=>{want[f.k]=true});
  /* 没有点名时，按阵营保留一张主角卡 */
  if(!cur.hit.length){
    if(cur.fac==='yuan')want.yuan=true;
    else if(cur.fac==='cao')want.cao=true;
  }
  const z=CURZ;
  for(const f of FIGS){
    const on=!!want[f.k];
    const st=STATE[f.k]||(STATE[f.k]={x:f.x,y:f.y,z:1,a:0});
    const targetZ=on?(f.r>40?1:0.92):0.0;
    st.z+=(targetZ-st.z)*(on?.10:.16);
    st.x+=(f.x-st.x)*.10; st.y+=(f.y-st.y)*.10;
    st.a+=((on?1:0)-st.a)*(on?.12:.18);
    if(st.a<.02)continue;
    const rr=f.r*st.z;
    /* 画在世界坐标里：卡随地图缩放，位置只在“换人说话”时平滑移动 */
    const px=st.x, py=st.y-f.r*2.05;
    g.save();g.globalAlpha=st.a;
    /* 地面投影：让卡“落”在地形上 */
    g.fillStyle='rgba(20,16,10,.22)';
    g.beginPath();g.ellipse(px+3,st.y+4,rr*.95,rr*.28,0,0,PI*2);g.fill();
    /* 柔和光晕 */
    g.save();g.globalAlpha=st.a*.35;
    const gr=g.createRadialGradient(px,py,rr*.5,px,py,rr*2.4);
    gr.addColorStop(0,CLR[f.side]);gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr;g.beginPath();g.arc(px,py,rr*2.4,0,PI*2);g.fill();g.restore();
    /* 头像圆盘 */
    g.fillStyle='#10242a';g.beginPath();g.arc(px,py,rr+3,0,PI*2);g.fill();
    const img=IMG[f.k];
    if(img){g.save();g.beginPath();g.arc(px,py,rr,0,PI*2);g.clip();
      g.drawImage(img,0,0,img.width,img.height,px-rr,py-rr,2*rr,2*rr);g.restore();}
    g.strokeStyle=on?'#ffe08a':CLR[f.side];g.lineWidth=on?4:3;
    g.beginPath();g.arc(px,py,rr+1.5,0,PI*2);g.stroke();
    /* 名字牌，紧贴下沿 */
    g.font=`700 ${Math.max(13,17*st.z)}px ${HEI}`;g.textAlign='center';g.textBaseline='middle';
    const tw=g.measureText(f.n).width+16,th=Math.max(19,24*st.z);
    g.fillStyle='rgba(8,26,31,.92)';
    g.beginPath();g.roundRect(px-tw/2,py+rr+2,tw,th,5);g.fill();
    g.fillStyle='#f7edda';g.fillText(f.n,px,py+rr+2+th*.52);
    g.restore();
  }
}
let CAM={z:1,cx:960,cy:540};
let IMG={};

/* ---------- 总装 ---------- */
mount({
  slug:'guandu-clean',
  assets:{cao:'/assets/commanders/cao-v2.jpg',yuan:'/assets/commanders/yuan.jpg',
    zhanghe:'/assets/commanders/zhanghe.jpg',xunyu:'/assets/commanders/xunyu.jpg',
    xunyou:'/assets/commanders/xunyou.jpg',xuhuang:'/assets/commanders/xuhuang.jpg',
    caoren:'/assets/commanders/caoren.jpg',tianfeng:'/assets/commanders/tianfeng.jpg',
    shenpei:'/assets/commanders/shenpei.jpg',guotu:'/assets/commanders/guotu.jpg'},
  captions:[],
  seconds:600,
  buildTimeline(starts,d){return {warp:t=>t,filmEnd:d+2}},
  prepare(api){
    CAPS=api.captions||[];
    FILM=api.filmEnd||600;
    TARGETS=buildTargets(CAPS);
    IMG=api.images||{};
    grain=makeGrain();
    if(typeof window!=='undefined'&&window.tushuo){
      window.tushuo.camera=cameraAt;
      window.tushuo.lines=TARGETS.length;
    }
  },
  draw(g,{t,v,captions}){
    const [z,cx,cy]=cameraAt(v);
    CAM={z,cx,cy};CURZ=z;
    for(const k in (window.__tuImg||{})) IMG[k]=window.__tuImg[k];
    g.fillStyle='#171310';g.fillRect(0,0,W,H);
    g.save();
    g.translate(W/2,H/2);g.scale(z,z);g.translate(-cx,-cy);
    paper(g);
    farmland(g);
    territory(g,v);
    /* 地形：山 → 草 → 林 → 河 → 路 → 城 */
    for(const m of MOUNTAINS) ridge(g,m.pts,m.w,m.h);
    for(const p of GRASS) grass(g,p);
    for(const f of FORESTS) forest(g,f);
    river(g,RIVER,54,t);
    /* 支流：官渡水 / 颍水 / 洧水（细流，参考古地图） */
    river(g,[[535,332],[520,432],[545,562],[585,722],[610,902],[625,1042]],16,t);
    river(g,[[1032,700],[1060,760],[1088,828],[1122,900],[1150,980]],12,t);
    river(g,[[1250,820],[1276,870],[1300,930],[1330,1000]],11,t);
    g.strokeStyle='rgba(120,98,64,.30)';g.lineWidth=2.2;
    g.beginPath();g.moveTo(1310,195);g.lineTo(1130,238);g.lineTo(960,286);g.lineTo(790,318);g.lineTo(640,357);g.lineTo(742,458);g.lineTo(852,562);g.lineTo(932,676);g.lineTo(902,802);g.lineTo(850,902);g.stroke();
    for(const s of SITES) town(g,s);
    for(const s of SITES) siteLabel(g,s);
    labels(g);
    cards(g,v);
    g.restore();
    legendClean(g);
    drawCaption(g,t,captions);
    postFXBase(g,v,grain);
  },
});
