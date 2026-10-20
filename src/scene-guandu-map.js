/* 官渡之战 · 古地图底图版（map 管线）
   —— 底图直接使用 assets/maps/guandu-ink.jpg（5404×3040）。
   规则：主帅卡常亮、副将排在主将身后、全部固定在底图地理位置上；
        口播点名谁，谁的卡才平滑移动到“发言位”，说完回位；镜头丝滑缓推缓移。 */
import {W,H,PI,HEI,txt,drawCaption,mount,postFXBase,makeGrain} from './engine.js';

const MAPW=5404,MAPH=3040;
const FITS=1920/MAPW;                 /* 底图铺满时的缩放 */

/* 底图上的地理坐标（按参考图比例换算到 5404×3040） */
const P=(xp,yp)=>[Math.round(xp*MAPW),Math.round(yp*MAPH)];
const GEO={
  ye:      P(.520,.136),   /* 邺城 */
  huanghe: P(.780,.250),
  baima:   P(.608,.371),
  yanjin:  P(.400,.461),
  wuchao:  P(.480,.521),
  guandu:  P(.317,.566),
  zhongmou:P(.407,.644),
  xudu:    P(.346,.833),
  yingshui:P(.570,.700),
  weishui: P(.630,.880),
};
/* 卡挂在城的上方，避免压住城名/城门 */
const UP=300;

/* 袁绍卡贴「邺城」名右侧；郭图/审配/田丰三卡在邺城内等距铺开 */
const YECARD=[3140,362];
const YEDEP=[[2920,585],[3180,585],[3440,585]];

/* 主将 / 副将：主将固定在自己的城，副将按指定阵位排布 */
const HERO=[
  {k:'yuan',   n:'袁绍',home:YECARD,      r:56,side:'yuan',main:true},
  {k:'guotu',  n:'郭图',home:YEDEP[0],    r:30,side:'yuan',behind:'yuan'},
  {k:'shenpei',n:'审配',home:YEDEP[1],    r:28,side:'yuan',behind:'yuan'},
  {k:'tianfeng',n:'田丰',home:YEDEP[2],   r:28,side:'yuan',behind:'yuan'},

  {k:'cao',    n:'曹操',home:[GEO.xudu[0],GEO.xudu[1]-UP],   r:56,side:'cao',main:true},
  {k:'xunyu',  n:'荀彧',home:[GEO.xudu[0]-240,GEO.xudu[1]-UP+235],r:26,side:'cao',behind:'cao'},
  {k:'xunyou', n:'荀攸',home:[GEO.xudu[0],GEO.xudu[1]-UP+235],r:26,side:'cao',behind:'cao'},
  {k:'caoren', n:'曹仁',home:[GEO.xudu[0]+240,GEO.xudu[1]-UP+235],r:26,side:'cao',behind:'cao'},

  {k:'zhanghe',n:'张郃',home:[GEO.wuchao[0]+150,GEO.wuchao[1]-UP+40],r:32,side:'yuan'},
  {k:'xuhuang',n:'徐晃',home:[GEO.guandu[0]+150,GEO.guandu[1]-UP+40],r:30,side:'cao'},
  {k:'yanliang',n:'颜良',home:[GEO.baima[0],GEO.baima[1]-UP+40],r:34,side:'yuan'},
  {k:'wenchou',n:'文丑',home:[GEO.yanjin[0],GEO.yanjin[1]-UP+40],r:34,side:'yuan'},
];
const CLR={yuan:'#e0351f',cao:'#1f7fd0'};

let CAPS=[],SHOTS=[],FILM=600,grain=null,IMG=null,CURZ=1;
const ST={};   /* key -> {x,y,s,a} 当前屏幕态 */

