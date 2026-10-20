/* tushuo · 官渡之战（完整版 · 约 10 分钟）
   15 段：钩子 / 兵力粮草账 / 为什么是官渡 / 袁绍三条路 / 曹操三条路 /
   白马延津 / 官渡工程战 / 多路与单线 / 内部裂缝 / 夜袭乌巢 / 火烧乌巢 /
   袁军崩溃 / 战后北方 / 五条胜负手 / 演义与真事。
   段落边界由字幕累计字符（ACT_OFFSETS）推出；配音前用估算时码出预览，
   配音后由 captions.json 自动替换。坐标只作相对阵位示意，不做可量测复原。 */

import {W,H,PI,off,SONG,HEI,smooth,range,fade,line,txt,song,
  postFXBase,drawCaption,mount,makeGrain,boat,circlePortrait,portraitDisc} from './engine.js';
import {map as mapCtx} from './engine.js';
import {buildTerrain,drawRegionWash,drawRiverCurrents,drawSiteHalo,
  buildPath,pointAtPath,tangentAtPath} from './terrain.js';
import {infantryBlock,cavalry,camp,watchtower,earthworks,torch,fireCluster,
  smoke,supplyLine,routeLine,attackArrow,column,clash,dust,unitTag,baggageCart,
  fireGlow,arrowVolley} from './land-units.js';

const TAIL=3.6;
const CHAR_SEC=0.168;
const ACT_OFFSETS=[0,126,333,592,831,1039,1311,1558,1814,2018,2327,2523,2762,2958,3302,3548];
const ACT_META=[
  {title:'两万对十万',sub:'官渡 · 建安五年 · 今河南中牟'},
  {title:'先算账',sub:'精卒十万 · 兵不满万 · 两条粮道'},
  {title:'为什么是官渡',sub:'许都北大门 · 谁先断粮谁先崩'},
  {title:'袁绍的三条路',sub:'正面碾压 · 分兵袭许 · 持久消耗'},
  {title:'曹操的三条路',sub:'退不得 · 守官渡 · 内线'},
  {title:'白马 · 延津',sub:'声东击西 · 六百破五六千'},
  {title:'官渡对峙',sub:'土山箭楼 · 霹雳车 · 十五日'},
  {title:'多路与单线',sub:'三个如果 · 选定就做到底'},
  {title:'内部裂缝',sub:'田丰下狱 · 许攸投曹 · 乌巢'},
  {title:'夜袭乌巢',sub:'五千步骑 · 伪旗号 · 四十里'},
  {title:'火烧乌巢',sub:'不分兵 · 先破粮屯 · 断粮'},
  {title:'袁军崩溃',sub:'张郃高览降 · 八百骑北逃'},
  {title:'战后北方',sub:'四州归曹 · 北征乌桓 · 焚信'},
  {title:'五条胜负手',sub:'粮道 · 情报 · 内部 · 战场 · 决策'},
  {title:'演义与真事',sub:'官渡与赤壁 · 分清演义和真事'},
];

/* ================= 官渡地形配置 ================= */
const RIVER=[[-60,442],[120,400],[330,362],[560,334],[790,307],[1020,282],[1250,252],[1470,216],[1690,186],[1980,154]];
const TERRAIN={
  seed:208122,
  palette:{low:[164,146,110],high:[232,210,166],water:[74,118,106],waterDeep:[32,70,64],ink:'#33261a',paper:'#f2e8ce'},
  relief:{base:.42,amp:.19,detail:.09,range:.74,flat:.66,light:[-.62,-.66,.44]},
  plains:[{x:860,y:540,rx:640,ry:340}],
  hills:[
    {x:96,y:150,rx:260,ry:150,h:.20,symbol:true,name:'太行',nameX:150,nameY:96},
    {x:170,y:900,rx:300,ry:190,h:.15,symbol:true,name:'嵩山',nameX:262,nameY:944},
    {x:1730,y:840,rx:280,ry:210,h:.14,symbol:true},
    {x:1710,y:62,rx:240,ry:140,h:.15,symbol:true},
  ],
  rivers:[
    {name:'黄河',pts:RIVER,width:36,labelAt:.74,labelX:1462,labelY:245,labelSize:36},
    {name:'鸿沟',pts:[[535,332],[520,432],[545,562],[585,722],[610,902],[625,1042]],width:14,labelAt:.64,labelX:632,labelY:790,labelSize:24},
  ],
  sites:[
    {name:'邺城',x:1310,y:175,kind:'capital',size:1.15,fontSize:31,up:false},
    {name:'许都',x:845,y:915,kind:'capital',size:1.1,fontSize:30},
    {name:'官渡',x:948,y:700,kind:'fort',size:1.2,fontSize:27},
    {name:'白马',x:268,y:420,kind:'city',size:1.05,fontSize:25},
    {name:'延津',x:620,y:367,kind:'ford',size:1.1,fontSize:25},
    {name:'乌巢',x:570,y:500,kind:'granary',size:1.15,fontSize:27,note:'袁军粮屯'},
    {name:'中牟',x:1120,y:790,kind:'city',size:.9,fontSize:21,up:false},
  ],
  roads:[
    {pts:[[1310,195],[1130,238],[960,286],[790,318],[640,357]]},
    {pts:[[640,357],[742,458],[852,562],[932,676]]},
    {pts:[[932,676],[902,802],[850,902]]},
    {pts:[[902,662],[800,602],[700,557],[612,516]]},
    {pts:[[268,420],[400,405],[520,390],[615,370]]},
  ],
  labels:[
    {text:'河北',x:1510,y:96,size:80,alpha:.15},
    {text:'河南',x:420,y:906,size:80,alpha:.13},
    {text:'中原',x:1060,y:860,size:64,alpha:.10},
  ],
  regions:[
    {key:'yuan',color:'#b4553e',alpha:.075,pts:[[-20,-20],[1940,-20],[1940,140],[1690,186],[1470,216],[1250,252],[1020,282],[790,307],[560,334],[330,362],[120,400],[-20,442]]},
    {key:'cao',color:'#3f9d87',alpha:.07,pts:[[-20,442],[120,400],[330,362],[560,334],[790,307],[1020,282],[1250,252],[1470,216],[1690,186],[1940,140],[1940,1100],[-20,1100]]},
  ],
};

const PATHS={};
let grainTiles=null;
let ACTS=null;

/* ================= 段落时码 ================= */
function lineIndexAt(caps,offset){
  let pos=0;
  for(let i=0;i<caps.length;i++){const len=caps[i][2].length;if(offset<pos+len)return i;pos+=len}
  return Math.max(0,caps.length-1);
}
function buildActsFromCaptions(caps,filmEnd){
  if(!caps.length)return null;
  const acts=[];
  for(let k=0;k<ACT_OFFSETS.length-1;k++){
    const i0=lineIndexAt(caps,ACT_OFFSETS[k]);
    const i1=Math.max(i0,lineIndexAt(caps,ACT_OFFSETS[k+1])-1);
    acts.push({i:k,t0:i0===0?0:caps[i0][0],t1:caps[i1][1]});
  }
  acts[acts.length-1].t1=Math.max(acts[acts.length-1].t0+1,filmEnd);
  for(let k=1;k<acts.length;k++)if(acts[k].t0<acts[k-1].t0)acts[k].t0=acts[k-1].t0;
  for(const a of acts)if(a.t1<=a.t0)a.t1=a.t0+1;
  return acts;
}
function buildActsEstimated(){
  const acts=[];
  for(let k=0;k<ACT_OFFSETS.length-1;k++)
    acts.push({i:k,t0:ACT_OFFSETS[k]*CHAR_SEC,t1:ACT_OFFSETS[k+1]*CHAR_SEC});
  acts[acts.length-1].t1=ACT_OFFSETS[ACT_OFFSETS.length-1]*CHAR_SEC+TAIL;
  return acts;
}
function actOf(t){
  if(!ACTS)return {i:0,t0:0,t1:600};
  let k=0;while(k<ACTS.length-1&&t>=ACTS[k].t1)k++;
  return ACTS[k];
}
function ap(v,a,f0,f1){
  const d=Math.max(.001,a.t1-a.t0);
  return range(v,a.t0+d*f0,a.t0+d*f1);
}
function dur(a){return Math.max(.001,a.t1-a.t0)}

/* ================= 镜头表：按口播节拍快推到「正在说话的一方」 =================
   [段, 段内偏移秒, 缩放, 中心x, 中心y, 镜头名, 阵营]
   fac: 'yuan' 袁绍 / 'cao' 曹操 / null 中立（两侧主帅卡同时显示）
   说到哪方推哪方；开打后在袁营、曹营、乌巢、官渡之间来回切。 */
