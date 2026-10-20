/* 官渡之战 · 新底图审阅版（guandu2）
   底图：assets/maps/guandu2.png（3840×2160，参考视频和logo/1.png 原图未改色）。
   本版一卡一人：主将、偏将、谋士各占一面小旗，样式取自参考图
   曹操阵营旗帜.png / 袁绍阵营旗帜.png（竖向破风旗、浅色包边、中央旗杆、阵营双色调）。
   主帅卡 320px、留守主将 270px、偏将/谋士 230px；后续渲染靠运镜放大局部。
   阵位依据见 output/guandu-map2/审核/史料依据.md（《三国志》诸传）。
   坐标全部按底图像素书写，P(x,y) 里的 x/y 是底图比例。 */
import {W,H,PI,HEI,txt,mount,makeGrain} from './engine.js';

const MAPW=3840,MAPH=2160;
const FITS=1920/MAPW;                    /* 铺满屏幕时的缩放：1 = 铺满 */
const P=(xp,yp)=>[Math.round(xp*MAPW),Math.round(yp*MAPH)];

/* 底图地理点（缩到 1920 宽逐城核对过） */
const GEO={
  ye:      P(.592,.213),   /* 邺城 */
  huanghe: P(.800,.300),   /* 黄河 */
  baima:   P(.590,.408),   /* 白马 */
  yanjin:  P(.388,.483),   /* 延津 */
  wuchao:  P(.479,.528),   /* 乌巢 */
  guandu:  P(.555,.640),   /* 官渡（底图只标官渡水，点位在渡口） */
  xudu:    P(.380,.787),   /* 许都 */
  yingshui:P(.562,.778),   /* 颍水 */
  weishui: P(.625,.894),   /* 洧水 */
};

/* 两营沿官渡水对垒：袁绍主力在北岸，曹操主力在南岸。 */
const CAMP_Y=P(.555,.567);       /* 袁绍中军 */
const CAMP_C=P(.495,.701);       /* 曹操中军 */

/* 逐人卡：home 是旗杆落点（底图像素），h 是旗卡在底图里的高度。
   同一营内沿东西向一字排开，前后错开半格；主帅居中、卡略大。 */
const CARDS=[
  /* 袁绍军 · 官渡（北岸） */
  {key:'yuan',      side:'yuan', name:'袁绍',   role:'主帅', home:[2131,1230], h:320, leader:true},
  {key:'jushou',    side:'yuan', name:'沮授',   role:'谋士', home:[1816,1200], h:230},
  {key:'zhanghe',   side:'yuan', name:'张郃',   role:'偏将', home:[1924,1200], h:230},
  {key:'gaolan',    side:'yuan', name:'高览',   role:'偏将', home:[2035,1200], h:230},
  {key:'yuantan',   side:'yuan', name:'袁谭',   role:'偏将', home:[2239,1200], h:230},
  {key:'guotu',     side:'yuan', name:'郭图',   role:'谋士', home:[2350,1200], h:230},
  {key:'xuyou',     side:'yuan', name:'许攸',   role:'谋士', home:[2461,1200], h:230},

  /* 曹操军 · 官渡（南岸）：前排主帅与两翼，后排偏将、谋士 */
  {key:'cao',       side:'cao',  name:'曹操',   role:'主帅', home:[1901,1711], h:320, leader:true},
  {key:'caohong',   side:'cao',  name:'曹洪',   role:'偏将', home:[1709,1711], h:230},
  {key:'zhangliao', side:'cao',  name:'张辽',   role:'偏将', home:[2093,1711], h:230},
  {key:'xuhuang',   side:'cao',  name:'徐晃',   role:'偏将', home:[1402,1460], h:230},
  {key:'shihuan',   side:'cao',  name:'史涣',   role:'偏将', home:[1505,1460], h:230},
  {key:'yujin',     side:'cao',  name:'于禁',   role:'偏将', home:[1609,1460], h:230},
  {key:'lejin',     side:'cao',  name:'乐进',   role:'偏将', home:[1716,1460], h:230},
  {key:'caoren',    side:'cao',  name:'曹仁',   role:'偏将', home:[1820,1460], h:230},
  {key:'xunyou',    side:'cao',  name:'荀攸',   role:'谋士', home:[2020,1460], h:230},
  {key:'guojia',    side:'cao',  name:'郭嘉',   role:'谋士', home:[2124,1460], h:230},
  {key:'jiaxu',     side:'cao',  name:'贾诩',   role:'谋士', home:[2231,1460], h:230},
  {key:'xiahouyuan',side:'cao',  name:'夏侯渊', role:'偏将', home:[2335,1460], h:230},
  {key:'xuchu',     side:'cao',  name:'许褚',   role:'偏将', home:[2438,1460], h:230},

  /* 邺城留守（城点以东，避开地名） */
  {key:'fengji',    side:'yuan', name:'逢纪',   role:'谋士', home:[2400,521], h:230},
  {key:'shenpei',   side:'yuan', name:'审配',   role:'留守', home:[2511,521], h:270, warden:true},
  {key:'tianfeng',  side:'grey', name:'田丰',   role:'谋士 · 下狱', home:[2619,521], h:230, dim:true},

  /* 许都留守（城点以西） */
  {key:'xunyu',     side:'cao',  name:'荀彧',   role:'守尚书令', home:[1302,1730], h:270, warden:true},

  /* 外线支点 */
  {key:'yanliang',  side:'yuan', name:'颜良',   role:'围白马', home:[2266,851],  h:230},
  {key:'wenchou',   side:'yuan', name:'文丑',   role:'延津',   home:[1440,1020], h:230},
  {key:'liu',       side:'yuan', name:'刘备',   role:'客将',   home:[1551,1030], h:230},
  {key:'chunyuqiong',side:'yuan',name:'淳于琼', role:'护粮',   home:[1839,980], h:230},
];