function readLine(t0){
  const hit=[];
  for(const f of HERO) if(t0.includes(f.n)) hit.push(f);
  let fac=null;
  if(hit.length) fac=hit[0].side;
  else if(/袁|河北|邺城|十万|精兵|粮草|乌巢/.test(t0)) fac='yuan';
  else if(/曹操|许都|官渡|兵不满|一万|粮/.test(t0)) fac='cao';
  return {hit,fac};
}
function buildShots(caps){
  const out=[];
  for(const [t0,t1,text] of caps){
    const {hit,fac}=readLine(text);
    let cx=MAPW/2,cy=MAPH/2,z=FITS*1.02;
    if(hit.length){
      const h=hit[0];
      cx=h.home[0];cy=h.home[1];
      z=FITS*(h.main?2.4:2.9);
    }else if(fac==='yuan'){cx=GEO.ye[0];cy=GEO.ye[1]+240;z=FITS*1.5}
    else if(fac==='cao'){cx=GEO.xudu[0];cy=GEO.xudu[1]-120;z=FITS*1.55}
    else{
      for(const [n,p] of Object.entries(GEO)) if(text.includes(n)){cx=p[0];cy=p[1];z=FITS*1.6;break}
    }
    out.push({t0,t1,cx,cy,z,hit,fac});
  }
  return out;
}
function shotAt(v){
  if(!SHOTS.length)return {t0:0,t1:600,cx:MAPW/2,cy:MAPH/2,z:FITS,hit:[],fac:null};
  let k=0;while(k<SHOTS.length-1&&v>=SHOTS[k].t1)k++;
  return SHOTS[k];
}
/* 电影分镜：开场 20 秒沿用已审定的 7 拍；其后按全片叙事节点挂机位。
   每次缓推/缓移 1.6–3.4 秒，句间保持并 1.2%/s 极缓推进，全程连续无硬切。 */
const CAO_P=[GEO.xudu[0],GEO.xudu[1]-UP];
const YUAN_P=[YECARD[0],YECARD[1]];
const YUANR_P=[GEO.ye[0],GEO.ye[1]+240];
const WIDE_P=[MAPW/2,MAPH/2];
const CINE_KEYS=[
  {key:'曹操两万人',          pos:CAO_P,  zoom:2.45, mf:0,    mt:0},
  {key:'凭什么打赢袁绍十万',   pos:WIDE_P, zoom:1.05, mf:1.00, mt:3.60},
  {key:'曹操兵不满万',        pos:CAO_P,  zoom:2.05, mf:4.30, mt:6.50},
  {key:'对面袁绍',            pos:YUAN_P, zoom:2.05, mf:7.20, mt:10.80},
  {key:'背后是富庶的河北四州',  pos:YUANR_P,zoom:1.55, mf:10.80,mt:12.40},
  {key:'袁绍只带八百骑兵逃回河北',pos:YUANR_P,zoom:1.70,mf:12.60,mt:14.20},
  {key:'曹操一举定了北方',      pos:WIDE_P, zoom:1.05, mf:14.60,mt:17.20},
];

/* 全片机位锚点（底图坐标 5404×3040） */
const GD_P=GEO.guandu, XD_P=GEO.xudu, WC_P=GEO.wuchao, BM_P=GEO.baima, YJ_P=GEO.yanjin;
const CENT_P=[2300,1700];      /* 两军之间的中间地带 */
const NORTH_P=[2820,950];      /* 黄河北岸、袁绍后方 */
const SUP_Y=[2480,1450];       /* 袁绍粮道：邺城→官渡 */
const SUP_X=[1800,2150];       /* 曹操粮道：许都→官渡 */
const CARD_CAO=CAO_P, CARD_YUAN=YUAN_P;
const CARD_YANLIANG=[GEO.baima[0],GEO.baima[1]-UP+40];
const CARD_WENCHOU=[GEO.yanjin[0],GEO.yanjin[1]-UP+40];
const CARD_ZHANGHE=[GEO.wuchao[0]+150,GEO.wuchao[1]-UP+40];
const CARD_XUHUANG=[GEO.guandu[0]+150,GEO.guandu[1]-UP+40];
const CARD_GUOTU=YEDEP[0], CARD_SHENPEI=YEDEP[1], CARD_TIANFENG=YEDEP[2];
const CARD_XUNYU=[GEO.xudu[0]-240,GEO.xudu[1]-UP+235];