const SHOT_DEFS=[
  /* 0 钩子 0–23.66 */
  [0,0.00,1.02,960,540,'开场 · 全图',null],
  [0,0.55,1.34,858,628,'曹操 · 兵不满万','cao'],
  [0,1.30,1.42,1080,474,'袁绍 · 十万','yuan'],
  [0,2.72,1.04,960,540,'建安五年',null],
  [0,3.76,1.50,948,700,'官渡',null],
  [0,4.32,1.45,1120,790,'中牟',null],
  [0,5.66,1.52,858,628,'曹操 · 粮快见底','cao'],
  [0,6.60,1.55,884,704,'曹军粮道','cao'],
  [0,7.50,1.45,1080,474,'袁绍 · 精兵十万','yuan'],
  [0,8.46,1.52,1064,520,'袁军方阵','yuan'],
  [0,9.44,1.55,1288,462,'战马万匹','yuan'],
  [0,10.30,1.40,1310,262,'河北四州 · 邺城','yuan'],
  [0,11.78,1.06,960,540,'这一仗',null],
  [0,13.02,1.42,1210,320,'八百骑逃回河北','yuan'],
  [0,14.79,1.02,960,540,'曹操定北方','cao'],
  [0,16.45,1.00,960,540,'更怪的是',null],
  [0,17.00,1.32,858,628,'曹操赢','cao'],
  [0,17.89,1.45,960,566,'不是阵前斩将',null],
  [0,19.43,1.45,706,540,'自己送上门的情报',null],
  [0,21.18,1.02,960,540,'怎么推的',null],
  [0,22.66,1.10,960,540,'从头算一遍',null],
  /* 1 先算账 23.66–64.59 */
  [1,0.00,1.06,960,540,'先算账',null],
  [1,1.20,1.30,960,420,'袁绍 · 精卒十万','yuan'],
  [1,7.00,1.45,872,300,'十万人一格 · 十行','yuan'],
  [1,13.00,1.06,960,540,'曹操这边',null],
  [1,15.00,1.35,790,640,'兵不满万','cao'],
  [1,22.00,1.45,742,596,'六列四行 · 两三万','cao'],
  [1,29.00,1.25,960,470,'两条粮道',null],
  [1,33.00,1.40,1042,300,'袁军粮道 · 河北来','yuan'],
  [1,37.00,1.40,872,760,'曹军粮道 · 许都来','cao'],
  /* 2 为什么是官渡 64.59–112.07 */
  [2,0.00,1.04,960,540,'为什么是官渡',null],
  [2,2.00,1.30,948,700,'官渡',null],
  [2,8.00,1.42,1310,290,'邺城','yuan'],
  [2,13.00,1.35,948,470,'黄河渡口',null],
  [2,19.00,1.40,845,880,'许都','cao'],
  [2,26.00,1.30,948,700,'许都北大门',null],
  [2,33.00,1.28,900,640,'谁先断粮谁先崩','cao'],
  [2,40.00,1.05,960,540,'一条线',null],
  /* 3 袁绍三条路 112.07–157.13 */
  [3,0.00,1.05,960,540,'袁绍的三条路',null],
  [3,2.00,1.35,1080,474,'正面碾压','yuan'],
  [3,12.00,1.30,760,430,'分兵袭许','yuan'],
  [3,24.00,1.35,1080,520,'持久消耗','yuan'],
  [3,34.00,1.20,960,540,'三个选项',null],
  [3,39.00,1.05,960,540,'选哪个',null],
  /* 4 曹操三条路 157.13–196.82 */
  [4,0.00,1.05,960,540,'曹操的三条路',null],
  [4,2.00,1.30,845,880,'退守许都？','cao'],
  [4,10.00,1.42,948,700,'守官渡','cao'],
  [4,19.00,1.35,900,660,'内线','cao'],
  [4,27.00,1.25,960,540,'没有退路',null],
  [4,33.00,1.10,960,540,'定策',null],
  /* 5 白马 · 延津 196.82–248.36 */
  [5,0.00,1.05,960,540,'白马 · 延津',null],
  [5,2.00,1.45,268,470,'白马',null],
  [5,10.00,1.42,620,410,'延津',null],
  [5,18.00,1.40,430,440,'声东击西',null],
  [5,26.00,1.45,300,470,'关羽斩颜良',null],
  [5,36.00,1.35,620,440,'六百破五六千',null],
  [5,44.00,1.10,960,540,'撤',null],
  /* 6 官渡对峙 248.36–295.83 */
  [6,0.00,1.05,960,540,'官渡对峙',null],
  [6,2.00,1.45,948,700,'土山箭楼',null],
  [6,10.00,1.50,1080,440,'袁军土山','yuan'],
  [6,18.00,1.50,858,640,'霹雳车','cao'],
  [6,27.00,1.45,960,566,'十五日',null],
  [6,36.00,1.30,960,566,'消耗',null],
  /* 7 多路与单线 295.83–341.28 */
  [7,0.00,1.02,960,540,'多路与单线',null],
  [7,3.00,1.15,960,540,'三个如果',null],
  [7,14.00,1.25,1080,474,'袁绍多路','yuan'],
  [7,24.00,1.25,858,628,'曹操单线','cao'],
  [7,34.00,1.05,960,540,'选定就做到底',null],
  /* 8 内部裂缝 341.28–378.65 */
  [8,0.00,1.05,960,540,'内部裂缝',null],
  [8,2.00,1.40,1310,290,'田丰下狱','yuan'],
  [8,10.00,1.40,1080,500,'许攸','yuan'],
  [8,18.00,1.45,900,615,'许攸投曹','cao'],
  [8,27.00,1.40,606,504,'乌巢',null],
  /* 9 夜袭乌巢 378.65–436.25 */
  [9,0.00,1.05,960,540,'夜袭乌巢',null],
  [9,2.00,1.45,858,628,'五千步骑','cao'],
  [9,12.00,1.45,724,560,'四十里','cao'],
  [9,22.00,1.50,570,500,'乌巢',null],
  [9,32.00,1.45,600,510,'伪旗号','cao'],
  [9,42.00,1.40,620,520,'淳于琼','yuan'],
  [9,50.00,1.15,960,540,'夜',null],
  /* 10 火烧乌巢 436.25–472.04 */
  [10,0.00,1.05,960,540,'火烧乌巢',null],
  [10,2.00,1.50,570,500,'火起',null],
  [10,10.00,1.55,570,500,'粮屯',null],
  [10,20.00,1.35,1080,474,'袁绍不分兵','yuan'],
  [10,28.00,1.30,1080,474,'只派轻骑','yuan'],
  /* 11 袁军崩溃 472.04–515.64 */
  [11,0.00,1.05,960,540,'袁军崩溃',null],
  [11,2.00,1.45,1228,588,'张郃 · 高览',null],
  [11,12.00,1.40,1228,588,'降','cao'],
  [11,20.00,1.30,1080,474,'袁军大营','yuan'],
  [11,28.00,1.40,1210,320,'八百骑北逃','yuan'],
  [11,36.00,1.10,960,540,'崩',null],
  /* 12 战后北方 515.64–551.21 */
  [12,0.00,1.05,960,540,'战后北方',null],
  [12,3.00,1.30,1310,290,'四州归曹','cao'],
  [12,14.00,1.10,960,540,'北征乌桓',null],
  [12,24.00,1.20,960,540,'焚信','cao'],
  /* 13 五条胜负手 551.21–619.69 */
  [13,0.00,1.05,960,540,'五条胜负手',null],
  [13,3.00,1.30,1000,450,'粮道',null],
  [13,14.00,1.30,950,600,'情报',null],
  [13,26.00,1.30,1080,474,'内部','yuan'],
  [13,38.00,1.30,948,700,'战场',null],
  [13,50.00,1.20,858,628,'决策','cao'],
  /* 14 演义与真事 619.69–665.53 */
  [14,0.00,1.05,960,540,'演义与真事',null],
  [14,5.00,1.20,960,540,'官渡对赤壁',null],
  [14,18.00,1.10,960,540,'分清演义',null],
  [14,32.00,1.02,960,540,'片尾',null],
];
let SHOTS=null;
let FILM=600;
let CURZ=1;              /* 当前帧缩放：近景据此加密士兵方阵 */
function buildShots(){
  SHOTS=[];
  for(const [k,off,z0,cx,cy,label,fac] of SHOT_DEFS){
    /* 近景再放大一档：1.30→1.85、1.45→2.05、1.55→2.20；全图镜头保持原样，
       这样「全图 → 推近」的反差才够，说到哪方就是一方的大特写。 */
    const z=z0>=1.28?Math.min(2.25,z0*1.42):z0;
    const base=ACTS?ACTS[k].t0:0,hx=W/(2*z),hy=H/(2*z);
    SHOTS.push({i:SHOTS.length,t0:base+off,t1:0,z,
      cx:Math.min(W-hx,Math.max(hx,cx)),cy:Math.min(H-hy,Math.max(hy,cy)),label,fac});
  }
  for(let i=0;i<SHOTS.length;i++)SHOTS[i].t1=i<SHOTS.length-1?SHOTS[i+1].t0:FILM;
}
function shotAt(t){
  if(!SHOTS||!SHOTS.length)return null;
  let i=0;while(i<SHOTS.length-1&&t>=SHOTS[i+1].t0)i++;
  return SHOTS[i];
}
/* 快推＋缓落：切点后 0.3–0.6 秒完成 86% 位移，余下时间慢慢靠稳。 */
function cameraFor(t){
  if(!SHOTS||!SHOTS.length)return [1,960,540];
  const cur=shotAt(t),i=cur.i,prev=i>0?SHOTS[i-1]:cur;
  const span=Math.max(.4,cur.t1-cur.t0);
  /* 慢而顺：1.05–1.9 秒走完全程，smoothstep 缓入缓出，不再有“甩镜”感 */
  const move=Math.max(1.05,Math.min(1.9,span*.55));
  let p=1;
  if(i>0){
    const q=Math.min(1,Math.max(0,(t-cur.t0)/move));
    p=smooth(q);
  }
  const z0=prev.z+(cur.z-prev.z)*p;
  const cx0=prev.cx+(cur.cx-prev.cx)*p,cy0=prev.cy+(cur.cy-prev.cy)*p;
  /* 镜头呼吸：幅度再收一半，慢推慢移，避免晃 */
  const br=range(t,1.2,4.2);
  const z=z0*(1+.006*Math.sin(t*.33+1.1)*br);
  const cx=cx0+(14*Math.sin(t*.23+.6)+5*Math.sin(t*.51+2.2))*br;
  const cy=cy0+(9*Math.sin(t*.19+1.9)+4*Math.sin(t*.43+.4))*br;
  const hx=W/(2*z),hy=H/(2*z);
  return [z,Math.min(W-hx,Math.max(hx,cx)),Math.min(H-hy,Math.max(hy,cy))];
}
/* 切镜速度线：快推前 0.48 秒从画外向内收 */
function whipFX(g,t){
  if(!SHOTS||!SHOTS.length)return;
  const cur=shotAt(t);if(!cur||cur.i===0)return;
  const q=(t-cur.t0)/.48;
  if(q<0||q>1)return;
  g.save();g.globalAlpha=Math.pow(1-q,2)*.16;
  for(let i=0;i<18;i++){
    const ang=i*Math.PI*2/18+.13,r0=560+((i*53)%120),r1=980+((i*97)%220);
    line(g,W/2+Math.cos(ang)*r0,H/2+Math.sin(ang)*r0,
      W/2+Math.cos(ang)*r1,H/2+Math.sin(ang)*r1,'rgba(244,238,214,.9)',2.2);
  }
  g.restore();
}
/* 开场镜头地震：0–1.0s 整画面跟着抖（世界/标绘/图例一起），第一句字幕同步抖动 */
function hookShake(v){
  if(v>=1.0)return null;
  const amp=Math.max(0,Math.min(1,range(v,0,.05)*(1-range(v,.55,1.0))));
  if(amp<=0)return null;
  const x=Math.sin(v*173.0)*30*amp+Math.sin(v*97.0)*14*amp;
  const y=Math.cos(v*191.0)*18*amp+Math.sin(v*71.0)*9*amp;
  const rot=Math.sin(v*127.0)*.014*amp;
  return {x,y,rot,sc:1+.08*amp};
}

/* ================= 通用小工具 ================= */
function panel(g,x,y,w,h,fill='rgba(14,22,20,.84)',stroke='rgba(214,184,126,.45)',r=10){
  g.fillStyle=fill;g.beginPath();g.roundRect(x,y,w,h,r);g.fill();
  if(stroke){g.strokeStyle=stroke;g.lineWidth=1.6;g.stroke()}
}
function stamp(g,text,x,y,color,a){
  if(a<=0)return;
  const pop=.86+.14*smooth(Math.min(1,a*2.2));
  g.save();g.globalAlpha*=Math.min(1,a*1.8);g.translate(x,y);g.rotate(-.075);g.scale(pop,pop);
  g.strokeStyle=color;g.lineWidth=4;
  g.beginPath();g.roundRect(-58,-31,116,62,8);g.stroke();
  g.lineWidth=1.5;g.beginPath();g.roundRect(-50,-23,100,46,5);g.stroke();
  g.font=`800 38px ${SONG}`;g.textAlign='center';g.textBaseline='middle';g.fillStyle=color;
  g.fillText(text,0,2);
  g.restore();
}
function crossMark(g,x,y,r,color,alpha){
  if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;g.strokeStyle=color;g.lineWidth=5;g.lineCap='round';
  g.beginPath();g.moveTo(x-r,y-r);g.lineTo(x+r,y+r);g.moveTo(x+r,y-r);g.lineTo(x-r,y+r);g.stroke();
  g.restore();
}
function checkMark(g,x,y,r,color,alpha){
  if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;g.strokeStyle=color;g.lineWidth=5;g.lineCap='round';g.lineJoin='round';
  g.beginPath();g.moveTo(x-r,y);g.lineTo(x-r*.2,y+r*.7);g.lineTo(x+r,y-r*.8);g.stroke();
  g.restore();
}
/* ================= 行军路线：流动虚线 + 沿线前进的箭头 ================= */
function tracePathLocal(g,path,steps=56){
  g.beginPath();
  for(let i=0;i<=steps;i++){const p=pointAtPath(path,i/steps);i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1])}
}
function marchRoute(g,path,opt={}){
  const t=opt.t||0,A=opt.alpha??1;
  if(A<=0||!path)return;
  const color=opt.color||'rgba(232,214,170,.92)';
  const dash=opt.dash||[13,11],period=dash[0]+dash[1];
  const speed=opt.speed??40;
  g.save();g.globalAlpha*=A;g.lineCap='round';g.lineJoin='round';
  /* 底光 */
  g.setLineDash([]);tracePathLocal(g,path);
  g.strokeStyle=opt.glow||'rgba(255,206,140,.10)';g.lineWidth=(opt.width??3.8)+9;g.stroke();
  /* 流动虚线：lineDashOffset 负向滚动＝朝行军方向走 */
  g.setLineDash(dash);
  g.lineDashOffset=-(t*speed)%period;
  g.strokeStyle=color;g.lineWidth=opt.width??3.8;g.stroke();
  g.setLineDash([]);g.lineDashOffset=0;
  /* 沿线前进的实心箭头 */
  const n=opt.arrows??2,rate=opt.rate??.075;
  for(let i=0;i<n;i++){
    const u=(t*rate+i/n+.12)%1;
    if(u<.04||u>.96)continue;
    const p=pointAtPath(path,u),q=pointAtPath(path,Math.min(1,u+.014));
    g.save();g.translate(p[0],p[1]);g.rotate(Math.atan2(q[1]-p[1],q[0]-p[0]));
    g.fillStyle=opt.headColor||color;
    g.beginPath();g.moveTo(12,0);g.lineTo(-7.5,7.4);g.lineTo(-3.6,0);g.lineTo(-7.5,-7.4);g.closePath();g.fill();
    g.restore();
  }
  g.restore();
}
/* ================= 主帅卡：固定钉在中军帐 / 城市，不随镜头移动 ================= */
const CMD={
  yuan:{key:'yuan',name:'袁绍',role:'冀州牧 · 精卒十万',col:'#ff6a4d'},
  cao: {key:'cao', name:'曹操',role:'司空 · 兵不满万',  col:'#4fb8ff'},
};
/* 每个主帅只有一个“家”：主将坐中军帐（CAMP_* 即中军帐位），偏将按 SUBS 的驻地走 */
/* ================= 主帅卡 / 偏将布点 =================
   主将坐中军帐；偏将按史实分两类：
   ① 随军到官渡前线的（张郃在袁军西营；荀攸、徐晃随曹操到官渡）
   ② 留守城市的（荀彧守许都；曹仁留中牟后方）
   主将在前、偏将成排在其后；主帅卡(r=46)比主将(r=52)小一档。 */
const MAIN={yuan:{name:'袁绍',r:52,at:()=>[CAMP_Y.x,CAMP_Y.y],col:'#ff6a4d'},
            cao: {name:'曹操',r:52,at:()=>[CAMP_C.x,CAMP_C.y],col:'#4fb8ff'}};
const SUBS=[
  {k:'guotu',   name:'郭图',r:29,at:null,      side:'yuan',note:'随军 · 中军',behind:'yuan'},
  {k:'zhanghe', name:'张郃',r:31,at:[1228,588],side:'yuan',note:'随军 · 西营'},
  {k:'tianfeng',name:'田丰',r:29,at:[1310,175],side:'yuan',note:'留守 · 邺城'},
  {k:'shenpei', name:'审配',r:29,at:[1310,175],side:'yuan',note:'留守 · 邺城'},
  {k:'xunyu',   name:'荀彧',r:30,at:[845,915], side:'cao', note:'留守 · 许都'},
  {k:'xunyou',  name:'荀攸',r:28,at:[948,700], side:'cao', note:'随军 · 官渡'},
  {k:'xuhuang', name:'徐晃',r:28,at:[948,700], side:'cao', note:'随军 · 官渡'},
  {k:'caoren',  name:'曹仁',r:29,at:[1120,790],side:'cao', note:'留守 · 中牟后方'},
];
/* 最终布点（按《三国志》各本传定营位，坐标即图中营/城）：
   袁绍·中军帐；郭图随中军；张郃在袁军西营（与高览攻曹营）；田丰、审配守邺城。
   曹操·中军帐；荀攸随中军；徐晃在东营（与史涣截韩猛粮车，故市在东）；
   荀彧守许都；曹仁在中牟后方。 */