/* 按旗杆落点从北到南排绘制顺序，前排压后排 */
const CARDS_ORDER=CARDS.slice().sort((a,b)=>a.home[1]-b.home[1]||a.home[0]-b.home[0]);

const CARD_ASSETS={};
for(const c of CARDS)CARD_ASSETS[c.key]=`/assets/banner-cards/${c.key}.png`;

const CARD_W_RATIO=480/720;      /* 卡图宽高比 */
const CARD_ANCHOR_Y=700/720;     /* 旗杆落点在卡图里的纵向位置 */

const SIDE_COL={
  yuan:{glow:'70,104,158',label:'#9fb8df'},
  cao: {glow:'170,64,64', label:'#e0a08a'},
  grey:{glow:'130,126,118',label:'#c8c2b6'},
};

/* 官渡水前线的实际河道（底图比例，按放大截图取点） */
const FRONT=[[.400,.598],[.445,.610],[.490,.626],[.535,.638],[.580,.646],[.620,.650]]
  .map(([x,y])=>P(x,y));

/* 审阅机位：全图 → 邺城留守 → 袁绍营 → 外线三支点 → 曹操营 → 许都 → 全图 */
const CAM_KEYS=[
  {t: 0,c:[.500,.500],zoom:1.00},
  {t:10,c:[.640,.205],zoom:2.75},
  {t:20,c:[.556,.537],zoom:2.55},
  {t:30,c:[.483,.470],zoom:2.75},
  {t:40,c:[.495,.740],zoom:2.60},
  {t:48,c:[.355,.800],zoom:2.80},
  {t:56,c:[.500,.500],zoom:1.00},
  {t:60,c:[.500,.500],zoom:1.00},
];
const TRANS=2.4;

const qs=u=>{u=Math.max(0,Math.min(1,u));return u*u*u*(u*(u*6-15)+10)};
function clampCam(z,cx,cy){
  const hw=W/2/z,hh=H/2/z;
  cx=MAPW<=hw*2?MAPW/2:Math.min(MAPW-hw,Math.max(hw,cx));
  cy=MAPH<=hh*2?MAPH/2:Math.min(MAPH-hh,Math.max(hh,cy));
  return [z,cx,cy];
}
function cameraAt(v){
  let i=0;
  while(i<CAM_KEYS.length-1&&v>=CAM_KEYS[i+1].t)i++;
  const a=CAM_KEYS[i],b=CAM_KEYS[i+1];
  const hold=z=>z*Math.exp(.004*Math.min(Math.max(0,v-a.t),10));
  if(b&&v>=b.t-TRANS){
    const u=qs((v-(b.t-TRANS))/TRANS);
    const z0=hold(a.zoom)*FITS,z1=b.zoom*FITS;
    return clampCam(Math.exp(Math.log(z0)+(Math.log(z1)-Math.log(z0))*u),
      a.c[0]*MAPW+(b.c[0]-a.c[0])*MAPW*u,
      a.c[1]*MAPH+(b.c[1]-a.c[1])*MAPH*u);
  }
  return clampCam(hold(a.zoom)*FITS,a.c[0]*MAPW,a.c[1]*MAPH);
}

let IMG=null,grain=null;
function toScreen(cam,x,y){
  return [(x-cam[1])*cam[0]+W/2,(y-cam[2])*cam[0]+H/2];
}