/* 全片叙事机位：key 为口播句精确文本（先精确匹配，再前缀匹配） */
const FULL_BEATS=[
  /* 一 · 兵力账与粮道 */
  {key:'先算账',pos:SUP_Y,zoom:1.50},
  {key:'精卒十万',pos:YUANR_P,zoom:1.75},
  {key:'史书说他兵不满万',pos:CARD_CAO,zoom:2.30},
  {key:'实际大概两三万人',pos:CARD_CAO,zoom:2.45},
  {key:'十万人一天吃多少',pos:SUP_Y,zoom:1.50},
  {key:'十天就是上百万斤',pos:WIDE_P,zoom:1.08},
  {key:'得从邺城一车一车往南拉',pos:[2700,1050],zoom:1.50},
  {key:'曹操的粮从许都往北送',pos:SUP_X,zoom:1.75},
  {key:'十比一只是纸面',pos:CENT_P,zoom:1.35},
  {key:'越怕人掐',pos:[2550,1250],zoom:1.65},
  /* 二 · 为什么撞在官渡 */
  {key:'曹操把汉献帝接到许都',pos:XD_P,zoom:2.00},
  {key:'袁绍刚吞并冀',pos:YUANR_P,zoom:1.70},
  {key:'袁绍从邺城南下来',pos:NORTH_P,zoom:1.65},
  {key:'黄河横在北边',pos:[2700,900],zoom:1.50},
  {key:'官渡在黄河以南',pos:GD_P,zoom:1.90},
  {key:'曹操要保许都',pos:SUP_X,zoom:1.70},
  {key:'所以官渡不是随便选的一块地',pos:GD_P,zoom:2.10},
  {key:'一个近',pos:SUP_X,zoom:1.80},
  {key:'十万人不是十万人一起上',pos:CENT_P,zoom:1.40},
  {key:'沼泽和营垒',pos:GD_P,zoom:2.20},
  {key:'袁绍兵再多',pos:CENT_P,zoom:1.50},
  /* 三 · 袁绍的选择 */
  {key:'站在袁绍的位置上',pos:CARD_YUAN,zoom:2.05},
  {key:'第二条',pos:[2500,1200],zoom:1.35},
  {key:'第三条',pos:CARD_YUAN,zoom:1.90},
  {key:'田丰主张第三条',pos:CARD_TIANFENG,zoom:2.60},
  {key:'许攸更直接',pos:YUANR_P,zoom:1.80},
  {key:'说许都一破',pos:XD_P,zoom:1.90},
  {key:'袁绍一条都没听',pos:CARD_YUAN,zoom:2.05},
  {key:'他兵多粮足',pos:NORTH_P,zoom:1.60},
  {key:'他需要一场快胜',pos:CENT_P,zoom:1.40},
  {key:'田丰看出来的',pos:CARD_TIANFENG,zoom:2.60},
  {key:'袁绍手里明明有一张慢慢赢的牌',pos:CARD_YUAN,zoom:2.00},
  {key:'十万人的优势',pos:CENT_P,zoom:1.40},
  {key:'被他押在了最不需要人多的打法上',pos:GD_P,zoom:1.75},
  /* 四 · 曹操只能守 */
  {key:'再看曹操',pos:CARD_CAO,zoom:2.10},
  {key:'退守许都',pos:XD_P,zoom:1.90},
  {key:'拉长袁绍的粮道',pos:[2400,1550],zoom:1.45},
  {key:'主动决战',pos:GD_P,zoom:1.90},
  {key:'所以他只能守官渡',pos:GD_P,zoom:2.05},
  {key:'曹操写信给荀彧',pos:CARD_CAO,zoom:2.20},
  {key:'荀彧回信的意思就一句',pos:CARD_XUNYU,zoom:2.60},
  {key:'曹操的底牌',pos:CARD_CAO,zoom:2.25},
  {key:'袁绍在外线',pos:YUANR_P,zoom:1.60},
  {key:'这封信没给曹操一兵一粮',pos:[1750,2250],zoom:1.85},
  {key:'退是死',pos:GD_P,zoom:2.00},
  {key:'后来曹操所有的冒险',pos:CENT_P,zoom:1.35},
  /* 五 · 白马 · 延津 */
  {key:'先看白马',pos:BM_P,zoom:2.15},
  {key:'袁绍派颜良围白马',pos:CARD_YANLIANG,zoom:2.50},
  {key:'自己轻兵急袭白马',pos:BM_P,zoom:2.25},
  {key:'被关羽在阵中斩杀',pos:CARD_YANLIANG,zoom:2.60},
  {key:'袁绍兵多',pos:[2900,900],zoom:1.60},
  {key:'紧接着延津',pos:YJ_P,zoom:2.10},
  {key:'曹操故意把辎重丢在路上',pos:YJ_P,zoom:1.90},
  {key:'队形一乱',pos:[2200,1300],zoom:1.75},
  {key:'当时曹操的骑兵不满六百',pos:CARD_WENCHOU,zoom:2.50},
  {key:'六百打五六千',pos:YJ_P,zoom:1.90},
  {key:'文丑就死在这片乱军里',pos:CARD_WENCHOU,zoom:2.60},
  {key:'两场前哨',pos:[2600,1250],zoom:1.45},
  {key:'可赢的都是边角',pos:CENT_P,zoom:1.35},
  {key:'曹操还是兵少粮少',pos:CARD_CAO,zoom:1.95},
  {key:'只能往官渡缩',pos:GD_P,zoom:1.80},
  /* 六 · 官渡对峙 · 工程战 */
  {key:'堆土山',pos:GD_P,zoom:2.10},
  {key:'袁军的箭像雨一样落进曹营',pos:GD_P,zoom:2.25},
  {key:'是造霹雳车',pos:GD_P,zoom:2.10},
  {key:'两边就这么耗着',pos:GD_P,zoom:1.80},
  {key:'中间还有一段插曲',pos:[2400,1700],zoom:1.45},
  {key:'派徐晃',pos:CARD_XUHUANG,zoom:2.50},
  {key:'把辎重烧了',pos:[2400,1600],zoom:1.60},
  {key:'可先撑不住的还是曹操',pos:CARD_CAO,zoom:2.00},
  {key:'曹操见到运粮的人',pos:CARD_CAO,zoom:2.30},
  {key:'我替你们破了袁绍',pos:CARD_CAO,zoom:2.45},
  {key:'他知道自己拖不起',pos:GD_P,zoom:2.00},
  /* 七 · 选择与三个如果 */
  {key:'把双方摆在一块儿看',pos:WIDE_P,zoom:1.10},
  {key:'袁绍每一步都有更好的选择',pos:CARD_YUAN,zoom:1.90},
  {key:'个不那么坏的',pos:CARD_CAO,zoom:1.90},
  {key:'可以分兵袭许都',pos:XD_P,zoom:1.80},
  {key:'曹操只能守官渡',pos:GD_P,zoom:1.90},
  {key:'赌乌巢',pos:WC_P,zoom:2.00},
  {key:'选择多不一定是好事',pos:WIDE_P,zoom:1.20},
  {key:'曹营也没打下来',pos:GD_P,zoom:2.00},
  {key:'反而成了',pos:WC_P,zoom:2.10},
  {key:'反过来想三个如果',pos:WIDE_P,zoom:1.25},
  {key:'慢慢耗',pos:CARD_YUAN,zoom:1.80},
  {key:'分兵袭许都',pos:XD_P,zoom:1.80},
  {key:'乌巢还在',pos:WC_P,zoom:2.00},
  {key:'官渡可能就是另一个结局',pos:WIDE_P,zoom:1.10},
  {key:'就得把一件事做到底',pos:GD_P,zoom:1.90},
  /* 八 · 袁绍内部的裂缝 */
  {key:'袁绍那边的裂缝',pos:CARD_YUAN,zoom:2.00},
  {key:'田丰劝他打持久战',pos:CARD_TIANFENG,zoom:2.60},
  {key:'沮授劝他别急着决战',pos:CARD_YUAN,zoom:2.10},
  {key:'田丰在狱里说',pos:CARD_TIANFENG,zoom:2.60},
  {key:'真正要命的是许攸',pos:YUANR_P,zoom:1.85},
  {key:'被审配抓起来',pos:CARD_SHENPEI,zoom:2.60},
  {key:'曹操听说许攸来了',pos:CARD_CAO,zoom:2.30},
  {key:'演义只是放大了',pos:CARD_CAO,zoom:2.00},
  {key:'是乌巢',pos:WC_P,zoom:2.05},
  {key:'到这一步',pos:WC_P,zoom:1.90},
  /* 九 · 乌巢定计 · 夜袭 */
  {key:'许攸说',pos:WC_P,zoom:1.95},
  {key:'只要一支轻兵连夜偷袭',pos:[2150,1650],zoom:1.75},
  {key:'你替曹操算一下这笔账',pos:WC_P,zoom:1.90},
  {key:'五千人',pos:GD_P,zoom:1.90},
  {key:'还要防袁绍的援骑',pos:WC_P,zoom:2.00},
  {key:'继续耗',pos:GD_P,zoom:1.95},
  {key:'曹操选了去',pos:WC_P,zoom:2.00},
  {key:'十万人守着',pos:[2750,1150],zoom:1.65},
  {key:'打乌巢',pos:WC_P,zoom:2.10},
  {key:'曹操挑的不是最痛的地方',pos:WC_P,zoom:1.90},
  {key:'他留曹洪',pos:GD_P,zoom:1.90},
  {key:'自己带五千步骑',pos:[2150,1650],zoom:1.70},
  {key:'走小路奔乌巢',pos:WC_P,zoom:2.00},
  {key:'乌巢离袁绍大营四十里',pos:[2450,1450],zoom:1.50},
  {key:'一路混了过去',pos:WC_P,zoom:2.05},
  {key:'这三个数摆在一起',pos:CENT_P,zoom:1.35},
  {key:'你就知道这仗赌得多大',pos:WIDE_P,zoom:1.10},
  /* 十 · 火烧乌巢 */
  {key:'曹操的五千人到了乌巢',pos:WC_P,zoom:2.05},
  {key:'淳于琼看见曹军人少',pos:WC_P,zoom:2.15},
  {key:'曹操急击',pos:WC_P,zoom:2.30},
  {key:'曹操就围上去放火',pos:WC_P,zoom:2.10},
  {key:'袁绍一看粮仓起火',pos:NORTH_P,zoom:1.60},
  {key:'敌骑快到了',pos:WC_P,zoom:2.00},
  {key:'等他们到了背后再报',pos:WC_P,zoom:2.20},
  {key:'先打下乌巢',pos:WC_P,zoom:2.30},
  {key:'两头都弱',pos:WC_P,zoom:1.90},
  {key:'曹操的算法很简单',pos:WC_P,zoom:2.00},
  {key:'淳于琼的营破了',pos:WC_P,zoom:2.20},
  {key:'粮草烧成一片火海',pos:WC_P,zoom:2.05},
  {key:'袁绍的十万大军',pos:[2750,1150],zoom:1.50},
  /* 十一 · 前线崩塌 · 袁绍北逃 */
  {key:'袁军前线立刻炸锅',pos:GD_P,zoom:1.90},
  {key:'郭图却劝袁绍直接攻曹营',pos:CARD_GUOTU,zoom:2.50},
  {key:'袁绍听了郭图的',pos:CARD_YUAN,zoom:2.00},
  {key:'结果曹营没攻下来',pos:GD_P,zoom:2.00},
  {key:'袁绍这一步的算盘',pos:[2700,1150],zoom:1.60},
  {key:'可这个算盘有个前提',pos:GD_P,zoom:1.90},
  {key:'曹洪守得硬',pos:GD_P,zoom:2.00},
  {key:'高览一合计',pos:CARD_ZHANGHE,zoom:2.50},
  {key:'烧了攻具',pos:[2100,1900],zoom:1.55},
  {key:'曹操得到这两员大将',pos:CARD_CAO,zoom:2.10},
  {key:'前线一降',pos:GD_P,zoom:1.80},
  {key:'袁绍连甲都没披',pos:[2900,900],zoom:1.65},
  {key:'剩下的大批降卒被曹操坑杀',pos:[2350,1600],zoom:1.40},
  {key:'你看',pos:WIDE_P,zoom:1.10},
  {key:'袁绍不是没兵',pos:YUANR_P,zoom:1.60},
  {key:'处理内部也慢',pos:[3000,950],zoom:1.55},
  /* 十二 · 战后 · 统一北方 */
  {key:'袁绍逃回河北',pos:CARD_YUAN,zoom:1.85},
  {key:'两年后病死',pos:CARD_YUAN,zoom:1.95},
  {key:'曹操坐收渔利',pos:CARD_CAO,zoom:1.90},
  {key:'到建安十二年',pos:CENT_P,zoom:1.35},
  {key:'曹操北征乌桓',pos:[2800,700],zoom:1.45},
  {key:'官渡这一仗',pos:GD_P,zoom:1.85},
  {key:'战后他还做了一件事',pos:CARD_CAO,zoom:2.10},
  {key:'把部下私通袁绍的信全烧了',pos:CARD_CAO,zoom:2.25},
  {key:'你把这几年连起来看',pos:WIDE_P,zoom:1.10},
  {key:'它把袁绍的内部问题全放大了',pos:YUANR_P,zoom:1.60},
  {key:'儿子接着斗',pos:CARD_YUAN,zoom:1.80},
  {key:'曹操赢的不只是战场',pos:CARD_CAO,zoom:1.90},
  /* 十三 · 五条胜负账 */
  {key:'那曹操到底赢在哪',pos:WIDE_P,zoom:1.15},
  {key:'粮道',pos:[2450,1450],zoom:1.45},
  {key:'点多',pos:YUANR_P,zoom:1.70},
  {key:'曹操背靠许都',pos:XD_P,zoom:1.85},
  {key:'而且曹操不是只赢了一次',pos:[2100,1800],zoom:1.55},
  {key:'第二',pos:WC_P,zoom:1.90},
  {key:'许攸知道乌巢虚实',pos:WC_P,zoom:2.00},
  {key:'第三',pos:YUANR_P,zoom:1.80},
  {key:'袁绍手下田丰',pos:[3300,585],zoom:2.00},
  {key:'曹操这边荀彧',pos:XD_P,zoom:1.80},
  {key:'第四',pos:GD_P,zoom:1.90},
  {key:'曹操把战场选在官渡',pos:GD_P,zoom:1.95},
  {key:'粮道越长',pos:[2450,1450],zoom:1.40},
  {key:'这叫内线打外线',pos:WIDE_P,zoom:1.10},
  {key:'第五',pos:CARD_CAO,zoom:2.00},
  {key:'曹操敢拿五千人赌一夜',pos:GD_P,zoom:1.90},
  {key:'却一步步被牵着走',pos:CARD_YUAN,zoom:2.00},
  {key:'任何一步错都是死',pos:CARD_CAO,zoom:2.10},
  {key:'错一步还有本钱',pos:YUANR_P,zoom:1.70},
  {key:'本钱再厚也经不起',pos:CARD_YUAN,zoom:1.70},
  {key:'你把这五条摆在一起',pos:WIDE_P,zoom:1.15},
  {key:'粮道长',pos:[2450,1450],zoom:1.40},
  {key:'内部就压不住',pos:YUANR_P,zoom:1.85},
  {key:'袁绍不是输在某一个瞬间',pos:CARD_YUAN,zoom:1.90},
  {key:'是输在这条链子上',pos:WIDE_P,zoom:1.10},
  /* 十四 · 演义与真事 · 收束 */
  {key:'这里得把演义和真事分开',pos:[2800,1150],zoom:1.45},
  {key:'演义里袁绍七十万大军',pos:YUANR_P,zoom:1.70},
  {key:'正史是精兵十万',pos:CARD_YUAN,zoom:2.00},
  {key:'关羽斩文丑',pos:CARD_WENCHOU,zoom:2.50},
  {key:'许攸献计',pos:WC_P,zoom:2.00},
  {key:'曹操光脚迎许攸也见于史书',pos:CARD_CAO,zoom:2.20},
  {key:'但蒋奇救乌巢',pos:WC_P,zoom:1.90},
  {key:'袁绍手里的兵不少',pos:YUANR_P,zoom:1.60},
  {key:'官渡的胜负',pos:GD_P,zoom:1.90},
  {key:'在情报',pos:WC_P,zoom:1.90},
  {key:'最后说个对照',pos:WIDE_P,zoom:1.12},
  {key:'赤壁江上',pos:WIDE_P,zoom:1.10},
  {key:'同一个人',pos:CARD_CAO,zoom:1.90},
  {key:'输赢的逻辑没变',pos:[2350,1600],zoom:1.40},
  {key:'谁的内部先散',pos:CARD_YUAN,zoom:1.75},
  {key:'官渡不是曹操的运气',pos:GD_P,zoom:1.90},
  {key:'是他把袁绍的软肋一条条算准了',pos:WIDE_P,zoom:1.18},
  {key:'分清演义和真事',pos:WIDE_P,zoom:1.08},
  {key:'咱们接着往下看',pos:WIDE_P,zoom:1.02},
];