const FIGS=[
  {k:'yuan',   name:'袁绍',r:46,main:true,side:'yuan',at:()=>[CAMP_Y.x,CAMP_Y.y]},
  {k:'guotu',  name:'郭图',r:26,side:'yuan',at:()=>[CAMP_Y.x+92,CAMP_Y.y-6]},
  {k:'zhanghe',name:'张郃',r:27,side:'yuan',at:[1228,588]},   /* 张郃·高览营（西营） */
  {k:'tianfeng',name:'田丰',r:24,side:'yuan',at:[1268,146]},
  {k:'shenpei', name:'审配',r:24,side:'yuan',at:[1352,200]},
  {k:'cao',    name:'曹操',r:46,main:true,side:'cao',at:()=>[CAMP_C.x,CAMP_C.y]},
  {k:'xunyou', name:'荀攸',r:26,side:'cao',at:()=>[CAMP_C.x+92,CAMP_C.y-6]},
  {k:'xuhuang',name:'徐晃',r:26,side:'cao',at:[958,562]},
  {k:'xunyu',  name:'荀彧',r:24,side:'cao',at:[845,915]},
  {k:'caoren', name:'曹仁',r:24,side:'cao',at:[1120,790]},
];
function duelBar(g,v,z=CURZ){
  if(!SHOTS||!SHOTS.length)return;
  if(actOf(v).i===0&&v<2.55)return;
  const cur=shotAt(v),fac=cur.fac;
  /* 所有将官卡都在【世界坐标】里画：卡随地图一起缩放平移＝钉死在营盘/城头，
     行进时不滑、不跳、不重排。 */
  const k=1/z;                       /* 世界单位/屏幕像素 */
  const items=[];
  for(const f of FIGS){
    const p=typeof f.at==='function'?f.at():f.at;
    const on=(fac===f.side);
    items.push({f,x:p[0],y:p[1],on,al:on?1:(fac?.6:.92)});
  }
  items.sort((p,q)=>p.on-q.on);
  for(const it of items){
    const f=it.f,r=f.r*k;
    g.save();g.globalAlpha=it.al;
    /* 旗杆：从卡底插到营/城钉点（世界坐标，长度固定 26px） */
    const py=it.y;                     /* 圆形卡圆心＝营地/城池中心（覆盖在阵营正中） */
    if(it.on){
      const pu=.5+.5*Math.sin(v*3.4);
      g.save();g.globalAlpha=(.26+.12*pu);
      const gr=g.createRadialGradient(it.x,py,r*.6,it.x,py,r*2.6);
      gr.addColorStop(0,f.side==='yuan'?'#ff6a4d':'#4fb8ff');gr.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=gr;g.beginPath();g.arc(it.x,py,r*2.6,0,PI*2);g.fill();g.restore();
    }
    portraitDisc(g,f.k,it.x,py,r,it.on?'#ffe08a':(f.side==='yuan'?'#ff6a4d':'#4fb8ff'),(it.on?4:3)*k,z);
    /* 名字牌：紧贴圆卡下沿，只留 2px */
    const fs=19*k;
    g.font=`700 ${fs}px ${HEI}`;
    const tw=g.measureText(f.name).width+16*k,th=26*k;
    g.fillStyle='rgba(8,26,31,.92)';
    g.beginPath();g.roundRect(it.x-tw/2,py+r+2*k,tw,th,5*k);g.fill();
    g.fillStyle='#f7edda';g.textAlign='center';g.textBaseline='middle';
    g.fillText(f.name,it.x,py+r+2*k+th*.52);
    g.restore();
  }
}
/* ================= 近景细节层：粮仓 / 城池 / 关隘 =================
   镜头推到 z≥1.18 才淡入；1.6 全量。只在近景补结构，不增加远景噪点。 */
function drawGranaryDetail(g,x,y,sc,t){
  g.save();g.translate(x,y);g.scale(sc,sc);
  /* 木栅栏 */
  g.strokeStyle='rgba(74,54,32,.88)';g.lineWidth=2;
  g.beginPath();g.roundRect(-56,-38,112,80,6);g.stroke();
  g.lineWidth=1.1;
  for(let i=-52;i<=52;i+=11){g.beginPath();g.moveTo(i,-38);g.lineTo(i,-33);g.moveTo(i,42);g.lineTo(i,37);g.stroke()}
  /* 六座仓廪：草顶 + 仓身箍 + 投影 */
  for(const [sx,sy] of [[-32,-12],[-6,-20],[22,-10],[-22,16],[6,18],[32,18]]){
    g.fillStyle='rgba(24,18,10,.28)';g.beginPath();g.ellipse(sx+2,sy+12,13,4.5,0,0,PI*2);g.fill();
    g.fillStyle='rgba(228,210,168,.97)';g.beginPath();g.arc(sx,sy,11,0,PI*2);g.fill();
    g.strokeStyle='rgba(70,52,30,.92)';g.lineWidth=1.7;g.stroke();
    g.fillStyle='rgba(122,88,46,.97)';
    g.beginPath();g.moveTo(sx-13.5,sy-3);g.quadraticCurveTo(sx,sy-21,sx+13.5,sy-3);g.closePath();g.fill();
    g.strokeStyle='rgba(62,42,22,.8)';g.lineWidth=1;g.stroke();
    for(let i=-8;i<=8;i+=4){g.beginPath();g.moveTo(sx+i,sy-5);g.lineTo(sx+i*.55,sy-15);g.stroke()}
    g.strokeStyle='rgba(126,100,62,.8)';g.lineWidth=1;
    g.beginPath();g.arc(sx,sy,7,.15,PI-.15);g.stroke();
    /* 仓门 */
    g.fillStyle='rgba(88,62,34,.9)';g.fillRect(sx-2.6,sy+1,5.2,8);
  }
  /* 麻袋垛 */
  for(let r=0;r<3;r++)for(let c=0;c<4-r;c++){
    const bx=-48+c*9+r*4.5,by=28-r*5.4;
    g.fillStyle=r%2?'rgba(208,184,140,.96)':'rgba(190,164,120,.96)';
    g.beginPath();g.roundRect(bx,by,8,5.6,2);g.fill();
    g.strokeStyle='rgba(90,68,40,.55)';g.lineWidth=.8;g.stroke();
  }
  /* 火把 */
  for(const tx of [-60,60]){g.fillStyle='rgba(60,44,26,.9)';g.fillRect(tx-1.4,10,2.8,16)}
  g.restore();
}
function drawWalledDetail(g,x,y,sc){
  const w=42*sc,h=29*sc;
  g.save();g.translate(x,y);
  g.fillStyle='rgba(24,18,10,.22)';g.beginPath();g.ellipse(2,h*.55,w*.55,6*sc,0,0,PI*2);g.fill();
  g.fillStyle='rgba(240,229,203,.98)';
  g.beginPath();g.roundRect(-w/2,-h/2,w,h,2);g.fill();
  g.strokeStyle='rgba(54,40,24,.96)';g.lineWidth=2.4;g.stroke();
  /* 垛口（上下各 7 齿） */
  g.fillStyle='rgba(54,40,24,.94)';
  const n=7,step=w/n;
  for(let i=0;i<n;i+=2){g.fillRect(-w/2+i*step+1.2,-h/2-4.2*sc,step-2.4,4.2*sc);g.fillRect(-w/2+i*step+1.2,h/2,step-2.4,4.2*sc)}
  /* 城门 + 城楼 */
  g.fillStyle='rgba(150,112,66,.97)';g.fillRect(-7*sc,h/2-9.5*sc,14*sc,9.5*sc);
  g.fillStyle='rgba(96,70,40,.97)';
  g.beginPath();g.moveTo(-11.5*sc,h/2-9.5*sc);g.lineTo(0,h/2-18*sc);g.lineTo(11.5*sc,h/2-9.5*sc);g.closePath();g.fill();
  /* 城内屋舍（俯视小方块 + 瓦脊） */
  for(const [hx,hy,hs] of [[-12,-6,7],[2,-8,6],[-3,4,7],[11,3,5.5],[-14,6,5]]){
    g.fillStyle='rgba(196,176,140,.95)';g.fillRect(hx*sc-3.5*sc,hy*sc-3*sc,7*sc,6*sc);
    g.strokeStyle='rgba(70,54,32,.75)';g.lineWidth=.9;g.strokeRect(hx*sc-3.5*sc,hy*sc-3*sc,7*sc,6*sc);
    g.beginPath();g.moveTo(hx*sc-3.5*sc,hy*sc);g.lineTo(hx*sc+3.5*sc,hy*sc);g.stroke();
  }
  /* 城头旗 */
  for(const fx of [-w/2+3, w/2-3]){
    g.strokeStyle='rgba(58,44,26,.9)';g.lineWidth=1.3;
    g.beginPath();g.moveTo(fx,-h/2);g.lineTo(fx,-h/2-15*sc);g.stroke();
    g.fillStyle='rgba(198,86,66,.95)';
    g.beginPath();g.moveTo(fx,-h/2-15*sc);g.lineTo(fx+8*sc,-h/2-12.4*sc);g.lineTo(fx,-h/2-9.8*sc);g.closePath();g.fill();
  }
  g.restore();
}
function drawFortDetail(g,x,y,sc){
  g.save();g.translate(x,y);
  const w=30*sc,h=30*sc;
  g.fillStyle='rgba(240,229,203,.98)';g.beginPath();g.roundRect(-w/2,-h/2,w,h,2);g.fill();
  g.strokeStyle='rgba(52,40,26,.96)';g.lineWidth=2.4;g.stroke();
  g.fillStyle='rgba(52,40,26,.94)';
  const n=5,step=w/n;
  for(let i=0;i<n;i+=2){g.fillRect(-w/2+i*step+1,-h/2-4*sc,step-2,4*sc);g.fillRect(-w/2+i*step+1,h/2,step-2,4*sc)}
  /* 门洞 + 望楼 */
  g.fillStyle='rgba(40,30,18,.92)';g.fillRect(-5*sc,h/2-9*sc,10*sc,9*sc);
  g.strokeStyle='rgba(58,44,26,.95)';g.lineWidth=2;
  g.beginPath();g.moveTo(-8*sc,-h/2);g.lineTo(-8*sc,-h/2-13*sc);g.moveTo(8*sc,-h/2);g.lineTo(8*sc,-h/2-13*sc);g.stroke();
  g.fillStyle='rgba(226,210,172,.97)';g.fillRect(-10*sc,-h/2-17*sc,20*sc,6*sc);
  g.strokeStyle='rgba(58,44,26,.95)';g.lineWidth=1.6;g.strokeRect(-10*sc,-h/2-17*sc,20*sc,6*sc);
  g.fillStyle='rgba(88,62,36,.95)';
  g.beginPath();g.moveTo(-12*sc,-h/2-17*sc);g.lineTo(0,-h/2-24*sc);g.lineTo(12*sc,-h/2-17*sc);g.closePath();g.fill();
  g.restore();
}
function siteDetail(g,v,z){
  const k=Math.max(0,Math.min(1,(z-1.18)/.42));
  if(k<=0)return;
  g.save();g.globalAlpha*=k;
  drawGranaryDetail(g,570,500,1.02+.34*k,v);
  for(const s of TERRAIN.sites||[]){
    if(s.kind==='granary')continue;
    const sc=(s.size||1)*(.92+.42*k);
    if(s.kind==='fort')drawFortDetail(g,s.x,s.y,sc);
    else if(s.kind==='capital'||s.kind==='city')drawWalledDetail(g,s.x,s.y,sc);
  }
  g.restore();
}

/* 缓慢扫过地图的侧光：即便镜头静止，画面也有持续光影流动。
   用 lighter（叠加）而非 overlay：软件光栅下 overlay 全屏混合会慢一个数量级。 */
function lightSweep(g,t){
  const x=W*(.5+.40*Math.sin(t*.045+.8)),y=H*(.34+.17*Math.sin(t*.061+2.0));
  g.save();g.globalCompositeOperation='lighter';
  const gr=g.createRadialGradient(x,y,30,x,y,820);
  gr.addColorStop(0,'rgba(255,232,184,.06)');gr.addColorStop(.55,'rgba(255,210,150,.028)');gr.addColorStop(1,'rgba(255,200,140,0)');
  g.fillStyle=gr;g.fillRect(0,0,W,H);g.restore();
}

function cartAngle(path,u){
  const tg=tangentAtPath(path,u);
  return Math.atan2(tg[1],tg[0]);
}
function mixColor(a,b,u){
  const A=[parseInt(a.slice(1,3),16),parseInt(a.slice(3,5),16),parseInt(a.slice(5,7),16)];
  const B=[parseInt(b.slice(1,3),16),parseInt(b.slice(3,5),16),parseInt(b.slice(5,7),16)];
  return `rgb(${Math.round(A[0]+(B[0]-A[0])*u)},${Math.round(A[1]+(B[1]-A[1])*u)},${Math.round(A[2]+(B[2]-A[2])*u)})`;
}