function campGlow(g,side,cx,cy,z,t){
  const col=side==='yuan'?'70,104,158':'170,64,64';
  const pu=.5+.5*Math.sin(t*1.4+(side==='cao'?2.1:0));
  const r=430;
  const gr=g.createRadialGradient(cx,cy,r*.15,cx,cy,r);
  gr.addColorStop(0,`rgba(${col},${.15+.03*pu})`);
  gr.addColorStop(.62,`rgba(${col},.06)`);
  gr.addColorStop(1,`rgba(${col},0)`);
  g.fillStyle=gr;
  g.beginPath();g.ellipse(cx,cy,r,r*.62,0,0,PI*2);g.fill();
}

function frontLine(g,cam,t){
  const [z]=cam;
  g.save();
  g.lineCap='round';g.lineJoin='round';
  g.beginPath();
  for(let i=0;i<FRONT.length;i++){
    const [x,y]=FRONT[i];
    if(i===0)g.moveTo(x,y);
    else{
      const [px,py]=FRONT[i-1];
      g.quadraticCurveTo(px,py,(px+x)/2,(py+y)/2);
    }
  }
  const last=FRONT[FRONT.length-1];g.lineTo(last[0],last[1]);
  g.strokeStyle='rgba(255,214,140,.16)';g.lineWidth=13/z;g.stroke();
  g.setLineDash([16/z,12/z]);g.lineDashOffset=-(t*30)%(28/z);
  g.strokeStyle='rgba(255,223,158,.62)';g.lineWidth=2.6/z;g.stroke();
  g.restore();
}

/* 对垒轴：袁绍中军—官渡渡口—曹操中军，在渡口折一下 */
function axisLine(g,cam,t){
  const [z]=cam;
  const [yx,yy]=CAMP_Y,[cx,cy]=CAMP_C,[gx,gy]=GEO.guandu;
  g.save();
  g.setLineDash([13/z,11/z]);g.lineDashOffset=-(t*22)%(24/z);
  g.strokeStyle='rgba(255,226,150,.38)';g.lineWidth=2.4/z;
  g.beginPath();g.moveTo(yx,yy);g.lineTo(gx,gy);g.lineTo(cx,cy);g.stroke();
  g.setLineDash([]);
  const pu=.5+.5*Math.sin(t*2.4);
  g.strokeStyle=`rgba(255,220,140,${.32+.2*pu})`;g.lineWidth=2/z;
  g.beginPath();g.arc(gx,gy,10*pu+12,0,PI*2);g.stroke();
  g.restore();
}

/* 单张人物旗卡：PNG 自带旗形、包边、旗杆和姓名牌 */
function drawCard(g,cam,c,t){
  const img=IMG&&IMG[c.key];
  if(!img)return;
  const [z]=cam;
  const [sx,sy]=toScreen(cam,c.home[0],c.home[1]);
  const hpx=c.h*z,wpx=hpx*CARD_W_RATIO;
  const x0=sx-wpx/2,x1=sx+wpx/2,y0=sy-hpx*CARD_ANCHOR_Y,y1=y0+hpx;
  if(x1<-60||x0>W+60||y1<0||y0>H+60)return;
  /* 靠近屏幕边缘时渐隐，避免旗卡被生硬切掉 */
  const ov=Math.max(-x0,x1-W,-y0,y1-H);
  const alpha=Math.max(0,Math.min(1,1-Math.max(0,ov)/48));
  if(alpha<=0)return;
  const col=SIDE_COL[c.side]||SIDE_COL.grey;
  g.save();
  g.globalAlpha=alpha;

  /* 旗杆落地影 */
  g.fillStyle='rgba(0,0,0,.33)';
  g.beginPath();g.ellipse(sx,sy+3,19*z,5.5*z,0,0,PI*2);g.fill();

  /* 主帅卡外光晕 */
  if(c.leader){
    const pu=.5+.5*Math.sin(t*2.2+(c.side==='cao'?1.7:0));
    const gr=g.createRadialGradient(sx,sy-hpx*.5,Math.min(wpx,hpx)*.25,sx,sy-hpx*.5,Math.max(wpx,hpx)*.7);
    gr.addColorStop(0,`rgba(${col.glow},${.16+.05*pu})`);
    gr.addColorStop(1,`rgba(${col.glow},0)`);
    g.fillStyle=gr;
    g.beginPath();g.ellipse(sx,sy-hpx*.5,wpx*.95,hpx*.55,0,0,PI*2);g.fill();
  }

  g.drawImage(img,x0,y0,wpx,hpx);
  g.restore();
}