let PLAN=[];
function buildPlan(caps){
  PLAN=[];
  for(const k of CINE_KEYS){
    const line=caps.find(c=>String(c[2]).startsWith(k.key));
    if(!line)continue;
    PLAN.push({t:line[0],x:k.pos[0],y:k.pos[1],z:FITS*k.zoom,mf:k.mf,mt:k.mt});
  }
  if(!PLAN.length)PLAN=[{t:0,x:MAPW/2,y:MAPH/2,z:FITS,mf:0,mt:0}];
  let prevMt=PLAN[PLAN.length-1].mt||0;
  /* 先按口播时间排序，再按 2 秒最小间距合并，保证每段缓动不互相覆盖 */
  const hit=[];
  for(const b of FULL_BEATS){
    const line=caps.find(c=>String(c[2])===b.key)||caps.find(c=>String(c[2]).startsWith(b.key));
    if(!line){console.warn('机位关键词未命中：',b.key);continue}
    hit.push({t:line[0],x:b.pos[0],y:b.pos[1],z:FITS*b.zoom});
  }
  hit.sort((a,b)=>a.t-b.t);
  const beats=[];
  for(const b of hit){
    /* 两句挨得太近时保留后一句：它多半才是新场景的落点，
       否则会留下一条从上一场景斜穿全图的超长运镜。 */
    if(beats.length&&b.t-beats[beats.length-1].t<2.0)beats[beats.length-1]=b;
    else beats.push(b);
  }
  for(let i=0;i<beats.length;i++){
    const b=beats[i],next=beats[i+1];
    const gap=next?next.t-b.t:4;
    const prev=PLAN[PLAN.length-1];
    const dist=Math.hypot((b.x-prev.x)*b.z,(b.y-prev.y)*b.z)
      +Math.abs(Math.log(b.z/prev.z))*Math.hypot(W/2,H/2);
    /* 位移越大给的时间越长，峰值速度压住；再受下一机位时间约束 */
    const dur=Math.min(3.8,Math.max(1.6,gap*0.45,dist/1000));
    /* 提前起镜：口播点到名字时镜头已基本到位（与开场审定的提前量同口径） */
    const mf=Math.max(b.t-dur*0.65,prevMt+0.4);
    const mt=Math.min(mf+dur,next?next.t-0.4:mf+dur);
    if(mt-mf<1.0)continue;
    PLAN.push({t:b.t,x:b.x,y:b.y,z:b.z,mf,mt});
    prevMt=mt;
  }
}
const qs=u=>{u=Math.max(0,Math.min(1,u));return u*u*u*(u*(u*6-15)+10)};
function lerpCam(A,B,f){
  return {x:A.x+(B.x-A.x)*f,y:A.y+(B.y-A.y)*f,
    z:Math.exp(Math.log(A.z)+(Math.log(B.z)-Math.log(A.z))*f)};
}
function holdCam(b,v){
  const t0=Math.max(b.t,b.mt||0);
  return {x:b.x,y:b.y,z:b.z*Math.exp(.012*Math.max(0,v-t0))};
}
function clampCam(z,cx,cy){
  const hw=W/2/z, hh=H/2/z;
  cx=MAPW<=hw*2?MAPW/2:Math.min(MAPW-hw,Math.max(hw,cx));
  cy=MAPH<=hh*2?MAPH/2:Math.min(MAPH-hh,Math.max(hh,cy));
  return [z,cx,cy];
}
function cameraAt(v){
  if(!PLAN.length)return [FITS,MAPW/2,MAPH/2];
  for(let j=1;j<PLAN.length;j++){
    const b=PLAN[j];
    if(v>=b.mf&&v<=b.mt){
      const A=holdCam(PLAN[j-1],b.mf),B={x:b.x,y:b.y,z:b.z};
      const u=(v-b.mf)/Math.max(.001,b.mt-b.mf);
      if(b.via){
        const M={x:(A.x+B.x)/2,y:(A.y+B.y)/2,z:FITS*1.15};
        return u<.5
          ? (s=>clampCam(s.z,s.x,s.y))(lerpCam(A,M,qs(u*2)))
          : (s=>clampCam(s.z,s.x,s.y))(lerpCam(M,B,qs((u-.5)*2)));
      }
      const s=lerpCam(A,B,qs(u));
      return clampCam(s.z,s.x,s.y);
    }
  }
  let i=0;while(i<PLAN.length-1&&v>=PLAN[i+1].t)i++;
  const s=holdCam(PLAN[i],v);
  return clampCam(s.z,s.x,s.y);
}