/* ================= 屏幕层画面件 ================= */
function banner(g,v,a){
  if(a.i===0)return;
  const m=ACT_META[a.i];
  const al=fade(v,a.t0+.05,a.t0+.65,a.t0+3.7,a.t0+4.7);
  if(al<=0)return;
  g.save();g.globalAlpha=al;
  const text=m.title,sub=m.sub;
  g.font=`800 44px ${SONG}`;
  const tw=g.measureText(text).width,sw=Math.min(700,g.measureText(sub).width+160);
  const w=Math.max(tw+170,sw),cx=W/2,cy=102;
  const gr=g.createLinearGradient(cx-w/2,0,cx+w/2,0);
  gr.addColorStop(0,'rgba(18,14,10,0)');gr.addColorStop(.16,'rgba(18,14,10,.93)');
  gr.addColorStop(.84,'rgba(18,14,10,.93)');gr.addColorStop(1,'rgba(18,14,10,0)');
  g.fillStyle=gr;g.fillRect(cx-w/2,cy-42,w,90);
  g.textAlign='center';g.textBaseline='middle';g.fillStyle='#f6efdc';
  g.shadowColor='rgba(0,0,0,.65)';g.shadowBlur=14;g.fillText(text,cx,cy-4);
  g.shadowBlur=0;
  g.font=`600 20px ${HEI}`;g.fillStyle='rgba(230,206,160,.92)';g.fillText(sub,cx,cy+30);
  g.fillStyle='rgba(226,176,102,.95)';g.fillRect(cx-w/2+30,cy+44,56,3);g.fillRect(cx+w/2-86,cy+44,56,3);
  txt(g,`${String(a.i+1).padStart(2,'0')} / 15`,cx-w/2+62,cy-4,16,'rgba(210,188,150,.8)',600,'center');
  g.restore();
}
function legend(g,v,a){
  if(a.i>2)return;
  const al=a.i<3?range(v,.8,1.8):range(v,a.t0,a.t0+1.2);
  if(al<=0)return;
  g.save();g.globalAlpha=al;
  panel(g,64,812,376,124,'rgba(14,22,20,.80)','rgba(214,184,126,.40)');
  txt(g,'兵力与粮道',88,840,19,'#e2d3af',700);
  line(g,90,870,126,870,'#d92f1f',4);
  g.fillStyle='#d92f1f';g.beginPath();g.arc(108,870,3.2,0,PI*2);g.fill();
  txt(g,'袁绍军 · 精卒十万',140,870,18,'#f0e0c8',600);
  txt(g,'粮道自邺城',140,894,15,'rgba(214,190,160,.75)',500);
  line(g,90,918,126,918,'#1f7fd0',4);
  g.fillStyle='#1f7fd0';g.beginPath();g.arc(108,918,3.2,0,PI*2);g.fill();
  txt(g,'曹操军 · 二万余',140,918,18,'#f0e0c8',600);
  txt(g,'粮道自许都',140,942,15,'rgba(214,190,160,.75)',500);
  g.restore();
}
function bigTitle(g,v){
  /* 2.25 秒收工：先把「2万 vs 10万」砸在观众脸上，立刻让位给地图运镜 */
  const a=range(v,0.05,0.32)*(1-range(v,1.95,2.55));
  if(a<=0)return;
  g.save();g.globalAlpha=a;
  const gr=g.createLinearGradient(0,0,0,H);
  gr.addColorStop(0,'rgba(8,8,10,.52)');gr.addColorStop(.42,'rgba(8,8,10,.12)');gr.addColorStop(1,'rgba(8,8,10,.55)');
  g.fillStyle=gr;g.fillRect(0,0,W,H);
  song(g,'曹操两万人',W/2,232,98,'#f8f0da',1,'center');
  song(g,'凭什么打赢袁绍十万？',W/2,352,64,'#f1e2c1',1,'center');
  txt(g,'2 万',W/2-230,462,56,'#6fe0c0',800,'center');
  txt(g,'⇄',W/2,457,44,'rgba(240,228,200,.75)',600,'center');
  txt(g,'10 万',W/2+230,462,56,'#e07a5c',800,'center');
  txt(g,'官渡之战 · 建安五年 · 今河南中牟',W/2,520,21,'rgba(232,218,188,.78)',500,'center');
  g.restore();
}
function numberCard(g,x,y,w,h,title,value,sub,color,alpha){
  if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;
  panel(g,x,y,w,h,'rgba(14,22,20,.86)','rgba(214,184,126,.42)');
  txt(g,title,x+20,y+30,18,'rgba(226,211,175,.88)',600);
  txt(g,value,x+20,y+74,38,color,800);
  if(sub)txt(g,sub,x+20,y+102,15,'rgba(214,190,160,.76)',500);
  g.restore();
}
function pathCard(g,x,y,w,h,title,sub,color,state,alpha){
  if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;
  const active=state==='active'||state==='chosen';
  panel(g,x,y,w,h,active?'rgba(20,30,26,.92)':'rgba(14,22,20,.78)',
    active?color:'rgba(214,184,126,.32)');
  g.fillStyle=color;g.globalAlpha*=.85;g.fillRect(x,y+10,5,h-20);g.globalAlpha/= .85;
  txt(g,title,x+22,y+36,25,'#f2e6cc',700);
  if(sub)txt(g,sub,x+22,y+68,15,'rgba(216,198,164,.78)',500);
  if(state==='crossed')crossMark(g,x+w-42,y+h/2,22,'rgba(255,104,78,.9)',1);
  if(state==='chosen')checkMark(g,x+w-42,y+h/2,18,'#6fe0c0',1);
  g.restore();
}
function quotePanel(g,x,y,w,h,quote,source,alpha){
  if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;
  panel(g,x,y,w,h,'rgba(18,20,18,.90)','rgba(224,196,138,.5)');
  g.font=`800 30px ${SONG}`;g.fillStyle='#f4e8cc';g.textAlign='left';g.textBaseline='top';
  const lines=quote.split('\n');
  lines.forEach((s,i)=>g.fillText(s,x+24,y+28+i*42));
  if(source)txt(g,source,x+24,y+h-30,15,'rgba(210,188,150,.78)',500);
  g.restore();
}
function drawForceGrid(g,x,y,w,h,cols,rows,color,alpha){
  if(alpha<=0)return;
  const cw=w/cols,ch=h/rows;
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
    const a=Math.max(0,Math.min(1,alpha*1.5-(i+j)*.02));
    if(a<=0)continue;
    g.save();g.globalAlpha=a;g.fillStyle=color;
    g.fillRect(x+i*cw+2,y+j*ch+2,cw-4,ch-4);
    g.restore();
  }
}
function drawGate(g,x,y,alpha){
  if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;g.strokeStyle='rgba(255,214,140,.92)';g.lineWidth=5;g.lineCap='round';
  g.beginPath();g.moveTo(x-40,y+30);g.lineTo(x-40,y-24);g.moveTo(x+40,y+30);g.lineTo(x+40,y-24);
  g.moveTo(x-48,y-24);g.lineTo(x+48,y-24);g.stroke();
  g.restore();
  unitTag(g,'许都北大门',x,y-58,'#ffd08a',{size:19,alpha});
}
function drawShield(g,x,y,alpha){
  if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;g.strokeStyle='#6fe0c0';g.lineWidth=4;
  g.beginPath();g.moveTo(x,y-42);g.lineTo(x+34,y-26);g.lineTo(x+30,y+20);
  g.quadraticCurveTo(x,y+46,x-30,y+20);g.lineTo(x-34,y-26);g.closePath();g.stroke();
  g.restore();
  unitTag(g,'守官渡',x,y+70,'#6fe0c0',{size:19,alpha});
}
function drawCatapult(g,x,y,alpha,t){
  if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;g.translate(x,y);
  g.strokeStyle='#6b4a2e';g.lineWidth=4;g.lineCap='round';
  g.beginPath();g.moveTo(-26,16);g.lineTo(-18,-12);g.lineTo(20,-12);g.lineTo(28,16);g.closePath();g.stroke();
  g.beginPath();g.moveTo(-14,10);g.lineTo(12,-34);g.lineTo(24,-42);g.stroke();
  g.fillStyle='#8a5438';g.beginPath();g.arc(14,-38,7,0,PI*2);g.fill();
  g.restore();
  unitTag(g,'霹雳车',x,y-54,'#e8c98e',{size:16,alpha});
}
function drawClock(g,x,y,r,alpha,t){
  if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;g.strokeStyle='rgba(240,206,140,.9)';g.lineWidth=3;
  g.beginPath();g.arc(x,y,r,0,PI*2);g.stroke();
  const a=-PI/2+t*.7;
  g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*r*.78,y+Math.sin(a)*r*.78);g.stroke();
  g.beginPath();g.moveTo(x,y);g.lineTo(x,y-r*.55);g.stroke();
  g.restore();
  unitTag(g,'持久消耗',x,y+r+28,'#e8c98e',{size:16,alpha});
}
function drawRuler(g,x1,y1,x2,y2,label,color,alpha){
  if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;g.strokeStyle=color;g.lineWidth=2.5;
  g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
  const n=8;
  for(let i=0;i<=n;i++){
    const u=i/n,x=x1+(x2-x1)*u,y=y1+(y2-y1)*u;
    const dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy)||1;
    const nx=-dy/l,ny=dx/l;
    g.beginPath();g.moveTo(x-nx*6,y-ny*6);g.lineTo(x+nx*6,y+ny*6);g.stroke();
  }
  g.restore();
  unitTag(g,label,(x1+x2)/2,(y1+y2)/2-18,color,{size:16,alpha});
}

/* ================= 世界层：地图与两军 ================= */
function drawBase(g,v,opts={}){
  g.drawImage(off,0,0);
  drawRegionWash(g,TERRAIN,{alpha:(opts.wash??range(v,.3,1.8))*.95});
  drawRiverCurrents(g,TERRAIN,v,.55);
}
function drawSupplyLines(g,v,alpha=1,yuanFade=1){
  const a=alpha;
  supplyLine(g,PATHS.yuanSupply,{t:v,color:'#d92f1f',alpha:a*yuanFade*.95,width:3.2,dash:[11,10],count:8,speed:.045,seed:5});
  supplyLine(g,PATHS.caoSupply,{t:v,color:'#1f7fd0',alpha:a,width:3.2,dash:[11,10],count:6,speed:.055,seed:9});
  for(const [u,path,color,al] of [[.30,PATHS.yuanSupply,'#d92f1f',a*yuanFade],[.58,PATHS.yuanSupply,'#d92f1f',a*yuanFade],[.36,PATHS.caoSupply,'#1f7fd0',a]]){
    const p=pointAtPath(path,u);
    baggageCart(g,p[0]+10,p[1]-12,cartAngle(path,u)-PI/2,{scale:.78,alpha:al*.9});
  }
}
/* 两军对垒轴：袁营在东北、曹营在西南，双方营门与方阵正面沿
   「袁→曹」连线相对，不再各自朝南排成南北纵队。 */
const CAMP_Y={x:1080,y:474,w:208,h:134};
const CAMP_C={x:858,y:628,w:174,h:112};
const FACE_Y=Math.atan2(CAMP_C.y-CAMP_Y.y,CAMP_C.x-CAMP_Y.x); // 袁→曹
const FACE_C=FACE_Y+PI;                                       // 曹→袁
const CAMP_ROT_Y=FACE_Y-PI/2;   // 营门朝曹
const CAMP_ROT_C=FACE_C-PI/2;   // 营门朝袁
const FORM_ROT_Y=FACE_Y+PI/2;   // 方阵正面朝曹
const FORM_ROT_C=FACE_C+PI/2;   // 方阵正面朝袁
function rotPoint(x,y,cx,cy,r){
  const c=Math.cos(r),s=Math.sin(r),dx=x-cx,dy=y-cy;
  return [cx+dx*c-dy*s,cy+dx*s+dy*c];
}
/* 营寨整体转向，标签始终水平；labelX/labelY 可避开阵前单位。 */
function rotatedCamp(g,cx,cy,w,h,color,opt={}){
  const rot=opt.rot||0;
  g.save();g.translate(cx,cy);g.rotate(rot);
  camp(g,0,0,w,h,color,{...opt,label:null});
  g.restore();
  if(opt.label){
    const bh=Math.abs(w*Math.sin(rot))+Math.abs(h*Math.cos(rot));
    const lx=opt.labelX??cx,ly=opt.labelY??(cy-bh/2-(opt.labelGap??18));
    unitTag(g,opt.label,lx,ly,color,{size:opt.labelSize||19,alpha:opt.alpha??1});
  }
}
function facingBlock(g,cx,cy,w,h,color,opt={},rot=0){
  g.save();g.translate(cx,cy);g.rotate(rot);
  infantryBlock(g,0,0,w,h,color,{...opt,label:null});
  g.restore();
}
function facingCavalry(g,cx,cy,w,h,color,opt={},rot=0){
  g.save();g.translate(cx,cy);g.rotate(rot);
  cavalry(g,0,0,w,h,color,{...opt,label:null});
  g.restore();
}
function drawCamps(g,v,alpha=1,flip=0){
  if(alpha<=0)return;
  const [ex,ey]=rotPoint(CAMP_Y.x,CAMP_Y.y-85,CAMP_Y.x,CAMP_Y.y,CAMP_ROT_Y);
  const [w1x,w1y]=rotPoint(CAMP_Y.x-80,CAMP_Y.y-75,CAMP_Y.x,CAMP_Y.y,CAMP_ROT_Y);
  const [w2x,w2y]=rotPoint(CAMP_Y.x+80,CAMP_Y.y-75,CAMP_Y.x,CAMP_Y.y,CAMP_ROT_Y);
  g.save();g.translate(ex,ey);g.rotate(CAMP_ROT_Y);
  earthworks(g,0,0,214,58,{alpha:alpha*.85,label:null,color:'#a4553e'});
  g.restore();
  unitTag(g,'土山',ex,ey-46,'#a4553e',{size:16,alpha});
  watchtower(g,w1x,w1y,{scale:.86,t:v,color:'#8a5438',flag:'#d92f1f',alpha});
  watchtower(g,w2x,w2y,{scale:.86,t:v,color:'#8a5438',flag:'#d92f1f',alpha});
  rotatedCamp(g,CAMP_Y.x,CAMP_Y.y,CAMP_Y.w,CAMP_Y.h,'#d92f1f',
    {t:v,label:'袁绍大营',tents:7,tentCols:3,alpha,seed:13,labelSize:20,rot:CAMP_ROT_Y});
  rotatedCamp(g,CAMP_C.x,CAMP_C.y,CAMP_C.w,CAMP_C.h,'#1f7fd0',
    {t:v,label:'曹操大营',tents:5,tentCols:3,alpha,seed:17,labelSize:19,rot:CAMP_ROT_C,
      labelX:700,labelY:600});
  const zh=mixColor('#d92f1f','#1f7fd0',flip);
  const zhRot=CAMP_ROT_Y+(CAMP_ROT_C-CAMP_ROT_Y)*flip;
  rotatedCamp(g,1228,588,126,88,zh,{t:v,label:flip>.55?'张郃 · 高览 已降':'张郃 · 高览',
    tents:4,tentCols:2,alpha:alpha*.95,seed:23,labelSize:17,tentScale:.86,rot:zhRot});
  if(flip>.02)drawSiteHalo(g,1228,588,78,'rgba(92,214,180,.9)',flip*.85,v);
}
/* ================= 近景方阵细节：枪林 + 将旗 ================= */
function spearForest(g,cx,cy,w,h,color,rot,alpha){
  g.save();g.translate(cx,cy);g.rotate(rot);g.globalAlpha*=alpha;
  /* 枪尖裁在方阵内：向中线统一收束，避免黑线越界像乱排线 */
  g.save();
  g.beginPath();g.roundRect(-w/2+1.6,-h*.62,w-3.2,h*1.02,3);g.clip();
  const n=Math.max(10,Math.round(w/5.6));
  for(let i=0;i<n;i++){
    const x=-w/2+(i+.5)*w/n,lean=-x/w*4.5;
    g.strokeStyle='rgba(38,28,16,.5)';g.lineWidth=1.5;
    g.beginPath();g.moveTo(x,h*.20);g.lineTo(x+lean,-h*.62);g.stroke();
    g.strokeStyle='rgba(236,220,180,.30)';g.lineWidth=.7;
    g.beginPath();g.moveTo(x+.7,h*.20);g.lineTo(x+lean+.7,-h*.62);g.stroke();
    g.fillStyle='rgba(40,30,18,.88)';
    g.beginPath();g.moveTo(x+lean,-h*.665);g.lineTo(x+lean+1.8,-h*.615);g.lineTo(x+lean-1.8,-h*.615);g.closePath();g.fill();
  }
  g.restore();
  /* 燕尾将旗（带缺口与轻摆） */
  for(const side of [-1,1]){
    const bx=side*w*.42,wob=Math.sin(CURZ*2.4+side*1.7)*1.5;
    g.save();g.globalAlpha*=.96;
    g.strokeStyle='rgba(38,28,16,.95)';g.lineWidth=2;
    g.beginPath();g.moveTo(bx,h*.24);g.lineTo(bx,-h*1.02);g.stroke();
    g.fillStyle=color;
    g.beginPath();
    g.moveTo(bx,-h*1.02);
    g.quadraticCurveTo(bx+10+wob,-h*.95,bx+14,-h*.80);
    g.quadraticCurveTo(bx+7,-h*.845,bx+2.5,-h*.745);
    g.quadraticCurveTo(bx+8,-h*.72,bx+12,-h*.615);
    g.quadraticCurveTo(bx+5,-h*.625,bx,-h*.60);
    g.closePath();g.fill();
    g.strokeStyle='rgba(20,14,8,.32)';g.lineWidth=.9;g.stroke();
    g.restore();
  }
  g.restore();
}
/* 十万人的“势”：阵列周围压一层暖尘光，推近时才有压迫感 */
function warDust(g,cx,cy,r,alpha){
  const k=Math.max(0,Math.min(1,(CURZ-1.5)/.5));
  if(k<=0||alpha<=0)return;
  g.save();g.globalCompositeOperation='lighter';g.globalAlpha*=.17*alpha*k;
  const gr=g.createRadialGradient(cx,cy,r*.18,cx,cy,r);
  gr.addColorStop(0,'rgba(220,192,140,.95)');gr.addColorStop(.55,'rgba(206,176,124,.35)');gr.addColorStop(1,'rgba(200,170,120,0)');
  g.fillStyle=gr;g.beginPath();g.arc(cx,cy,r,0,PI*2);g.fill();g.restore();
}
function blockDetail(g,cx,cy,w,h,color,rot,alpha){
  const k=Math.max(0,Math.min(1,(CURZ-1.45)/.55));
  if(k<=0)return;
  spearForest(g,cx,cy,w,h,color,rot,alpha*k);
}