function guanduMark(g,cam,t){
  const [sx,sy]=toScreen(cam,GEO.guandu[0],GEO.guandu[1]);
  g.save();
  const pu=.5+.5*Math.sin(t*2.4);
  g.strokeStyle=`rgba(255,220,140,${.55+.3*pu})`;g.lineWidth=2.5;
  g.beginPath();g.arc(sx,sy,7+2*pu,0,PI*2);g.stroke();
  g.fillStyle='rgba(255,236,190,.95)';
  g.beginPath();g.arc(sx,sy,3.4,0,PI*2);g.fill();
  /* 名牌放在渡口右下方空档：四周都有旗卡，连线会压姓名牌，故不画引线 */
  const lx=sx+80,ly=sy+150,pw=122,ph=58;
  g.fillStyle='rgba(18,14,10,.9)';
  g.beginPath();g.roundRect(lx-pw/2,ly-ph/2,pw,ph,9);g.fill();
  g.strokeStyle='rgba(255,214,140,.85)';g.lineWidth=1.3;g.stroke();
  g.textAlign='center';g.textBaseline='middle';
  g.font=`700 24px ${HEI}`;g.fillStyle='#ffe6b8';
  g.fillText('官渡',lx,ly-9);
  g.font=`500 13px ${HEI}`;g.fillStyle='rgba(255,230,184,.76)';
  g.fillText('两军相持',lx,ly+15);
  g.restore();
}

/* 左上势力图例；卡片本身不再写阵营，靠旗色区分 */
function legend(g){
  g.save();
  g.fillStyle='rgba(14,12,9,.70)';
  g.beginPath();g.roundRect(48,44,322,92,12);g.fill();
  g.strokeStyle='rgba(226,196,138,.42)';g.lineWidth=1.2;g.stroke();
  g.fillStyle='#76242e';g.fillRect(66,62,24,24);
  g.strokeStyle='rgba(233,227,220,.7)';g.lineWidth=1;g.strokeRect(66,62,24,24);
  g.fillStyle='#212f48';g.fillRect(66,94,24,24);
  g.strokeRect(66,94,24,24);
  g.textAlign='left';g.textBaseline='middle';
  g.font=`600 16px ${HEI}`;g.fillStyle='#efe3c8';
  g.fillText('曹操军',102,74);
  g.fillText('袁绍军',102,106);
  g.font=`500 12px ${HEI}`;g.fillStyle='rgba(233,225,204,.62)';
  g.fillText('每卡一人 · 主帅卡略大 · 未按比例',164,74);
  g.fillText('暗红 / 藏青为阵营色',164,106);
  g.restore();
}

mount({
  slug:'guandu-map2',
  assets:Object.assign({map:'/assets/maps/guandu2.png'},CARD_ASSETS),
  captions:[],
  seconds:60,
  buildTimeline(starts,d){return {warp:t=>t,filmEnd:d+3.6}},
  prepare(api){
    IMG=api.images||{};
    grain=makeGrain();
    if(typeof window!=='undefined'&&window.tushuo){
      window.tushuo.camera=cameraAt;
      window.tushuo.plan=CAM_KEYS;
      window.tushuo.cards=CARDS;
      window.tushuo.images=IMG;
    }
  },
  draw(g,{t,v}){
    const cam=cameraAt(v);
    const [z,cx,cy]=cam;
    g.fillStyle='#12100c';g.fillRect(0,0,W,H);

    g.save();
    g.translate(W/2,H/2);g.scale(z,z);g.translate(-cx,-cy);
    const m=IMG&&IMG.map;
    if(m)g.drawImage(m,0,0,MAPW,MAPH);
    else{g.fillStyle='#efe6cf';g.fillRect(0,0,MAPW,MAPH)}
    campGlow(g,'yuan',CAMP_Y[0],CAMP_Y[1],z,t);
    campGlow(g,'cao',CAMP_C[0],CAMP_C[1],z,t);
    frontLine(g,cam,t);
    axisLine(g,cam,t);
    g.restore();

    /* 轻暗角 */
    const vg=g.createRadialGradient(W/2,H/2,H*.55,W/2,H/2,H*1.12);
    vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(10,8,4,.22)');
    g.fillStyle=vg;g.fillRect(0,0,W,H);
    if(grain){
      g.save();g.globalAlpha=.045;g.globalCompositeOperation='overlay';
      const idx=Math.floor(t*30)%3;
      for(let x=0;x<W;x+=480)for(let y=0;y<H;y+=270)g.drawImage(grain[idx],x,y);
      g.restore();
    }

    for(const c of CARDS_ORDER)drawCard(g,cam,c,t);
    guanduMark(g,cam,t);
    legend(g);

    txt(g,'官渡之战 · 建安五年开局阵位 · 一卡一人 · 主帅卡略大 · 未按比例',64,1029,18,'rgba(231,225,196,.7)',500);
    txt(g,'随军与留守依《三国志》诸传；缺人物图者以剪影占位并标「缺图」',64,1053,13,'rgba(231,225,196,.5)',400);
  },
});