function cards(g,v,cur,cam){
  const z=cam.z,scale=z/FITS;      /* 1 = 铺满；>1 = 推近 */
  for(const f of HERO){
    const on=cur.hit.includes(f)||(!cur.hit.length&&cur.fac===f.side&&f.main);
    const s=ST[f.k]||(ST[f.k]={x:f.home[0],y:f.home[1],k:1});
    /* 发言位：向镜头中心挪 8%，并放大 18% */
    const tx=on?f.home[0]+(cam.cx-f.home[0])*0.08:f.home[0];
    const ty=on?f.home[1]+(cam.cy-f.home[1])*0.08:f.home[1];
    s.x+=(tx-s.x)*0.12; s.y+=(ty-s.y)*0.12;
    s.k+=((on?1.18:1)-s.k)*0.12;
    const px=(s.x-cam.cx)*z+W/2, py=(s.y-cam.cy)*z+H/2;
    const rr=f.r*s.k*Math.min(2.2,Math.max(.72,Math.pow(scale,.55)));
    if(px<-200||px>W+200||py<-220||py>H+220)continue;
    /* 常亮：不降透明度 */
    g.save();
    g.shadowColor='rgba(12,10,6,.45)';g.shadowBlur=18;
    g.fillStyle='#f7efdc';g.beginPath();g.arc(px,py,rr+4,0,PI*2);g.fill();
    g.shadowBlur=0;
    const img=IMG&&IMG[f.k];
    if(img){g.save();g.beginPath();g.arc(px,py,rr,0,PI*2);g.clip();
      g.drawImage(img,0,0,img.width,img.height,px-rr,py-rr,rr*2,rr*2);g.restore();}
    g.strokeStyle=CLR[f.side];g.lineWidth=on?6:4;
    g.beginPath();g.arc(px,py,rr+2,0,PI*2);g.stroke();
    if(on){g.strokeStyle='rgba(255,226,138,.95)';g.lineWidth=3;
      g.beginPath();g.arc(px,py,rr+8,0,PI*2);g.stroke();}
    /* 名牌：紧贴下沿、常亮 */
    g.font=`700 ${Math.max(14,Math.round(rr*.52))}px ${HEI}`;
    g.textAlign='center';g.textBaseline='middle';
    const tw=g.measureText(f.n).width+18,th=Math.round(rr*.62);
    g.fillStyle='rgba(10,24,28,.95)';
    g.beginPath();g.roundRect(px-tw/2,py+rr+3,tw,th,6);g.fill();
    g.fillStyle='#dcf3ff';g.fillText(f.n,px,py+rr+3+th*.52);
    g.restore();
  }
}