function drawForces(g,v,alpha=1){
  if(alpha<=0)return;
  /* 近景加密：镜头推到 2 倍时，一个方阵从 8×3 变成 12×5、士兵也放大，
     远看是阵列，近看是「一排排带盔执矛的人」，而不是几个色块。 */
  const dq=Math.max(1,Math.min(1.75,CURZ/1.35));
  warDust(g,1080,500,240,alpha);
  warDust(g,858,628,170,alpha);
  const blk=(seed,cols,rows)=>({alpha,seed,cols:Math.round(cols*dq),rows:Math.max(rows,Math.round(rows*dq)),scale:.86*Math.min(1.32,.92+dq*.20),
    fill:CURZ>1.4?'rgba(150,26,16,.30)':'rgba(120,26,16,.24)',
    bodyColor:CURZ>1.55?'rgba(255,238,214,.95)':null,helmet:CURZ>1.55?'rgba(255,250,236,.99)':null});
  const cblk=(seed,cols,rows)=>({alpha,seed,cols:Math.round(cols*Math.min(1.45,dq)),rows:Math.max(rows,Math.round(rows*Math.min(1.45,dq))),scale:.9*Math.min(1.3,.94+dq*.18),
    fill:CURZ>1.4?'rgba(14,62,132,.32)':'rgba(12,52,112,.26)',
    bodyColor:CURZ>1.55?'rgba(232,244,255,.95)':null,helmet:CURZ>1.55?'rgba(252,250,244,.99)':null});
  const dY=[Math.cos(FACE_Y),Math.sin(FACE_Y)];
  const pY=[-Math.sin(FACE_Y),Math.cos(FACE_Y)];
  const fy=[CAMP_Y.x+dY[0]*95,CAMP_Y.y+dY[1]*95];
  const y1=[fy[0]+pY[0]*120,fy[1]+pY[1]*120];
  const y3=[fy[0]-pY[0]*120,fy[1]-pY[1]*120];
  facingBlock(g,y1[0],y1[1],118,46,'#d92f1f',blk(31,8,3),FORM_ROT_Y);
  blockDetail(g,y1[0],y1[1],118,46,'#d92f1f',FORM_ROT_Y,alpha);
  facingBlock(g,fy[0],fy[1],112,44,'#d92f1f',blk(35,8,3),FORM_ROT_Y);
  blockDetail(g,fy[0],fy[1],112,44,'#d92f1f',FORM_ROT_Y,alpha);
  facingBlock(g,y3[0],y3[1],118,46,'#d92f1f',blk(33,8,3),FORM_ROT_Y);
  blockDetail(g,y3[0],y3[1],118,46,'#d92f1f',FORM_ROT_Y,alpha);
  facingCavalry(g,1288,462,106,70,'#d92f1f',cblk(37,3,3),FORM_ROT_Y);
  unitTag(g,'袁绍军 · 精卒十万',1080,300,'#d92f1f',{size:20/Math.max(1,CURZ*.78),fill:'rgba(38,20,16,.86)',alpha});

  const dC=[Math.cos(FACE_C),Math.sin(FACE_C)];
  const pC=[-Math.sin(FACE_C),Math.cos(FACE_C)];
  const fc=[CAMP_C.x+dC[0]*90,CAMP_C.y+dC[1]*90];
  const c1=[fc[0]+pC[0]*72,fc[1]+pC[1]*72];
  const c2=[fc[0]-pC[0]*72,fc[1]-pC[1]*72];
  facingBlock(g,c1[0],c1[1],104,44,'#1f7fd0',blk(41,7,3),FORM_ROT_C);
  blockDetail(g,c1[0],c1[1],104,44,'#1f7fd0',FORM_ROT_C,alpha);
  facingBlock(g,c2[0],c2[1],104,44,'#1f7fd0',blk(43,7,3),FORM_ROT_C);
  blockDetail(g,c2[0],c2[1],104,44,'#1f7fd0',FORM_ROT_C,alpha);
  facingCavalry(g,772,682,92,60,'#1f7fd0',cblk(45,3,2),FORM_ROT_C);
  unitTag(g,'曹操军 · 二万余',700,665,'#1f7fd0',{size:19/Math.max(1,CURZ*.78),fill:'rgba(14,32,28,.86)',alpha});
}
function drawNightLights(g,v,alpha=1){
  if(alpha<=0)return;
  const spots=[[1002,536],[1160,536],[986,432],[1176,432],[790,678],[926,678],[792,584],[928,584],[1228,540],[1180,600]];
  spots.forEach(([x,y],i)=>torch(g,x,y,v+i*.37,{scale:.82,alpha:alpha*.9}));
}
function nightOverlay(g,alpha){
  if(alpha<=0)return;
  g.fillStyle=`rgba(5,10,22,${.52*alpha})`;
  g.fillRect(-220,-220,W+440,H+440);
}

/* ================= 分幕世界层 ================= */
function actHook(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,.55);
  drawCamps(g,v,.88);
  drawForces(g,v,.95);
  /* 行军路线：袁自邺城南下、曹自许都北上，虚线箭头沿线流动 */
  const rv=range(v,.55,2.1);
  marchRoute(g,PATHS.yuanSupply,{t:v,alpha:.92*rv,color:'rgba(240,150,120,.95)',
    glow:'rgba(255,120,90,.12)',width:4.2,arrows:2,rate:.085,headColor:'rgba(255,178,148,.98)'});
  marchRoute(g,PATHS.caoSupply,{t:v,alpha:.92*rv,color:'rgba(126,230,206,.95)',
    glow:'rgba(90,230,200,.12)',width:4.2,arrows:2,rate:.085,headColor:'rgba(170,246,226,.98)'});
  const ff=ap(v,a,.82,.96);
  if(ff>0)fireGlow(g,570,500,230,v,.55*ff,{color:[255,120,40]});
}
function actLedger(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,1);
  drawCamps(g,v,.8);
  drawForces(g,v,.85);
  drawForceGrid(g,872,250,360,150,10,10,'rgba(208,106,80,.58)',ap(v,a,.06,.46));
  drawForceGrid(g,742,596,210,116,6,4,'rgba(94,203,176,.68)',ap(v,a,.10,.50));
  unitTag(g,'袁绍军 · 精卒十万',1080,300,'#d92f1f',{size:20,fill:'rgba(38,20,16,.86)',alpha:.85});
  unitTag(g,'十万：一万人一格 · 十行',872,236,'#e08a70',{size:16,alpha:ap(v,a,.2,.5)});
  unitTag(g,'两三万：六列四行',742,770,'#6fe0c0',{size:16,alpha:ap(v,a,.24,.54)});
  const p=pointAtPath(PATHS.yuanSupply,.42);
  const p2=pointAtPath(PATHS.caoSupply,.5);
  for(let i=0;i<4;i++){
    baggageCart(g,p[0]+i*18,p[1]-8+i*4,cartAngle(PATHS.yuanSupply,.42)-PI/2,{scale:.72,alpha:ap(v,a,.2,.5)});
    if(i<2)baggageCart(g,p2[0]+i*16,p2[1]-6-i*4,cartAngle(PATHS.caoSupply,.5)-PI/2,{scale:.7,alpha:ap(v,a,.3,.6)});
  }
}
function actWhy(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,1);
  drawCamps(g,v,.65);
  drawForces(g,v,.6);
  const ax=ap(v,a,.05,.32);
  routeLine(g,PATHS.axis,{alpha:ax*.72,color:'rgba(240,224,180,.62)',dash:[2,8],width:3});
  drawGate(g,948,700,ax);
  drawSiteHalo(g,948,700,66,'rgba(255,214,140,.9)',ax,v);
  /* 十万人真正能同时展开的正面 */
  const f=ap(v,a,.38,.72);
  if(f>0){
    g.save();g.globalAlpha*=f;g.strokeStyle='rgba(240,206,140,.85)';g.lineWidth=2.5;
    g.beginPath();g.moveTo(928,400);g.lineTo(928,446);g.moveTo(928,423);g.lineTo(1236,423);g.lineTo(1236,446);g.stroke();
    g.restore();
    unitTag(g,'真正能同时展开的正面',1082,384,'#e8c98e',{size:17,alpha:f});
    const cols=14;
    for(let i=0;i<cols;i++){
      const x=936+i*21;
      infantryBlock(g,x,432,18,16,'#d92f1f',{alpha:f*.9,seed:100+i,cols:2,rows:2,scale:.4,flag:false});
    }
  }
  unitTag(g,'邺城 → 延津 → 官渡 → 许都',1080,850,'rgba(232,218,188,.9)',{size:18,alpha:ap(v,a,.15,.4)});
}
function actYuanRoads(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,.75);
  drawCamps(g,v,.92);
  drawForces(g,v,.8);
  const d=dur(a);
  attackArrow(g,1118,500,944,606,{t:v,t0:a.t0+d*.10,t1:a.t0+d*.30,color:'#e07050',width:6,bend:-24,
    label:'正面碾压',labelAt:.55,labelColor:'#f0a080',labelSize:18,alpha:ap(v,a,.05,.12)});
  routeLine(g,PATHS.raidXu,{alpha:ap(v,a,.30,.44)*.85,color:'rgba(224,112,80,.72)',dash:[8,10],width:3});
  column(g,PATHS.raidXu,{t:v,t0:a.t0+d*.36,t1:a.t0+d*.64,count:10,span:.42,color:'#d06a50',type:'infantry',
    size:.78,seed:71,alpha:ap(v,a,.32,.42)});
  unitTag(g,'分兵袭许都',1172,746,'#e88e70',{size:18,alpha:ap(v,a,.38,.48)});
  drawClock(g,1360,380,30,ap(v,a,.46,.60),v);
  drawSiteHalo(g,845,915,54,'rgba(255,170,110,.9)',ap(v,a,.40,.52),v);
}
function actCaoRoads(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,.9);
  drawCamps(g,v,.9);
  drawForces(g,v,.8);
  const d=dur(a);
  attackArrow(g,884,660,882,876,{t:v,t0:a.t0+d*.08,t1:a.t0+d*.26,color:'rgba(110,210,190,.8)',width:5,bend:0,
    dash:[8,8],label:'退守许都',labelAt:.74,labelColor:'#8ee9cc',labelSize:17,alpha:ap(v,a,.04,.1)});
  crossMark(g,882,750,24,'rgba(255,96,72,.92)',ap(v,a,.20,.28));
  attackArrow(g,860,664,702,782,{t:v,t0:a.t0+d*.16,t1:a.t0+d*.34,color:'rgba(110,210,190,.8)',width:5,bend:16,
    dash:[8,8],label:'放弃官渡',labelAt:.55,labelColor:'#8ee9cc',labelSize:17,alpha:ap(v,a,.12,.18)});
  crossMark(g,712,768,24,'rgba(255,96,72,.92)',ap(v,a,.28,.36));
  drawShield(g,948,700,ap(v,a,.40,.56));
  drawSiteHalo(g,948,700,60,'rgba(111,224,192,.9)',ap(v,a,.40,.56),v);
  /* 内线 / 外线 */
  const n=ap(v,a,.52,.68);
  if(n>0){
    drawRuler(g,845,902,948,712,'内线：许都—官渡', '#6fe0c0', n);
    drawRuler(g,1310,192,1040,420,'外线：邺城—官渡', '#e08a70', n);
  }
}
function actBaima(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,.25);
  drawSiteHalo(g,268,420,48,'rgba(255,170,110,.9)',ap(v,a,.02,.12),v);
  unitTag(g,'颜良围白马',268,360,'#e88e70',{size:19,alpha:ap(v,a,.04,.14)});
  const d=dur(a);
  attackArrow(g,620,367,548,258,{t:v,t0:a.t0+d*.10,t1:a.t0+d*.26,color:'rgba(224,160,96,.85)',width:5,bend:-24,
    dash:[8,9],label:'佯渡延津',labelAt:.55,labelColor:'#e8c98e',labelSize:17,alpha:ap(v,a,.06,.12)});
  attackArrow(g,620,367,336,410,{t:v,t0:a.t0+d*.20,t1:a.t0+d*.38,color:'#66d8b8',width:6,bend:10,
    label:'轻兵袭白马',labelAt:.55,labelColor:'#8ee9cc',labelSize:18,alpha:ap(v,a,.16,.24)});
  checkMark(g,268,478,16,'#6fe0c0',ap(v,a,.40,.48));
  unitTag(g,'关羽 · 阵斩颜良（史实）',330,486,'#8fe6cc',{size:17,alpha:ap(v,a,.40,.5)});
  /* 延津诱敌 */
  const bait=ap(v,a,.48,.62);
  for(let i=0;i<4;i++){
    const p=pointAtPath(PATHS.bait,.22+i*.12);
    baggageCart(g,p[0],p[1],cartAngle(PATHS.bait,.22+i*.12)-PI/2,{scale:.82,alpha:bait});
  }
  unitTag(g,'弃辎重诱敌',548,436,'#e8c98e',{size:17,alpha:bait});
  attackArrow(g,720,408,586,448,{t:v,t0:a.t0+d*.52,t1:a.t0+d*.66,color:'#d06a50',width:5,bend:-12,
    label:'袁军抢辎重',labelAt:.52,labelColor:'#f0a080',labelSize:16,alpha:ap(v,a,.50,.58)});
  attackArrow(g,600,452,740,416,{t:v,t0:a.t0+d*.62,t1:a.t0+d*.76,color:'#66d8b8',width:6,bend:12,
    label:'曹操回头一击',labelAt:.55,labelColor:'#8ee9cc',labelSize:17,alpha:ap(v,a,.60,.68)});
  unitTag(g,'曹操骑 600',664,492,'#8fe6cc',{size:19,alpha:ap(v,a,.58,.68)});
  unitTag(g,'文丑 5600',806,392,'#e88e70',{size:19,alpha:ap(v,a,.58,.68)});
  crossMark(g,818,428,20,'rgba(255,96,72,.92)',ap(v,a,.70,.78));
  stamp(g,'演义移植',374,560,'#ffb45e',ap(v,a,.78,.88));
}
function actSiege(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,.9);
  drawCamps(g,v,1);
  drawForces(g,v,.85);
  const d=dur(a);
  for(let i=0;i<3;i++){
    arrowVolley(g,[1080,436],[870,616],{t:v,t0:a.t0+d*.12+i*.55,dur:.55,stagger:.045,count:16,spread:58,
      color:'rgba(54,42,28,.8)',arc:90,seed:9+i*3,alpha:ap(v,a,.08,.2)});
  }
  drawCatapult(g,782,612,ap(v,a,.30,.46),v);
  earthworks(g,820,676,178,26,{alpha:ap(v,a,.34,.5),label:'长堑',color:'#1f7fd0',labelSize:14});
  /* 韩猛粮车被截 */
  const hp=ap(v,a,.52,.68);
  if(hp>0){
    const p=pointAtPath(PATHS.yuanSupply,.48);
    for(let i=0;i<3;i++)baggageCart(g,p[0]+i*18,p[1]-6+i*4,0,{scale:.76,alpha:hp});
    fireCluster(g,p[0]+18,p[1]-2,52,34,v,hp*.9,{seed:83,alpha:hp});
    smoke(g,p[0]+30,p[1]-24,90,90,v,{alpha:.4*hp,seed:85});
  }
  unitTag(g,'徐晃 · 史涣 截烧韩猛辎重',760,502,'#e8c98e',{size:17,alpha:ap(v,a,.56,.66)});
  drawSiteHalo(g,948,700,58,'rgba(255,214,140,.9)',ap(v,a,.40,.55),v);
  unitTag(g,'十五日',948,760,'#ffcf7a',{size:28,alpha:ap(v,a,.62,.74)});
}
function actChoice(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,.8);
  drawCamps(g,v,.8);
  drawForces(g,v,.7);
  g.fillStyle='rgba(8,10,12,.28)';g.fillRect(-220,-220,W+440,H+440);
}
function actCracks(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,.8);
  drawCamps(g,v,.9);
  drawForces(g,v,.75);
  const d=dur(a);
  routeLine(g,PATHS.xuYou,{alpha:ap(v,a,.24,.38)*.9,color:'rgba(120,230,200,.78)',dash:[6,8],width:3});
  column(g,PATHS.xuYou,{t:v,t0:a.t0+d*.30,t1:a.t0+d*.58,count:1,span:.1,color:'#6fe0c0',type:'cavalry',
    size:.9,seed:91,alpha:ap(v,a,.28,.4)});
  drawSiteHalo(g,570,500,52,'rgba(255,198,118,.95)',ap(v,a,.55,.68),v);
  unitTag(g,'乌巢',570,446,'#ffc878',{size:19,alpha:ap(v,a,.58,.7)});
  unitTag(g,'曹操 · 跣足出迎',726,545,'#8fe6cc',{size:18,alpha:ap(v,a,.62,.76)});
}
function actRaid(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,.35);
  drawCamps(g,v,.5);
  drawForces(g,v,.45);
  const n=ap(v,a,.02,.14);
  nightOverlay(g,n);
  drawNightLights(g,v,n);
  const d=dur(a);
  routeLine(g,PATHS.raid,{alpha:ap(v,a,.10,.24)*.85,color:'rgba(122,224,194,.5)',dash:[6,9],width:2.4});
  column(g,PATHS.raid,{t:v,t0:a.t0+d*.18,t1:a.t0+d*.68,count:30,span:.46,color:'#56d2b2',type:'infantry',
    torches:true,torchEvery:5,fakeFlags:true,flagColor:'#b4553e',size:.96,seed:31,alpha:ap(v,a,.14,.24)});
  unitTag(g,'五千步骑',704,574,'#56d2b2',{size:19,fill:'rgba(12,34,30,.9)',alpha:ap(v,a,.20,.30)});
  routeLine(g,PATHS.fortyLi,{alpha:ap(v,a,.40,.54)*.8,color:'rgba(232,210,160,.6)',dash:[4,7],width:1.6,
    label:'四十里（示意）',labelAt:.5,labelColor:'#e4d0a0',labelSize:17});
  drawSiteHalo(g,570,500,52,'rgba(255,198,118,.95)',ap(v,a,.30,.46),v);
  unitTag(g,'乌巢 · 袁军粮屯',570,448,'#ffc878',{size:18,fill:'rgba(44,26,14,.92)',alpha:ap(v,a,.32,.44)});
}
function actBurn(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,.35);
  drawCamps(g,v,.55);
  drawForces(g,v,.4);
  const night=1-ap(v,a,.0,.22);
  nightOverlay(g,night);
  drawNightLights(g,v,night*.8);
  const d=dur(a);
  const burn=ap(v,a,.04,.22);
  fireCluster(g,574,500,112,82,v,burn,{seed:61,alpha:1});
  smoke(g,612,468,170,180,v,{alpha:.55*burn,seed:63,intensity:1});
  fireGlow(g,574,500,190,v,.45*burn,{color:[255,128,50]});
  unitTag(g,'乌巢 · 粮仓',574,436,'#ffd08a',{size:18,fill:'rgba(40,22,12,.92)',alpha:ap(v,a,.10,.2)});
  column(g,PATHS.relief,{t:v,t0:a.t0+d*.14,t1:a.t0+d*.52,count:16,span:.46,color:'#d06a50',type:'cavalry',
    dust:true,label:'袁绍援骑',size:.9,seed:47,alpha:ap(v,a,.12,.24)});
  attackArrow(g,708,584,622,536,{t:v,t0:a.t0+d*.22,t1:a.t0+d*.40,color:'#7fe3c4',width:6,bend:12,
    label:'先破乌巢',labelAt:.5,labelColor:'#8ee9cc',labelSize:17,alpha:ap(v,a,.20,.3)});
  /* 分兵被否 */
  const no=ap(v,a,.34,.46);
  if(no>0){
    attackArrow(g,704,566,770,502,{t:v,t0:a.t0+d*.30,t1:a.t0+d*.44,color:'rgba(224,138,112,.7)',width:4,
      dash:[7,8],alpha:no});
    crossMark(g,762,506,20,'rgba(255,96,72,.92)',no);
    unitTag(g,'不分兵',764,470,'#ff7a5c',{size:17,alpha:no});
  }
  stamp(g,'断粮',742,646,'#ff6f52',ap(v,a,.70,.82));
}
function actCollapse(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,.4);
  const d=dur(a);
  const flip=smooth((v-(a.t0+d*.62))/(d*.16));
  drawCamps(g,v,.95,flip);
  drawForces(g,v,.55);
  drawNightLights(g,v,.25);
  attackArrow(g,1038,452,652,500,{t:v,t0:a.t0+d*.06,t1:a.t0+d*.22,color:'#d9674a',width:5,bend:-36,
    label:'救乌巢',labelAt:.56,labelColor:'#e88e70',labelSize:18,alpha:ap(v,a,.04,.1)});
  attackArrow(g,1042,486,922,592,{t:v,t0:a.t0+d*.12,t1:a.t0+d*.28,color:'#d9674a',width:5,bend:32,
    label:'攻曹营',labelAt:.55,labelColor:'#e88e70',labelSize:18,alpha:ap(v,a,.10,.16)});
  const xa=ap(v,a,.28,.36);
  if(xa>0){
    crossMark(g,742,498,22,'rgba(255,96,72,.92)',xa);
    unitTag(g,'未采纳',742,548,'#ff7a5c',{size:16,fill:'rgba(46,14,10,.86)',alpha:xa});
    unitTag(g,'曹营未破',1010,612,'#8fe6cc',{size:17,alpha:xa});
  }
  if(flip>.2){
    attackArrow(g,1206,612,986,650,{t:v,t0:a.t0+d*.64,t1:a.t0+d*.78,color:'#66d8b8',width:5,bend:-22,
      label:'降曹',labelAt:.5,labelColor:'#8ee9cc',labelSize:18,alpha:ap(v,a,.62,.7)});
  }
  column(g,PATHS.escape,{t:v,t0:a.t0+d*.76,t1:a.t0+d*.97,count:15,span:.5,color:'#e08363',type:'cavalry',
    dust:true,size:1.05,seed:53,alpha:ap(v,a,.74,.82)});
  unitTag(g,'袁绍 · 八百骑北逃',1268,322,'#e08363',{size:18,fill:'rgba(46,20,14,.9)',alpha:ap(v,a,.78,.86)});
  const ca=ap(v,a,.66,.78);
  if(ca>0){
    dust(g,1080,500,180,110,v,{alpha:.42*ca,seed:71,count:12});
    clash(g,1080,472,42,v,{color:'#ffb45e',alpha:ca});
  }
}
const PROVINCES=[
  {name:'并州',x:1010,y:150,rx:112,ry:78},
  {name:'幽州',x:1470,y:110,rx:132,ry:78},
  {name:'冀州',x:1190,y:300,rx:120,ry:88},
  {name:'青州',x:1580,y:430,rx:112,ry:82},
];
function actAftermath(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,.25);
  drawCamps(g,v,.45);
  drawForces(g,v,.35);
  PROVINCES.forEach((p,i)=>{
    const al=ap(v,a,.08+i*.10,.38+i*.10);
    if(al<=0)return;
    g.save();g.globalAlpha*=al*.30;g.fillStyle='#2f9d88';
    g.beginPath();g.ellipse(p.x,p.y,p.rx,p.ry,0,0,PI*2);g.fill();g.restore();
    unitTag(g,p.name,p.x,p.y,'#8fe6cc',{size:20,alpha:al});
  });
  unitTag(g,'202 袁绍病死',1310,110,'#e08363',{size:19,alpha:ap(v,a,.42,.54)});
  const d=dur(a);
  attackArrow(g,1310,195,1370,90,{t:v,t0:a.t0+d*.46,t1:a.t0+d*.60,color:'rgba(224,131,99,.8)',width:4,bend:-12,
    label:'袁谭',labelAt:.55,labelColor:'#e8a88e',labelSize:16,alpha:ap(v,a,.44,.52)});
  attackArrow(g,1310,195,1240,90,{t:v,t0:a.t0+d*.50,t1:a.t0+d*.64,color:'rgba(224,131,99,.8)',width:4,bend:12,
    label:'袁尚',labelAt:.55,labelColor:'#e8a88e',labelSize:16,alpha:ap(v,a,.48,.56)});
  attackArrow(g,1330,168,1520,52,{t:v,t0:a.t0+d*.66,t1:a.t0+d*.80,color:'#66d8b8',width:5,bend:-18,
    label:'207 北征乌桓',labelAt:.52,labelColor:'#8ee9cc',labelSize:17,alpha:ap(v,a,.64,.72)});
  /* 焚私通书信 */
  const fa=ap(v,a,.60,.74);
  if(fa>0){
    for(let i=0;i<4;i++){
      g.save();g.globalAlpha*=fa;g.translate(860+i*8,880-i*6);g.rotate(-.2+i*.12);
      g.fillStyle='rgba(238,228,200,.9)';g.fillRect(-14,-18,28,36);
      g.strokeStyle='rgba(80,60,40,.7)';g.lineWidth=1;g.strokeRect(-14,-18,28,36);
      g.restore();
    }
    fireGlow(g,876,872,58,v,.7*fa,{color:[255,140,60]});
    unitTag(g,'焚私通书信',900,846,'#ffc878',{size:17,alpha:fa});
  }
}
function actFactors(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,.9);
  drawCamps(g,v,.45);
  drawForces(g,v,.4);
  const n=ap(v,a,.08,.30);
  drawRuler(g,845,902,948,712,'内线：许都—官渡', '#6fe0c0', n);
  drawRuler(g,1310,192,1040,420,'外线：邺城—官渡', '#e08a70', n);
  g.fillStyle='rgba(8,10,12,.22)';g.fillRect(-220,-220,W+440,H+440);
}
function actEnding(g,v,a){
  drawBase(g,v);
  drawSupplyLines(g,v,.4);
  drawCamps(g,v,.4);
  drawForces(g,v,.3);
  g.fillStyle='rgba(8,10,12,.18)';g.fillRect(-220,-220,W+440,H+440);
}