mount({
  slug:'guandu-map',
  assets:{map:'/assets/maps/guandu-ink.jpg',
    cao:'/assets/commanders/cao-v2.jpg',yuan:'/assets/commanders/yuan.jpg',
    zhanghe:'/assets/commanders/zhanghe.jpg',xunyu:'/assets/commanders/xunyu.jpg',
    xunyou:'/assets/commanders/xunyou.jpg',xuhuang:'/assets/commanders/xuhuang.jpg',
    caoren:'/assets/commanders/caoren.jpg',tianfeng:'/assets/commanders/tianfeng.jpg',
    shenpei:'/assets/commanders/shenpei.jpg',guotu:'/assets/commanders/guotu.jpg',
    yanliang:'/assets/commanders/yanliang.jpg',wenchou:'/assets/commanders/wenchou.jpg'},
  captions:[],
  seconds:669.14,
  buildTimeline(starts,d){return {warp:t=>t,filmEnd:d+3.6}},
  prepare(api){
    CAPS=api.captions||[];
    FILM=api.filmEnd||600;
    SHOTS=buildShots(CAPS);
    buildPlan(CAPS);
    IMG=api.images||{};
    grain=makeGrain();
    if(typeof window!=='undefined'&&window.tushuo){
      window.tushuo.camera=cameraAt;
      window.tushuo.lines=SHOTS.length;
      window.tushuo.plan=PLAN;
    }
  },
  draw(g,{t,v,captions}){
    const [z,cx,cy]=cameraAt(v);
    CURZ=z;
    const cur=shotAt(v);
    g.fillStyle='#12100c';g.fillRect(0,0,W,H);
    /* 开场 1 秒画面抖动：振幅衰减到 0；11/7.3Hz 在 24fps 下不会混叠成静止 */
    const shaking=v<1;
    if(shaking){
      const a=14*Math.pow(1-v,1.6);
      g.save();g.translate(Math.sin(v*PI*2*11)*a,Math.cos(v*PI*2*7.3)*a*.75);
    }
    const m=IMG&&IMG.map;
    g.save();
    g.translate(W/2,H/2);g.scale(z,z);g.translate(-cx,-cy);
    if(m)g.drawImage(m,0,0,MAPW,MAPH);
    else{g.fillStyle='#efe6cf';g.fillRect(0,0,MAPW,MAPH)}
    g.restore();
    /* 轻压暗角（不做影院黑边） */
    const vg2=g.createRadialGradient(W/2,H/2,H*.55,W/2,H/2,H*1.12);
    vg2.addColorStop(0,'rgba(0,0,0,0)');vg2.addColorStop(1,'rgba(10,8,4,.22)');
    g.fillStyle=vg2;g.fillRect(0,0,W,H);
    if(grain){g.save();g.globalAlpha=.05;g.globalCompositeOperation='overlay';
      const idx=Math.floor(t*30)%3;
      for(let x=0;x<W;x+=480)for(let y=0;y<H;y+=270)g.drawImage(grain[idx],x,y);
      g.restore();}
    cards(g,v,cur,{z,cx,cy});             /* 卡画在最后：始终常亮，不被压暗 */
    drawCaption(g,t,captions);
    if(shaking)g.restore();
  },
});