/* ================= 12 幕画面（屏幕层卡片） ================= */
function ledgerCards(g,v,a){
  const al=ap(v,a,.08,.24);
  numberCard(g,1370,206,452,128,'袁绍 · 《三国志》','精卒十万 · 骑万匹','邺城粮道，一车一车往南','#e08a70',al*ap(v,a,.08,.16));
  numberCard(g,96,238,452,128,'曹操 · 《三国志》','兵不满万 · 伤者十二三','后世估两三万，数字有争议','#6fe0c0',al*ap(v,a,.18,.26));
  numberCard(g,96,392,452,116,'一天要吃多少','十几万斤','十万人 · 按每人每天一斤多粗算','#e8c98e',al*ap(v,a,.32,.42));
  numberCard(g,1370,360,452,116,'两条粮道','许都近 · 邺城远','谁先断，谁先崩','#e8c98e',al*ap(v,a,.42,.52));
}
function whyCards(g,v,a){
  const al=ap(v,a,.10,.24);
  if(al<=0)return;
  g.save();g.globalAlpha*=al;
  panel(g,96,220,420,190,'rgba(14,22,20,.86)','rgba(214,184,126,.42)');
  txt(g,'官渡 = 许都北大门',120,260,26,'#f2e6cc',700);
  txt(g,'袁绍绕不开，曹操退不起',120,300,18,'rgba(226,208,174,.86)',500);
  txt(g,'一个近，一个远',120,338,18,'#e8c98e',600);
  txt(g,'后面所有的账都从这里开始',120,372,15,'rgba(210,188,150,.76)',500);
  g.restore();
  const f=ap(v,a,.38,.54);
  if(f>0){
    g.save();g.globalAlpha*=f;
    panel(g,96,470,420,150,'rgba(14,22,20,.86)','rgba(214,184,126,.42)');
    txt(g,'十万人不是一起上',120,510,24,'#f2e6cc',700);
    txt(g,'河沟、沼泽、营垒把正面压窄',120,546,17,'rgba(226,208,174,.86)',500);
    txt(g,'袁绍兵再多，也得排着队上',120,582,17,'#e8c98e',600);
    g.restore();
  }
}
function yuanCards(g,v,a){
  const d=dur(a);
  const t=i=>ap(v,a,.08+i*.14,.12+i*.14);
  const pick=ap(v,a,.58,.68);
  pathCard(g,88,226,392,100,'正面压过去','靠兵力优势碾碎曹操','#e07050',
    pick>.5?'chosen':(t(0)>.5?'active':'idle'),t(0));
  pathCard(g,88,352,392,100,'分兵袭许都','绕开官渡，直插许都','#d9674a',
    t(1)>.5?'active':'idle',t(1));
  pathCard(g,88,478,392,124,'持久消耗','拖到曹操粮尽','#66d8b8',
    t(2)>.5?'active':'idle',t(2));
  const adv=ap(v,a,.50,.62);
  if(adv>0){
    g.save();g.globalAlpha*=adv;
    txt(g,'田丰 · 沮授 · 许攸',108,630,19,'#f0e0c8',700);
    txt(g,'两条路，一条都没走',108,664,16,'rgba(226,208,174,.8)',500);
    g.restore();
  }
  stamp(g,'快胜',520,262,'#ff9a62',ap(v,a,.68,.78));
}
function caoCards(g,v,a){
  const t=i=>ap(v,a,.08+i*.13,.12+i*.13);
  pathCard(g,1436,238,396,96,'退守许都','官渡一丢，许都敞开','#6fe0c0',
    t(0)>.5?'crossed':'idle',t(0));
  pathCard(g,1436,356,396,96,'放弃官渡','曹操粮更少，先崩的可能是他','#6fe0c0',
    t(1)>.5?'crossed':'idle',t(1));
  pathCard(g,1436,474,396,96,'主动决战','兵少，赌不起','#6fe0c0',
    t(2)>.5?'crossed':'idle',t(2));
  pathCard(g,1436,592,396,110,'守官渡','背靠许都，把袁绍拖在窄路上','#6fe0c0',
    'chosen',ap(v,a,.48,.58));
  quotePanel(g,92,244,464,164,'此用奇之时\n不可失也','《三国志 · 荀彧传》',ap(v,a,.52,.64));
  const n=ap(v,a,.66,.78);
  if(n>0){
    g.save();g.globalAlpha*=n;
    panel(g,92,440,464,150,'rgba(14,22,20,.86)','rgba(214,184,126,.42)');
    txt(g,'内线 vs 外线',116,478,23,'#f2e6cc',700);
    line(g,120,528,244,528,'#6fe0c0',5);
    txt(g,'许都—官渡 · 短',252,536,17,'#8fe6cc',600);
    line(g,120,566,420,566,'#e08a70',5);
    txt(g,'邺城—官渡 · 长',120,596,17,'#e8a88e',600);
    g.restore();
  }
}
function baimaCards(g,v,a){
  const al=ap(v,a,.06,.18);
  if(al<=0)return;
  g.save();g.globalAlpha*=al;
  panel(g,96,220,360,120,'rgba(14,22,20,.86)','rgba(214,184,126,.42)');
  txt(g,'白马 · 延津',120,258,26,'#f2e6cc',700);
  txt(g,'两场前哨，曹操都赢了',120,296,17,'rgba(226,208,174,.86)',500);
  txt(g,'但袁绍主力没伤',120,326,16,'#e8c98e',600);
  g.restore();
  quotePanel(g,1420,220,404,146,'六百打五六千\n靠的是对方已经乱了','《资治通鉴》卷六十三',ap(v,a,.56,.68));
}
function siegeCards(g,v,a){
  const al=ap(v,a,.08,.2);
  if(al<=0)return;
  g.save();g.globalAlpha*=al;
  panel(g,96,220,360,150,'rgba(14,22,20,.86)','rgba(214,184,126,.42)');
  txt(g,'袁绍的工程',120,258,24,'#f2e6cc',700);
  txt(g,'土山 · 箭楼 · 地道',120,296,17,'#e88e70',600);
  txt(g,'箭像雨一样落进曹营',120,328,15,'rgba(226,208,174,.8)',500);
  g.restore();
  g.save();g.globalAlpha*=al;
  panel(g,1460,220,364,150,'rgba(14,22,20,.86)','rgba(214,184,126,.42)');
  txt(g,'曹操的接法',1484,258,24,'#f2e6cc',700);
  txt(g,'霹雳车 · 长堑',1484,296,17,'#6fe0c0',600);
  txt(g,'你堆山我砸楼，你挖洞我断道',1484,328,15,'rgba(226,208,174,.8)',500);
  g.restore();
  const c=ap(v,a,.62,.74);
  if(c>0){
    g.save();g.globalAlpha*=c;
    panel(g,760,180,400,104,'rgba(40,20,14,.9)','rgba(255,180,110,.6)');
    txt(g,'再给我十五天',784,222,28,'#ffcf7a',800);
    txt(g,'我替你们破了袁绍',784,258,17,'rgba(244,226,194,.9)',500);
    g.restore();
  }
}
function choiceBoard(g,v,a){
  const al=ap(v,a,.05,.16);
  if(al<=0)return;
  g.save();g.globalAlpha*=al;
  panel(g,96,206,700,330,'rgba(12,18,16,.88)','rgba(224,138,112,.44)');
  txt(g,'袁绍 · 选择多',124,248,28,'#e88e70',800);
  const ys=[['正面碾压','兵多，正面打不会输'],['分兵袭许都','绕开官渡，直插许都'],['重兵护粮','粮道太长，得分兵守']];
  ys.forEach((q,i)=>{
    const y=292+i*72;
    line(g,128,y+14,166,y+14,'#e08a70',4);
    txt(g,q[0],180,y+8,21,'#f0dcc4',700);
    txt(g,q[1],180,y+38,15,'rgba(214,190,160,.75)',500);
  });
  txt(g,'结果：两头都想顾，两头都没顾上',124,510,17,'#ff9a72',600);
  g.restore();
  g.save();g.globalAlpha*=al;
  panel(g,848,206,700,330,'rgba(12,18,16,.88)','rgba(111,224,192,.44)');
  txt(g,'曹操 · 选择少',876,248,28,'#6fe0c0',800);
  txt(g,'守官渡',876,318,26,'#f2e6cc',700);
  txt(g,'→ 赌乌巢',876,362,26,'#f2e6cc',700);
  txt(g,'→ 赌袁绍犯错',876,406,26,'#f2e6cc',700);
  txt(g,'没有退路，只盯一个主目标',876,476,16,'rgba(214,190,160,.8)',500);
  g.restore();
  const ifs=[['如果听田丰','慢慢耗，先断粮的是曹操'],['如果听许攸','分兵袭许，首尾不能相顾'],['如果许攸不反水','乌巢还在，连赌的机会都没有']];
  ifs.forEach((q,i)=>{
    const t=ap(v,a,.40+i*.12,.46+i*.12);
    if(t<=0)return;
    const x=96+i*600;
    g.save();g.globalAlpha*=t;
    panel(g,x,588,560,116,'rgba(18,20,18,.9)','rgba(232,210,160,.4)');
    txt(g,q[0],x+22,626,22,'#ffcf7a',700);
    txt(g,q[1],x+22,662,15,'rgba(226,208,174,.82)',500);
    g.restore();
  });
}
function crackCards(g,v,a){
  const people=[['田丰','劝持久战 · 下狱'],['沮授','谏阻急战 · 不听'],['许攸','家人被审配收系'],['张郃','前线受疑']];
  people.forEach((q,i)=>{
    const t=ap(v,a,.08+i*.12,.16+i*.12);
    if(t<=0)return;
    const dim=ap(v,a,.54+i*.06,.64+i*.06);
    const x=96,y=216+i*112,w=380,h=92;
    g.save();g.globalAlpha*=t*(1-dim*.55);
    panel(g,x,y,w,h,'rgba(14,22,20,.86)','rgba(214,184,126,.4)');
    txt(g,q[0],x+22,y+38,24,'#f2e6cc',700);
    txt(g,q[1],x+22,y+70,15,'rgba(226,208,174,.8)',500);
    if(dim>.4)crossMark(g,x+w-42,y+h/2,18,'rgba(255,104,78,.9)',(dim-.4)/.6);
    g.restore();
  });
  quotePanel(g,1430,238,394,150,'子远来了\n我的事成了','《曹瞒传》裴注',ap(v,a,.58,.70));
  const al=ap(v,a,.72,.82);
  if(al>0){
    g.save();g.globalAlpha*=al;
    panel(g,1430,416,394,120,'rgba(14,22,20,.9)','rgba(255,198,118,.5)');
    txt(g,'许攸带来的不是空话',1454,456,19,'#f2e6cc',700);
    txt(g,'是乌巢：粮仓在哪、谁在守',1454,490,17,'#ffcf7a',600);
    g.restore();
  }
}
function raidLedger(g,v,a){
  const al=ap(v,a,.06,.18);
  if(al<=0)return;
  g.save();g.globalAlpha*=al;
  panel(g,72,214,470,424,'rgba(10,16,14,.9)','rgba(214,184,126,.46)');
  txt(g,'夜袭乌巢 · 风险账',96,256,26,'#f2e6cc',800);
  line(g,96,284,300,284,'rgba(214,184,126,.3)',1);
  txt(g,'去',96,326,24,'#6fe0c0',800);
  txt(g,'五千 对 一万余守军',96,362,17,'#e8d8b8',600);
  txt(g,'袁绍援骑随时会到',96,392,16,'rgba(226,208,174,.8)',500);
  txt(g,'大营空虚，输了就全军完蛋',96,422,16,'rgba(226,208,174,.8)',500);
  line(g,96,458,300,458,'rgba(214,184,126,.3)',1);
  txt(g,'不去',96,500,24,'#e88e70',800);
  txt(g,'继续耗，粮尽也是完蛋',96,536,17,'#e8d8b8',600);
  txt(g,'这不是妙计题',96,586,18,'#ffcf7a',700);
  txt(g,'是怎么死得慢一点的题',96,616,18,'#ffcf7a',700);
  g.restore();
  stamp(g,'赌',420,300,'#ff9a62',ap(v,a,.55,.66));
  const q=ap(v,a,.72,.84);
  if(q>0){
    quotePanel(g,1416,238,408,160,'五千人 · 伪旗号\n四十里夜路','不成，就全军完蛋',q);
  }
}
function burnCards(g,v,a){
  const al=ap(v,a,.10,.22);
  if(al>0){
    quotePanel(g,72,220,472,154,'等他们到了背后再报','曹操 · 《资治通鉴》卷六十三',al);
    g.save();g.globalAlpha*=al;
    panel(g,72,398,472,132,'rgba(14,22,20,.88)','rgba(214,184,126,.42)');
    txt(g,'主目标只有一个',96,438,24,'#f2e6cc',700);
    txt(g,'先砸碎乌巢，援骑到了再说',96,474,16,'rgba(226,208,174,.82)',500);
    txt(g,'一分兵，两头都弱',96,504,16,'#e8c98e',600);
    g.restore();
  }
}
function collapseCards(g,v,a){
  const al=ap(v,a,.06,.18);
  if(al<=0)return;
  g.save();g.globalAlpha*=al;
  panel(g,96,218,380,150,'rgba(14,22,20,.88)','rgba(214,184,126,.42)');
  txt(g,'张郃 / 郭图',120,258,24,'#f2e6cc',700);
  txt(g,'救乌巢 / 攻曹营',120,296,17,'#e88e70',600);
  txt(g,'袁绍听了郭图',120,328,16,'rgba(226,208,174,.82)',500);
  g.restore();
  const note=ap(v,a,.72,.84);
  if(note>0){
    g.save();g.globalAlpha*=note;
    panel(g,1340,700,480,96,'rgba(14,22,20,.9)','rgba(214,184,126,.4)');
    txt(g,'降卒人数',1364,734,17,'#e8d8b8',600);
    txt(g,'史书说法不一，片中用「大批」',1364,762,15,'rgba(214,190,160,.8)',500);
    g.restore();
  }
}
function aftermathCards(g,v,a){
  const al=ap(v,a,.08,.2);
  if(al<=0)return;
  g.save();g.globalAlpha*=al;
  panel(g,96,220,420,196,'rgba(14,22,20,.86)','rgba(214,184,126,.42)');
  txt(g,'官渡之后',120,260,26,'#f2e6cc',700);
  txt(g,'200 官渡 → 202 袁绍病死',120,304,17,'#e8c98e',600);
  txt(g,'→ 袁谭袁尚内斗',120,336,17,'rgba(226,208,174,.82)',500);
  txt(g,'→ 207 北征乌桓',120,368,17,'rgba(226,208,174,.82)',500);
  g.restore();
}
function factorTabs(g,v,a){
  const names=['粮道','情报','内部','战场','决策'];
  const notes=[
    ['韩猛、乌巢','两次被断'],
    ['许攸知道','乌巢虚实'],
    ['田丰沮授许攸张郃','被关被逼走'],
    ['官渡近许都','远邺城'],
    ['五千赌一夜','十万人被牵着走'],
  ];
  const cols=['#e08a70','#ffcf7a','#e88e70','#6fe0c0','#f2e6cc'];
  names.forEach((n,i)=>{
    const t=ap(v,a,.05+i*.10,.12+i*.10);
    if(t<=0)return;
    const x=122+i*342,y=188,w=310,h=132;
    g.save();g.globalAlpha*=t;
    panel(g,x,y,w,h,'rgba(14,22,20,.88)',cols[i]);
    txt(g,n,x+22,y+42,28,cols[i],800);
    txt(g,notes[i][0],x+22,y+80,15,'rgba(226,208,174,.88)',500);
    txt(g,notes[i][1],x+22,y+106,15,'rgba(226,208,174,.88)',500);
    g.restore();
  });
  const ch=ap(v,a,.58,.7);
  if(ch>0){
    const labels=['粮道长','怕断','急','内部压不住','决策慢'];
    g.save();g.globalAlpha*=ch;
    panel(g,122,756,1676,108,'rgba(12,18,16,.9)','rgba(214,184,126,.42)');
    labels.forEach((s,i)=>{
      const x=214+i*336,y=810;
      g.strokeStyle='rgba(232,210,160,.85)';g.lineWidth=2.5;
      g.beginPath();g.arc(x,y,38,0,PI*2);g.stroke();
      txt(g,s,x,y+7,17,'#f2e6cc',700,'center');
      if(i<labels.length-1){
        line(g,x+42,y,x+294,y,'rgba(232,210,160,.7)',3,[6,6]);
        g.fillStyle='rgba(232,210,160,.85)';
        g.beginPath();g.moveTo(x+304,y);g.lineTo(x+292,y-7);g.lineTo(x+292,y+7);g.closePath();g.fill();
      }
    });
    g.restore();
  }
}
function endingCards(g,v,a){
  const al=ap(v,a,.03,.14);
  if(al>0){
    const items=[
      ['七十万大军','正史：精兵十万',true],
      ['关羽斩文丑','正史：文丑死乱军',true],
      ['蒋奇救乌巢','演义加工',true],
      ['淳于琼醉酒','演义加工',true],
      ['许攸献计 · 乌巢烧粮','史实',false],
      ['跣足出迎 · 八百骑北逃','史实',false],
    ];
    items.forEach((q,i)=>{
      const x=i<4?96:1000, y=i<4?210+i*82:210+(i-4)*82;
      const t=ap(v,a,.05+i*.05,.10+i*.05);
      if(t<=0)return;
      g.save();g.globalAlpha*=t*al;
      panel(g,x,y,824,66,'rgba(14,22,20,.86)','rgba(214,184,126,.3)',8);
      txt(g,q[0],x+22,y+42,19,q[2]?'rgba(240,220,190,.92)':'#8fe6cc',600);
      txt(g,q[1],x+560,y+42,15,'rgba(214,190,160,.75)',500);
      if(q[2])crossMark(g,x+780,y+33,16,'rgba(255,104,78,.9)',1);
      else checkMark(g,x+780,y+33,13,'#6fe0c0',1);
      g.restore();
    });
  }
  const coda=ap(v,a,.48,.62);
  if(coda>0){
    /* 赤壁对照：只做意象，不展开成第二张地图 */
    g.save();g.globalAlpha*=coda;
    const gr=g.createLinearGradient(0,H*.54,0,H);
    gr.addColorStop(0,'rgba(8,14,20,0)');gr.addColorStop(.35,'rgba(8,16,22,.72)');gr.addColorStop(1,'rgba(4,8,12,.94)');
    g.fillStyle=gr;g.fillRect(0,H*.50,W,H*.50);
    for(let i=0;i<5;i++){
      const bx=420+i*260,by=900+Math.sin(v*.8+i)*6;
      boat(g,bx,by,-.06+i*.02,1.0,i%2?'#7e4438':'#8f493a',i===2?.9:.3,'');
      if(i!==2)fireGlow(g,bx+20,by-18,70,v,.35,{color:[255,120,50]});
    }
    txt(g,'八年之后 · 赤壁',W/2,806,22,'rgba(236,220,190,.9)',600,'center');
    txt(g,'官渡：2万 胜 10万',W/2-360,982,26,'#6fe0c0',800,'center');
    txt(g,'赤壁：20万 败 5万',W/2+360,982,26,'#e07a5c',800,'center');
    txt(g,'谁的补给线先断，谁的内部先散，谁就先输',W/2,1034,20,'rgba(240,228,200,.9)',600,'center');
    g.restore();
  }
}

/* ================= 总装 ================= */
const WORLD={
  0:actHook,1:actLedger,2:actWhy,3:actYuanRoads,4:actCaoRoads,5:actBaima,
  6:actSiege,7:actChoice,8:actCracks,9:actRaid,10:actBurn,11:actCollapse,
  12:actAftermath,13:actFactors,14:actEnding,
};
function drawWorld(g,v,a){
  const fn=WORLD[a.i]||actHook;
  fn(g,v,a);
}

mount({
  slug:'guandu-full',
  assets:{cao:'/assets/commanders/cao-v2.jpg',yuan:'/assets/commanders/yuan.jpg',
    zhanghe:'/assets/commanders/zhanghe.jpg',xunyu:'/assets/commanders/xunyu.jpg',
    xunyou:'/assets/commanders/xunyou.jpg',xuhuang:'/assets/commanders/xuhuang.jpg',
    caoren:'/assets/commanders/caoren.jpg',
    tianfeng:'/assets/commanders/tianfeng.jpg',shenpei:'/assets/commanders/shenpei.jpg',
    guotu:'/assets/commanders/guotu.jpg'},
  captions:[],
  seconds:600,
  buildTimeline(starts,dur){return {warp:t=>t,filmEnd:dur+TAIL}},
  prepare(api){
    ACTS=api.captions&&api.captions.length
      ? buildActsFromCaptions(api.captions,api.filmEnd)
      : buildActsEstimated();
    if(!ACTS)ACTS=buildActsEstimated();
    FILM=api.filmEnd||600;
    buildShots();
    if(typeof window!=='undefined'&&window.tushuo){
      window.tushuo.filmEnd=ACTS[ACTS.length-1].t1;
      window.tushuo.shots=SHOTS;          /* shots.mjs / probe.mjs 审核用 */
      window.tushuo.camera=cameraFor;     /* 调试：t → [z,cx,cy] */
    }
    PATHS.yuanSupply=buildPath([[1310,195],[1150,238],[1042,282],[986,360],[1014,424],[1058,456]],false,12);
    PATHS.caoSupply=buildPath([[845,902],[858,838],[872,742],[878,664]],false,12);
    PATHS.raid=buildPath([[866,624],[796,592],[724,560],[664,530],[606,504]],false,10);
    PATHS.fortyLi=buildPath([[1046,438],[892,460],[742,480],[612,494]],false,14);
    PATHS.relief=buildPath([[1034,456],[924,448],[812,456],[724,476],[668,494]],false,12);
    PATHS.escape=buildPath([[1160,440],[1190,370],[1228,296],[1258,214],[1280,120]],false,12);
    PATHS.axis=buildPath([[1310,195],[1200,250],[1080,300],[948,360],[760,430],[640,357],[742,458],[852,562],[932,676],[902,802],[850,902]],false,16);
    PATHS.raidXu=buildPath([[1130,500],[1200,650],[1180,800],[1000,880],[870,900]],false,12);
    PATHS.xuYou=buildPath([[1080,540],[1010,570],[950,595],[900,615],[860,630]],false,12);
    PATHS.bait=buildPath([[700,416],[620,428],[540,440],[480,452]],false,10);
    grainTiles=makeGrain();
    buildTerrain(mapCtx,TERRAIN);
  },
  draw(g,{t,v,captions,cover=false}){
    const a=actOf(v);
    const [z,cx,cy]=cameraFor(v);
    CURZ=z;
    g._cmdSeen=new Set();            /* 本帧已出场的主帅，避免同一人两张卡 */
    g.fillStyle='#171310';g.fillRect(0,0,W,H);
    /* 开场镜头地震：0–1.0s 整画面跟着抖（世界/标绘/图例/字幕一起） */
    const hs=hookShake(v);
    g.save();
    if(hs){g.translate(W/2,H/2);g.rotate(hs.rot);g.scale(hs.sc,hs.sc);g.translate(-W/2,-H/2);g.translate(hs.x,hs.y)}
    g.save();
    g.translate(W/2,H/2);g.scale(z,z);g.translate(-cx,-cy);
    drawWorld(g,v,a);
    siteDetail(g,v,z);               /* 近景才补的粮仓/城池/关隘细节 */
    duelBar(g,v,z);                  /* 将官卡：世界坐标钉死在中军帐/营城，随地图缩放不滑动 */
    g.restore();

    lightSweep(g,v);
    whipFX(g,v);
    if(!cover){
      if(a.i===0)bigTitle(g,v);
      banner(g,v,a);
      legend(g,v,a);
      if(a.i===1)ledgerCards(g,v,a);
      if(a.i===2)whyCards(g,v,a);
      if(a.i===3)yuanCards(g,v,a);
      if(a.i===4)caoCards(g,v,a);
      if(a.i===5)baimaCards(g,v,a);
      if(a.i===6)siegeCards(g,v,a);
      if(a.i===7)choiceBoard(g,v,a);
      if(a.i===8)crackCards(g,v,a);
      if(a.i===9)raidLedger(g,v,a);
      if(a.i===10)burnCards(g,v,a);
      if(a.i===11)collapseCards(g,v,a);
      if(a.i===12)aftermathCards(g,v,a);
      if(a.i===13)factorTabs(g,v,a);
      if(a.i===14)endingCards(g,v,a);
      txt(g,'官渡之战 · 相对阵位示意 / 地望有争议 · 未按比例',64,1029,20,'rgba(231,225,196,.73)',500);
      drawCaption(g,t,captions);
    }
    g.restore();
    postFXBase(g,v,grainTiles);
  },
});
