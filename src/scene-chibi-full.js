/* tushuo · 赤壁之战（完整版 · 约 5 分 08 秒）
   13 段分镜：钩子 / 兵力账 / 怎么碰上的 / 对峙与初战 / 曹军软肋 / 黄盖献计 /
   火船与风 / 点火与撞阵 / 火烧连营 / 溃退与华容道 / 真正败因 / 战后格局 / 结尾与演义对照。
   段落边界由字幕字符位置推出（ACT_OFFSETS），稿子改动后画面跟着走，不必重排时码。
   坐标分两层：贴地图的船/阵/箭头走世界层（随相机），卡片/大字/字幕走屏幕层。
   底图改成古地图（绢帛/水墨）基调，曹、孙、刘三方势力范围常驻分色；运镜按镜头表
   （SHOT_DEFS）在每个节拍快推到说话的一方，再在两军之间来回切。 */
import {W,H,PI,off,SONG,HEI,smooth,range,fade,line,txt,song,pill,arrow,top,bottom,
  map as mapCtx,paintBase,drawTexture,CITIES,
  makeCurrents,drawCurrents,circlePortrait,boat,pennant,
  makeGrain,makeEmbers,drawEmbers,postFXBase,drawCaption,mount} from './engine.js';

const assets={huanggai:'/assets/commanders/huanggai.jpg',sunquan:'/assets/commanders/sunquan.jpg',zhouyu:'/assets/commanders/zhouyu-v2.jpg',cao:'/assets/commanders/cao-v2.jpg',liu:'/assets/commanders/liu.jpg',caoren:'/assets/commanders/caoren.jpg',chengpu:'/assets/commanders/chengpu.jpg',handang:'/assets/commanders/handang.jpg',zhoutai:'/assets/commanders/zhoutai.jpg',ganning:'/assets/commanders/ganning.jpg',taishici:'/assets/commanders/taishici.jpg',lingtong:'/assets/commanders/lingtong.jpg',lvmeng:'/assets/commanders/lvmeng.jpg',liuxun:'/assets/commanders/liuxun.jpg',xualan:'/assets/brand/xualan.jpg'};
/* 主帅卡姓名对照（旗列/卡片标签用） */
const CMD_NAMES={zhouyu:'周瑜',sunquan:'孙权',cao:'曹操',liu:'刘备',huanggai:'黄盖',caoren:'曹仁',chengpu:'程普',handang:'韩当',zhoutai:'周泰',ganning:'甘宁',taishici:'太史慈',lingtong:'凌统',lvmeng:'吕蒙',liuxun:'刘勋'};

/* 13 段在「去标点正文」里的累计字符位置（由 口播稿.txt 按对齐器同一套去标点口径算出，末尾为总字数） */
const ACT_OFFSETS=[0,110,239,392,508,636,738,841,967,1099,1233,1344,1413,1661];
const ACT_KEYS=['曹操有二十万，为什么打不过五万人','兵力账','荆州 · 孙刘联盟','南北对峙','曹军的软肋','黄盖献计','火船与东南风','点火 · 撞阵','火烧连营','溃退 · 华容道','真正败因','三分天下','演义与真事'];
const HOOK='曹操有二十万，为什么打不过五万人';

/* ================= 段落边界：按字幕累计字符切 13 段 ================= */
function lineIndexAt(caps,offset){
  let pos=0;
  for(let i=0;i<caps.length;i++){const len=caps[i][2].length;if(offset<pos+len)return i;pos+=len}
  return Math.max(0,caps.length-1);
}
function buildActs(caps,filmEnd){
  if(!caps.length)return null;
  const acts=[];
  for(let k=0;k<ACT_OFFSETS.length-1;k++){
    const i0=lineIndexAt(caps,ACT_OFFSETS[k]);
    const i1=Math.max(i0,lineIndexAt(caps,ACT_OFFSETS[k+1])-1);
    acts.push({t0:i0===0?0:caps[i0][0],t1:caps[i1][1]});
  }
  acts[12].t1=Math.max(acts[12].t0+1,filmEnd);
  for(let k=0;k<13;k++){
    if(k>0&&acts[k].t0<acts[k-1].t0)acts[k].t0=acts[k-1].t0;
    if(acts[k].t1<=acts[k].t0)acts[k].t1=acts[k].t0+1;
  }
  return acts;
}
const TAIL=3.6;               /* 配音结束(308.3s)后留给片尾品牌卡的时长 */
let ACTS=null,FILM=311.9,HOOK_END=3.0;
function actOf(t){
  if(!ACTS)return {i:0,t0:0,t1:FILM};
  let k=0;while(k<12&&t>=ACTS[k].t1)k++;
  return {i:k,t0:ACTS[k].t0,t1:ACTS[k].t1};
}

/* ================= 屏幕层画面件 ================= */
function panel(g,x,y,w,h,fill='rgba(26,20,15,.93)',stroke='rgba(214,184,126,.55)',r=16){
  g.save();g.fillStyle=fill;g.beginPath();g.roundRect(x,y,w,h,r);g.fill();
  if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke()}g.restore();
}
function bannerKey(g,text,a){
  if(a<=0)return;g.save();g.globalAlpha=a;g.font=`800 54px ${SONG}`;
  const w=g.measureText(text).width+150,cx=960,cy=150;
  const gr=g.createLinearGradient(cx-w/2,0,cx+w/2,0);
  gr.addColorStop(0,'rgba(22,16,11,0)');gr.addColorStop(.18,'rgba(22,16,11,.9)');gr.addColorStop(.82,'rgba(22,16,11,.9)');gr.addColorStop(1,'rgba(22,16,11,0)');
  g.fillStyle=gr;g.fillRect(cx-w/2,cy-46,w,92);
  g.textAlign='center';g.textBaseline='middle';g.fillStyle='#f6efdc';g.shadowColor='rgba(0,0,0,.6)';g.shadowBlur=14;g.fillText(text,cx,cy+2);
  g.shadowBlur=0;g.fillStyle='rgba(226,176,102,.95)';g.fillRect(cx-w/2+26,cy+34,60,4);g.fillRect(cx+w/2-86,cy+34,60,4);
  g.restore();
}
/* 开场钩子大字：砸上去的暴力抖动——逐字错位＋红青重影＋频闪配色，
   整画面同时镜头地震（hookShake）。抖动严格 1 秒：与配音第一句、
   score.json 的 1.0s 落定闷击同拍，之后画面完全恢复稳定。 */
function bigTitle(g,text,a,y=470,size=104,t=0){
  if(a<=0)return;
  /* 抖动包络：0.08 秒拉到满幅，0.55s 起收敛，1.0 秒完全停 */
  const amp=Math.max(0,Math.min(1,range(t,0,.08)*(1-range(t,.55,1.0))));
  /* 落锤回弹：0→0.32s 从 1.45 倍纵向砸回 1.0（横向只微收，防出画） */
  const popY=1+(1-range(t,0,.32))*.45,popX=1+(1-range(t,0,.32))*.06;
  const J=(f,ph)=>Math.sin(t*f+ph);
  g.save();
  g.translate(W/2,y);
  g.globalAlpha=a;
  /* 自动适配：宋体实测宽约 1.0em/字，按 1400px 上限缩字号，
     给镜头地震的过缩放（1.08）与逐字抖动/重影留足边距，不出画 */
  g.font=`800 ${size}px ${SONG}`;
  const fit=Math.min(1,1400/g.measureText(text).width);
  size=Math.round(size*fit);
  g.font=`800 ${size}px ${SONG}`;
  g.textAlign='center';g.textBaseline='middle';
  g.scale(popX,popY);
  const chars=[...text];
  const widths=chars.map(c=>g.measureText(c).width);
  const total=widths.reduce((s,w)=>s+w,0);
  let xx=-total/2;
  const cells=chars.map((c,i)=>{const w=widths[i];const cell={c,x:xx+w/2};xx+=w;return cell});
  const drawChars=(dx,fill,stroke,glow,flick)=>{
    cells.forEach((cell,i)=>{
      const ph=i*2.399;
      const jcx=J(211.0,ph)*11*amp+J(97.0,ph*1.7)*5*amp;
      const jcy=J(193.0,ph*1.3)*7*amp+J(61.0,ph)*3*amp;
      const jr=J(167.0,ph*.7)*.05*amp;
      g.save();
      g.translate(cell.x+jcx+dx,jcy);
      g.rotate(jr);
      g.lineJoin='round';g.lineWidth=9;g.strokeStyle=stroke;g.strokeText(cell.c,0,0);
      if(glow){g.shadowColor=glow;g.shadowBlur=20}
      g.fillStyle=flick&&i%2===Math.floor(t*24)%2?'#ffb45e':fill;
      g.fillText(cell.c,0,0);
      g.shadowBlur=0;
      g.restore();
    });
  };
  /* 红青重影：峰期向两侧撕开（RGB 分离感） */
  if(amp>.12){
    const spl=5+11*amp;
    g.globalAlpha=a*amp*.5;drawChars(-spl,'#ff5a2e','rgba(40,6,2,.4)','rgba(255,90,46,.8)',false);
    g.globalAlpha=a*amp*.5;drawChars(spl,'#57e0ff','rgba(2,20,28,.4)','rgba(87,224,255,.8)',false);
    g.globalAlpha=a;
  }
  drawChars(0,'#fff4de','rgba(6,14,16,.85)','rgba(0,0,0,.75)',true);
  g.restore();
  /* 砸字瞬间从字后迸出的放射线（16 条，峰期更亮） */
  if(amp>.3){
    const k=1-(t-.08)/0.85;if(k>0){g.save();g.globalAlpha=a*k*.9;
      for(let i=0;i<16;i++){const ang=i*Math.PI/8+.19;
        line(g,W/2+Math.cos(ang)*250,y+Math.sin(ang)*100,W/2+Math.cos(ang)*(250+240*k),y+Math.sin(ang)*(100+96*k),'rgba(255,196,120,.9)',5)}
      g.restore()}
  }
  /* 冲击波环：从字心炸开 */
  const ring=1-range(t,.04,.62);
  if(ring>0){g.save();g.globalAlpha=a*ring*.85;g.strokeStyle='rgba(255,214,150,.95)';g.lineWidth=4+12*ring;
    g.beginPath();g.arc(W/2,y,120+(1-ring)*1350,0,2*PI);g.stroke();g.restore()}
}
/* 开场镜头地震：0–1.0s 整画面位移＋旋转＋过缩放（防露边），1 秒后归位 */
function hookShake(v){
  if(v>=1.0)return null;
  const amp=Math.max(0,Math.min(1,range(v,0,.05)*(1-range(v,.55,1.0))));
  if(amp<=0)return null;
  const x=Math.sin(v*173.0)*30*amp+Math.sin(v*97.0)*14*amp;
  const y=Math.cos(v*191.0)*18*amp+Math.sin(v*71.0)*9*amp;
  const rot=Math.sin(v*127.0)*.014*amp;
  return {x,y,rot,sc:1+.08*amp};
}
function letter(g,x,y,w,h,title,lines,seal,tilt=-.05){
  g.save();g.translate(x,y);g.rotate(tilt);
  g.shadowColor='rgba(0,0,0,.55)';g.shadowBlur=30;
  g.fillStyle='#e6d5ac';g.beginPath();g.roundRect(-w/2,-h/2,w,h,13);g.fill();g.shadowBlur=0;
  g.strokeStyle='#8d6d45';g.lineWidth=2;g.strokeRect(-w/2+20,-h/2+20,w-40,h-40);
  song(g,title,0,-h/2+72,50,'#4a3624',1,'center');
  line(g,-w/2+70,-h/2+118,w/2-70,-h/2+118,'#9f895f',2);
  lines.forEach((s,i)=>song(g,s,0,-h/2+182+i*60,36,'#513c29',1,'center'));
  txt(g,'（史书节意，非原文）',0,h/2-46,20,'#74634e',400,'center');
  if(seal){g.fillStyle='#a94732';g.beginPath();g.arc(w/2-110,h/2-96,38,0,2*PI);g.fill();song(g,seal,w/2-110,h/2-96,32,'#e9d0a4',1,'center')}
  g.restore();
}
/* ============ 机动系统：单位沿代码定义的路径平滑移动 ============
   路径 = 世界坐标关键点数组 pathAt(pts, i)（Catmull-Rom 平滑，单位沿弧长匀速）。
   unitAt(path,t,t0,t1,offset,ease) 返回 {x,y,ang,scale}，offset 让多个单位错峰。 */
function catmull(p0,p1,p2,p3,u){
  const u2=u*u,u3=u2*u;
  return [0.5*((2*p1[0])+(-p0[0]+p2[0])*u+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*u2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*u3),
          0.5*((2*p1[1])+(-p0[1]+p2[1])*u+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*u2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*u3)];
}
function pathAt(pts,i){
  const n=pts.length;
  const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[Math.min(n-1,i+1)],p3=pts[Math.min(n-1,i+2)];
  const out=[];const steps=14;
  for(let s=0;s<=steps;s++){const u=s/steps;out.push(catmull(p0,p1,p2,p3,u))}
  return out;
}
/* 预采样整条路径为等距弧长序列（每段末点与下一段首点重合，去掉免重复） */
function buildPath(pts){
  const dense=[];
  for(let i=0;i<pts.length-1;i++)dense.push(...pathAt(pts,i).slice(0,-1));
  dense.push(pts[pts.length-1]);
  const segs=[];let total=0;
  for(let i=1;i<dense.length;i++){
    const dx=dense[i][0]-dense[i-1][0],dy=dense[i][1]-dense[i-1][1];
    const d=Math.hypot(dx,dy);segs.push(d);total+=d;
  }
  let acc=0;const cum=segs.map(d=>(acc+=d)/total);
  return {pts:dense,cum,total:total||1};
}
function unitAt(path,t,t0,t1,offset=0,ease=smooth){
  const q=(path&&path.total)?Math.max(0,Math.min(1,(t-t0)/Math.max(.2,t1-t0))):0;
  const u=ease(q);
  /* offset 为进度比例错峰（如 i*.055＝滞后 5.5% 路程），不再按窗口时长缩放 */
  const d=Math.max(0,Math.min(.999,u+offset));
  let i=0;while(i<path.cum.length-1&&path.cum[i]<d)i++;
  const a=path.pts[i],b=path.pts[i+1]||path.pts[i];
  const c0=path.cum[i-1]||0,c1=path.cum[i]||1;
  const f=c1>c0?Math.max(0,Math.min(1,(d-c0)/(c1-c0))):0;   /* 段内线性插值：避开密集采样点的跳踱 */
  const ang=Math.atan2(b[1]-a[1],b[0]-a[0]);
  return {x:a[0]+(b[0]-a[0])*f,y:a[1]+(b[1]-a[1])*f,ang,scale:1,q:u};
}
/* ============ 态势标绘：攻击箭头 / 交战区闪烁 / 防线高亮 ============ */
/* 攻击箭头：沿直线流动的虚线 + 箭头，周期性推进，指哪打哪 */
function attackArrow(g,x1,y1,x2,y2,t,color='rgba(240,150,110,.95)',speed=120,width=7){
  const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
  const hx=x2-ux*26,hy=y2-uy*26;                       /* 箭头尖端后退一点的杆身末端 */
  g.save();
  g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';
  g.beginPath();g.moveTo(x1,y1);g.lineTo(hx,hy);g.stroke();
  g.beginPath();g.moveTo(x2,y2);g.lineTo(x2-ux*34+uy*22,y2-uy*34-ux*22);g.lineTo(x2-ux*34-uy*22,y2-uy*34+ux*22);g.closePath();
  g.fillStyle=color;g.fill();
  const dash=24,gap=46,ph=(t*speed)%(dash+gap);
  g.setLineDash([dash,gap]);g.lineDashOffset=-ph;
  g.strokeStyle='rgba(255,246,214,.9)';g.lineWidth=2.5;
  g.beginPath();g.moveTo(x1+ux*10,y1+uy*10);g.lineTo(hx,hy);g.stroke();
  g.restore();
}
/* 交战区：椭圆范围闪烁（外圈脉冲 + 内部冲突火花），饱和度和频率随强度 scale */
function battleZone(g,x,y,rx,ry,t,intensity=1,color='rgba(255,150,90,'){
  const p=.5+.5*Math.sin(t*7.5),p2=.5+.5*Math.sin(t*13+1.7);
  g.save();
  g.globalAlpha=Math.min(1,intensity)*(.28+.42*p);
  g.fillStyle='rgba(196,86,58,.55)';g.beginPath();g.ellipse(x,y,rx,ry,0,0,PI*2);g.fill();
  g.globalAlpha=Math.min(1,intensity)*(.5+.5*p);
  g.strokeStyle='rgba(255,226,180,.95)';g.lineWidth=4;g.setLineDash([16,12]);g.lineDashOffset=-t*40;
  g.beginPath();g.ellipse(x,y,rx*(.9+.1*p),ry*(.9+.1*p),0,0,PI*2);g.stroke();g.setLineDash([]);
  for(let i=0;i<5;i++){
    const a=i*1.3+t*2.1,rr=.42+.3*((Math.sin(t*9+i*2)+1)/2);
    const sx=x+Math.cos(a)*rx*rr,sy=y+Math.sin(a)*ry*rr;
    g.globalAlpha=Math.min(1,intensity)*(.25+.55*p2);
    g.strokeStyle='rgba(255,240,210,.95)';g.lineWidth=2.5;
    g.beginPath();g.moveTo(sx-7,sy-7);g.lineTo(sx+7,sy+7);g.moveTo(sx+7,sy-7);g.lineTo(sx-7,sy+7);g.stroke();
  }
  g.restore();
}
/* 防线高亮：沿一条线流动的光带 + 端点界标，守方专用 */
function defenseLine(g,x1,y1,x2,y2,t,color='#7fd8bf',label=''){
  const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
  g.save();
  g.strokeStyle='rgba(10,26,30,.55)';g.lineWidth=14;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
  g.strokeStyle=color;g.lineWidth=5;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
  g.setLineDash([36,58]);g.lineDashOffset=-t*70;
  g.strokeStyle='rgba(255,248,222,.95)';g.lineWidth=7;
  g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();g.setLineDash([]);
  for(const [px,py] of [[x1,y1],[x2,y2]]){
    g.fillStyle='rgba(14,32,36,.92)';g.beginPath();g.roundRect(px-5,py-5,10,10,3);g.fill();
    g.strokeStyle=color;g.lineWidth=3;g.stroke();
  }
  if(label){g.font=`700 26px ${SONG}`;g.textAlign='center';g.textBaseline='middle';
    const mx=(x1+x2)/2-uy*34,my=(y1+y2)/2+ux*34;
    g.lineWidth=6;g.strokeStyle='rgba(242,232,206,.85)';g.strokeText(label,mx,my);
    g.fillStyle='#22301f';g.fillText(label,mx,my)}
  g.restore();
}
/* ============ 数据面板：数字随动画滚动，与兵力/战损解说同步 ============ */
function dataPanel(g,x,y,rows,t,opts={}){
  const w=opts.w||342,padsy=18,rowh=opts.rowh||54;
  const h=padsy*2+(opts.title?54:0)+rows.length*rowh;
  g.save();
  g.fillStyle='rgba(22,17,12,.88)';g.beginPath();g.roundRect(x,y,w,h,12);g.fill();
  g.strokeStyle='rgba(214,184,126,.55)';g.lineWidth=2;g.stroke();
  if(opts.title){song(g,opts.title,x+w/2,y+34,28,'#e9d6a8',1,'center')}
  let ry=y+padsy+(opts.title?46:0);
  for(const r of rows){
    /* 数字从 t0→t0+.7 缓动滚到目标值 */
    const q=r.t0!=null?Math.max(0,Math.min(1,(t-r.t0)/.7)):1;
    const val=smooth(q)*r.value;
    const shown=r.decimals?val.toFixed(r.decimals):Math.round(val).toLocaleString('zh-Hans-CN');
    song(g,r.label,x+18,ry+22,23,'rgba(238,226,198,.92)',1,'left');
    g.textAlign='right';g.font=`800 30px ${HEI}`;g.fillStyle=r.color||'#f4ead4';
    g.fillText(shown+(r.unit||''),x+w-18,ry+24);
    g.textAlign='left';
    /* 兵力条：相对 panel 内最大值的比例 */
    if(r.bar!=null){
      const max=opts.max||Math.max(...rows.map(v=>v.bar||0))||1;
      const bw=(w-36)*Math.max(.02,r.bar/max)*smooth(Math.max(0,Math.min(1,(t-r.t0)/.9)));
      g.fillStyle='rgba(255,248,224,.14)';g.beginPath();g.roundRect(x+18,ry+36,w-36,9,4);g.fill();
      g.fillStyle=r.color||'#f4ead4';g.beginPath();g.roundRect(x+18,ry+36,bw,9,4);g.fill();
    }
    ry+=rowh;
  }
  g.restore();
}
function yanyiCard(g,cx,cy,w,h,text,tip,slide,alpha){
  g.save();g.globalAlpha=alpha;g.translate(cx,cy+slide*70);
  panel(g,-w/2,-h/2,w,h,'rgba(26,20,15,.94)','rgba(212,184,132,.5)',14);
  song(g,text,0,-22,46,'#e8e2cf',1,'center');
  g.strokeStyle='rgba(214,96,70,.95)';g.lineWidth=5;g.beginPath();g.moveTo(-w/2+46,6);g.lineTo(w/2-46,6);g.stroke();
  txt(g,tip,0,36,22,'rgba(214,150,128,.95)',600,'center');
  g.restore();
}

/* ================= 世界层画面件 ================= */
function numCard(g,x,y,label,value,color,note=''){
  g.save();g.font=`800 46px ${SONG}`;const w=Math.max(210,g.measureText(value).width+120);
  panel(g,x-w/2,y-58,w,116,'rgba(26,20,15,.9)',color,14);
  txt(g,label,x,y-30,23,'rgba(226,222,200,.85)',600,'center');
  song(g,value,x,y+12,46,color,1,'center');
  if(note)txt(g,note,x,y+46,20,'rgba(233,160,120,.9)',600,'center');
  g.restore();
}
function forceBlock(g,x,y,w,h,color,alpha,label,sub){
  g.save();g.globalAlpha=alpha;
  g.fillStyle=color;g.beginPath();g.roundRect(x,y,w,h,14);g.fill();
  g.strokeStyle='rgba(255,246,214,.5)';g.lineWidth=3;g.setLineDash([16,10]);g.stroke();g.setLineDash([]);
  if(label)txt(g,label,x+w/2,y+h/2-14,34,'#fff3dd',800,'center');
  if(sub)txt(g,sub,x+w/2,y+h/2+30,23,'rgba(244,236,214,.9)',600,'center');
  g.restore();
}
function compass(g,x,y,r,deg,label){
  g.save();g.globalAlpha=.94;
  g.beginPath();g.arc(x,y,r,0,2*PI);g.fillStyle='rgba(26,20,15,.86)';g.fill();
  g.strokeStyle='rgba(226,196,140,.9)';g.lineWidth=3;g.stroke();
  for(let i=0;i<12;i++){const a=i*PI/6,r0=r*(i%3===0?.74:.86);
    line(g,x+Math.cos(a)*r0,y+Math.sin(a)*r0,x+Math.cos(a)*r*.98,y+Math.sin(a)*r*.98,'rgba(226,196,140,.55)',2)}
  const a=(deg-90)*PI/180;
  g.beginPath();g.moveTo(x+Math.cos(a)*r*.82,y+Math.sin(a)*r*.82);g.lineTo(x+Math.cos(a+.24)*r*.68,y+Math.sin(a+.24)*r*.68);g.lineTo(x+Math.cos(a-.24)*r*.68,y+Math.sin(a-.24)*r*.68);g.closePath();
  g.fillStyle='#f0d79c';g.fill();
  g.strokeStyle='rgba(226,196,140,.95)';g.lineWidth=3;g.beginPath();g.arc(x,y,r*.14,0,2*PI);g.stroke();
  g.restore();
  ['N','E','S','W'].forEach((s,i)=>{const a=(i*90-90)*PI/180;txt(g,s,x+Math.cos(a)*(r+24),y+Math.sin(a)*(r+24),20,'rgba(240,232,204,.9)',700,'center')});
  if(label)txt(g,label,x,y+r+56,26,'#f2d79a',700,'center');
}
function iconTag(g,x,y,s,color){
  g.save();g.fillStyle=color;g.beginPath();g.roundRect(x-30,y-22,60,44,8);g.fill();
  txt(g,s,x,y+1,27,'#f6dcc0',700,'center');g.restore();
}

/* ================= 古地图底图：绢帛陆地 / 水墨江面 / 三方势力 ================= */
/* 势力色沿用片内既有识别：曹＝赭红、孙＝青碧、刘＝赭金。
   江北西中段属曹；江北东侧夏口一带属刘备；江南整条属孙权（周瑜军）。 */
const FAC_COL={cao:'#c4563a',sun:'#2e8a76',liu:'#b08628'};
const DIV_N=1440;
function facPaths(fac){
  const nw=g=>{g.beginPath();g.moveTo(-8,-8);g.lineTo(DIV_N,-8);for(let x=DIV_N;x>=0;x-=10)g.lineTo(x,top(x)+1);g.closePath()};
  const ne=g=>{g.beginPath();g.moveTo(DIV_N,-8);g.lineTo(W+8,-8);g.lineTo(W+8,top(W)+1);for(let x=W;x>=DIV_N;x-=10)g.lineTo(x,top(x)+1);g.closePath()};
  const south=g=>{g.beginPath();g.moveTo(-8,H+8);g.lineTo(-8,bottom(0)-1);for(let x=0;x<=W;x+=10)g.lineTo(x,bottom(x)-1);g.lineTo(W+8,H+8);g.closePath()};
  if(fac==='cao')return [nw];
  if(fac==='sun')return [south];
  return [ne];
}
function fillFac(g,fac,alpha){
  if(alpha<=0)return;g.save();g.globalAlpha=alpha;g.fillStyle=FAC_COL[fac];
  for(const p of facPaths(fac)){p(g);g.fill()}
  g.restore();
}
/* 逐像素改色：陆地走绢帛暖调（保留晕渲明暗），江面走青绿水墨 */
function ancientTone(g){
  const img=g.getImageData(0,0,W,H),d=img.data;
  const ty=new Float32Array(W),by=new Float32Array(W);
  for(let x=0;x<W;x++){ty[x]=top(x);by[x]=bottom(x)}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*4,l=(d[i]+d[i+1]+d[i+2])/3;
    let r,gg,b;
    if(y>ty[x]&&y<by[x]){
      const p=(y-ty[x])/(by[x]-ty[x]),n=Math.sin(x*.012+y*.021)*3.2+Math.sin(x*.037-y*.016)*2.4;
      r=150-48*p+n;gg=181-38*p+n;b=166-30*p+n;
    }else{
      const t=Math.max(0,Math.min(1,y<ty[x]?(l-66)/82:(l-64)/78));
      r=172+56*t;gg=150+50*t;b=110+42*t;
    }
    d[i]=r;d[i+1]=gg;d[i+2]=b;
  }
  g.putImageData(img,0,0);
}
function inkLabel(g,s,x,y,size,alpha=1,align='center'){
  g.save();g.globalAlpha*=alpha;g.font=`700 ${size}px ${SONG}`;g.textAlign=align;g.textBaseline='middle';g.lineJoin='round';
  g.strokeStyle='rgba(242,232,206,.8)';g.lineWidth=5;g.strokeText(s,x,y);
  g.fillStyle='#33261a';g.fillText(s,x,y);g.restore();
}
function ancientRivers(g){
  const trib=[
    {pts:[[1516,-10],[1448,120],[1478,240],[1438,318]],name:'汉水',lx:1512,ly:150,size:28},
    {pts:[[284,-10],[354,140],[300,250],[338,318]],name:'涢水',lx:410,ly:196,size:26},
  ];
  const through=(pts)=>{for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;if(i===0)g.moveTo(a[0],a[1]);else g.quadraticCurveTo(a[0],a[1],mx,my)}const p=pts[pts.length-1];g.lineTo(p[0],p[1])};
  g.lineCap='round';
  for(const tr of trib){
    g.beginPath();through(tr.pts);g.strokeStyle='rgba(96,140,126,.42)';g.lineWidth=17;g.stroke();
    g.beginPath();through(tr.pts);g.strokeStyle='rgba(44,86,76,.88)';g.lineWidth=5;g.stroke();
    g.beginPath();through(tr.pts);g.strokeStyle='rgba(220,236,214,.32)';g.lineWidth=2;g.stroke();
    inkLabel(g,tr.name,tr.lx,tr.ly,tr.size);
  }
}
function ancientBanks(g){
  for(let which=0;which<2;which++){
    g.beginPath();for(let x=0;x<=W;x+=7){const y=which?bottom(x):top(x);x?g.lineTo(x,y):g.moveTo(x,y)}
    g.strokeStyle='rgba(52,40,26,.85)';g.lineWidth=11;g.stroke();
    g.strokeStyle='rgba(242,232,206,.78)';g.lineWidth=4;g.stroke();
  }
  g.setLineDash([5,8]);g.beginPath();g.moveTo(40,166);g.bezierCurveTo(350,260,620,188,850,320);g.strokeStyle='rgba(92,74,48,.32)';g.lineWidth=3;g.stroke();g.beginPath();g.moveTo(148,912);g.bezierCurveTo(520,864,700,1002,1020,760);g.stroke();g.setLineDash([]);
}
function ancientCities(g){
  for(const [name,x,y,up] of CITIES){
    g.save();
    g.fillStyle='rgba(242,232,206,.92)';g.beginPath();g.arc(x,y,8,0,2*PI);g.fill();
    g.fillStyle='#3a2b1a';g.beginPath();g.arc(x,y,5.5,0,2*PI);g.fill();
    g.font=`700 26px ${SONG}`;g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
    g.lineWidth=6;g.strokeStyle='rgba(242,232,206,.82)';g.strokeText(name,x,y+(up?-27:29));
    g.fillStyle='#33261a';g.fillText(name,x,y+(up?-27:29));
    g.restore();
  }
}
function buildAncientMap(){
  paintBase(mapCtx);
  ancientTone(mapCtx);
  drawTexture(mapCtx);
  ancientRivers(mapCtx);
  song(mapCtx,'长',548,468,72,'rgba(36,60,54,.40)',1,'center');
  song(mapCtx,'江',924,514,72,'rgba(36,60,54,.40)',1,'center');
  ancientBanks(mapCtx);
  ancientCities(mapCtx);
}
function factionSeal(g,x,y,char,label,color,alpha=1){
  if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;g.font=`700 28px ${SONG}`;
  const w=Math.max(210,g.measureText(label).width+108),h=58;
  g.fillStyle='rgba(242,232,206,.92)';g.beginPath();g.roundRect(x-w/2,y-h/2,w,h,9);g.fill();
  g.strokeStyle=color;g.lineWidth=2.5;g.stroke();
  g.fillStyle=color;g.beginPath();g.roundRect(x-w/2+9,y-h/2+9,40,40,6);g.fill();
  song(g,char,x-w/2+29,y,25,'#f6ecd4',1,'center');
  song(g,label,x-w/2+60,y,28,'#33261a',1,'left');
  g.restore();
}
/* 世界层人物头像贴近画幅边缘或压到字幕带时淡出，交给镜头本身说话 */
function screenFit(x,y,r,z,cx,cy){
  const sx=W/2+(x-cx)*z,sy=H/2+(y-cy)*z,m=14,gap=44;
  return Math.min(range(sx,r+m,r+m+gap),range(W-sx,r+m,r+m+gap),
    range(sy,r+m,r+m+gap),range(896-sy,r+m,r+m+gap));
}
/* 势力/阵营标注：该方势力范围或水陆军阵在画内，就就近挂主帅小卡；
   被镜头推到边缘时与其它卡一样自动淡出。 */
function factionCmd(g,key,x,y,r,col,z,cx,cy,alpha,label){
  if(alpha<=.002)return;
  const pf=screenFit(x,y,r,z,cx,cy);
  if(pf<=0)return;
  g.save();g.globalAlpha=alpha*pf;circlePortrait(g,key,x,y,r,col,label);g.restore();
}
/* 势力牌被推近画面边缘时淡出，避免半个牌挂在画外 */
function sealEdgeAlpha(g,x,y,label,z,cx,cy){
  g.save();g.font=`700 28px ${SONG}`;
  const w=Math.max(210,g.measureText(label).width+108),h=58;
  g.restore();
  const sx=W/2+(x-cx)*z,sy=H/2+(y-cy)*z,m=18,r=54;
  const fx=Math.min(range(sx,w/2+m,w/2+m+r),range(W-sx,w/2+m,w/2+m+r));
  const fy=Math.min(range(sy,h/2+m,h/2+m+r),range(H-sy,h/2+m,h/2+m+r));
  /* 左上角势力范围图例是常驻屏幕层，势力牌被推上去会和它糊成一片：
     按牌面（世界尺寸×缩放）与图例（外扩 24px 留白）的实际重叠量淡出 */
  const hw=w/2*z,hh=h/2*z;
  const bx0=sx-hw-24,bx1=sx+hw+24,by0=sy-hh-24,by1=sy+hh+24;
  const ox=Math.min(bx1,LEGEND.x+LEGEND.w)-Math.max(bx0,LEGEND.x);
  const oy=Math.min(by1,LEGEND.y+LEGEND.h)-Math.max(by0,LEGEND.y);
  const fl=(ox>0&&oy>0)?1-range(Math.min(ox,oy),0,36):1;
  return Math.min(fx,fy,fl);
}
/* 势力范围：战场段常驻；讲到说话一方时略提亮；进入「真正败因」段淡出，
   把地图交还给纯绢帛，随后由战后分色接棒。 */
function territoryAlpha(v){return range(v,3.8,5.2)*(1-range(v,226.6,229.2))}
function drawTerritories(g,v){
  const base=territoryAlpha(v);if(base<=0)return;
  const s=shotAt(v);
  fillFac(g,'cao',base*(.20+(s&&s.fac==='cao'?.06:0)));
  fillFac(g,'sun',base*(.20+(s&&s.fac==='sun'?.06:0)));
  fillFac(g,'liu',base*(.22+(s&&s.fac==='liu'?.06:0)));
  g.save();g.globalAlpha=base;
  /* 分界虚线缓慢流动：势力交界也有生命感 */
  g.setLineDash([20,14]);g.lineDashOffset=-v*34;
  g.beginPath();g.moveTo(DIV_N,0);g.lineTo(DIV_N,top(DIV_N));
  g.strokeStyle='rgba(64,48,30,.5)';g.lineWidth=3;g.stroke();
  g.setLineDash([]);g.lineDashOffset=0;g.restore();
  const [z,cx,cy]=cameraFor(v);
  const seal=(x,y,char,label,color)=>{
    const ea=sealEdgeAlpha(g,x,y,label,z,cx,cy);
    if(ea>.002)factionSeal(g,x,y,char,label,color,base*ea);
  };
  seal(800,330,'曹','曹操 · 江北','#b04a30');
  seal(480,850,'孙','孙权 · 赤壁','#2a7f6d');
  seal(1660,168,'刘','刘备 · 夏口','#9a7420');
}
/* 势力/水军常驻主帅卡：在所有剧情卡之后绘制，同一帧同一人只留一张。
   剧情大卡已在画内（alpha>0.35）就让位；否则势力范围或水军阵中挂小卡。 */
function drawFactionLabels(g,v){
  if(!ACTS)return;
  const base=territoryAlpha(v);if(base<=0)return;
  const [z,cx,cy]=cameraFor(v);
  const seen=g._cmdSeen||new Set();
  if(!seen.has('cao'))factionCmd(g,'cao',800,240,24,'#d98067',z,cx,cy,base*.92,'曹操');
  if(!seen.has('sunquan'))factionCmd(g,'sunquan',480,762,24,'#67d9b3',z,cx,cy,base*.92,'孙权');
  if(!seen.has('liu'))factionCmd(g,'liu',1450,168,24,'#c9a94a',z,cx,cy,base*.92,'刘备');
  /* 水军阵：势力牌被推出画外时，把卡挂到船阵上（同方剧情卡仍优先） */
  const a=actOf(v),hook=a.i===0&&v>=4.6;
  const inn=hook?range(v,4.6,6.6):range(v,ACTS[3].t0-1.0,ACTS[3].t0+.8);
  const gone=1-range(v,ACTS[9].t0,ACTS[9].t0+2.2);
  if(inn*gone<=0)return;
  if(!seen.has('cao')&&screenFit(800,240,24,z,cx,cy)<.25)
    factionCmd(g,'cao',850,330,22,'#d98067',z,cx,cy,inn*gone*.92,'曹操');
  if(!seen.has('zhouyu')&&!seen.has('sunquan')&&screenFit(480,762,24,z,cx,cy)<.25)
    factionCmd(g,'zhouyu',960,630,22,'#67d9b3',z,cx,cy,inn*gone*.92,'周瑜');
}
/* 屏幕层图例：地图配色即势力配色，镜头推到谁就看得见谁 */
const LEGEND={x:36,y:34,w:282,h:158};
function factionLegend(g,alpha){
  if(alpha<=0)return;g.save();g.globalAlpha=alpha;
  const {x,y,w,h}=LEGEND;
  g.fillStyle='rgba(24,19,14,.84)';g.beginPath();g.roundRect(x,y,w,h,10);g.fill();
  g.strokeStyle='rgba(212,182,124,.55)';g.lineWidth=2;g.stroke();
  song(g,'势力范围',x+20,y+30,24,'#e9d6a8',1,'left');
  const rows=[['曹操','江北 · 二十余万','#c4563a'],['孙权','江东 · 三万','#2e8a76'],['刘备','夏口 · 两万','#b08628']];
  rows.forEach((r,i)=>{
    const ry=y+64+i*32;
    g.fillStyle=r[2];g.beginPath();g.roundRect(x+20,ry-8,16,16,4);g.fill();
    txt(g,r[0],x+48,ry,21,'#f4ead4',700);
    txt(g,r[1],x+112,ry,17,'rgba(226,212,184,.85)',500);
  });
  g.restore();
}

/* ================= 双军阵位 ================= */
const caoboats=[];for(let row=0;row<3;row++)for(let col=0;col<7;col++)caoboats.push([700+col*92+row*18,392+row*46]);
const allyboats=[];for(let row=0;row<2;row++)for(let col=0;col<6;col++)allyboats.push([716+col*104+row*22,706+row*40]);
const fireships=Array.from({length:10},(_,i)=>({sx:1230+i*46,sy:712+(i%3)*13,tx:900+(i-4)*54,ty:412+Math.floor(i/3)*34}));
/* 各段曹军船阵位置整体偏移（溃退时北移） */
function caoShift(v,a){return a.i>=9?range(v,ACTS[9].t0+.4,ACTS[9].t0+2.6):0}
/* 孙军将领旗列：9 员主帅卡贴着联军船队下沿排开（主帅就在自家舰队里） */
const SUN_ROSTER=[['chengpu',704],['handang',770],['huanggai',836],['zhoutai',902],['ganning',968],['taishici',1034],['lingtong',1100],['lvmeng',1166],['liuxun',1232]];
function rosterRow(g,v,a){
  if(a.i!==3)return;   /* 只在「对峙与初战」亮旗列：联军江南摆开时点将 */
  const t0=a.t0,inn=range(v,t0+.6,t0+2.0)*(1-range(v,a.t1-.8,a.t1-.2));
  if(inn<=0)return;
  const [z,cx,cy]=cameraFor(v);
  SUN_ROSTER.forEach(([key,x],i)=>{
    const pf=screenFit(x,876,18,z,cx,cy);
    if(pf<=0)return;
    const k=range(v,t0+.8+i*.14,t0+1.7+i*.14)*inn;
    if(k>0){g.save();g.globalAlpha=k*pf;circlePortrait(g,key,x,876,18,FAC_COL.sun,CMD_NAMES[key]);g.restore()}
  });
}

/* ================= 各段：世界层 / 屏幕层 ================= */
/* 通用主帅卡：按段内秒数淡入淡出，靠画幅边缘自动隐（screenFit）。
   inS/outS 为相对段首的秒数；outS<=0 表示距段尾 -outS 秒收。 */
function cmdCard(g,key,x,y,r,col,v,a,inS,outS,fi=.9,fo=.9){
  const t0=a.t0,te=a.t1+(outS<0?outS:outS-a.t1+a.t0);
  if(v<t0+inS||v>te+fo)return;
  const k=range(v,t0+inS,t0+inS+fi)*(1-range(v,te,te+fo));
  if(k<=0)return;
  const [z,cx,cy]=cameraFor(v),pf=screenFit(x,y,r,z,cx,cy);
  if(pf<=0)return;
  g.save();g.globalAlpha=k*pf;circlePortrait(g,key,x,y,r,col,CMD_NAMES[key]);g.restore();
}
function hookWorld(g,v,a){
  const [z,cx,cy]=cameraFor(v);
  const b=range(v,4.7,5.9)*(1-range(v,6.4,7.2))*screenFit(1240,300,38,z,cx,cy);
  if(b>0){g.save();g.globalAlpha=b;circlePortrait(g,'cao',1240,300,38,'#d98067','曹操');g.restore()}
  const c=range(v,6.7,7.7)*(1-range(v,10.8,11.8))*screenFit(700,798,38,z,cx,cy);
  if(c>0){g.save();g.globalAlpha=c;circlePortrait(g,'zhouyu',700,798,38,'#67d9b3','周瑜');g.restore()}
  /* 孙军之主：江东三万是孙权的，与周瑜同侧列联军船队（用户约定：周瑜、孙权都归孙） */
  cmdCard(g,'sunquan',808,842,34,'#3fb894',v,a,6.7,-9.07,1.0,1.0);
  const tease=range(v,a.t1-2.6,a.t1-1.4);
  if(tease>0){g.save();g.globalAlpha=tease*.75;
    const f=g.createRadialGradient(1010,520,10,1010,520,190*tease+10);
    f.addColorStop(0,'rgba(255,220,110,.9)');f.addColorStop(.4,'rgba(246,104,40,.5)');f.addColorStop(1,'rgba(240,80,30,0)');
    g.fillStyle=f;g.beginPath();g.arc(1010,520,190*tease+10,0,2*PI);g.fill();g.restore()}
}
function hookUI(g,v,a){
  const end=Math.max(2.4,HOOK_END);
  if(v<end+.6){
    /* 落锤闪光：0s 与 0.16s（音效鼓点/碎裂）两记全屏冲击光 */
    const fl=(t0,dur,peak)=>v>=t0&&v<t0+dur?peak*Math.pow(1-(v-t0)/dur,1.5):0;
    const f=fl(0,.16,.5)+fl(.16,.24,.32);
    if(f>0){g.save();g.globalAlpha=Math.min(.8,f);
      const fg=g.createRadialGradient(W/2,470,60,W/2,470,1250);
      fg.addColorStop(0,'rgba(255,244,214,.95)');fg.addColorStop(.35,'rgba(255,196,120,.55)');fg.addColorStop(1,'rgba(255,150,80,0)');
      g.fillStyle=fg;g.fillRect(0,0,W,H);g.restore()}
    bigTitle(g,HOOK,Math.max(0,Math.min(1,v/.35))*(1-range(v,end-.4,end+.6)),470,104,v);
  }
  else{const big=range(v,end+.6,end+2.6)*(1-range(v,4.6,5.8));
    if(big>0){g.save();g.globalAlpha=big;
      numCard(g,700,420,'','二十万','rgba(240,150,110,.95)');
      numCard(g,1220,420,'','五万','rgba(150,232,200,.95)');
      txt(g,'⇄',960,420,64,'rgba(240,232,204,.9)',700,'center');g.restore()}}
}
function forceWorld(g,v,a){
  const inn=range(v,a.t0+.6,a.t0+2.6);
  forceBlock(g,300,250,540,200,'rgba(196,124,74,.60)',inn*.95,'曹军','约二十来万');
  forceBlock(g,1060,590,540,200,'rgba(86,190,164,.56)',inn*.95,'孙刘联军','五万出头');
  const t1=range(v,a.t0+2.4,a.t0+3.6),t2=range(v,a.t0+5.0,a.t0+6.2),t3=range(v,a.t0+8.0,a.t0+9.2);
  const win=(s,e)=>s*(1-range(v,a.t0+e,a.t0+e+1.0));
  if(t1>0){const al=win(t1,9.6);if(al>0){g.save();g.globalAlpha=al;numCard(g,600,530,'曹操自称','八十万','#f0a58c','是恐吓');g.restore()}}
  if(t2>0){const al=win(t2,11.4);if(al>0){g.save();g.globalAlpha=al;numCard(g,960,330,'周瑜清点','二十来万','#f3c693','北方兵＋荆州降兵');g.restore()}}
  if(t3>0){const al=win(t3,14.0);if(al>0){g.save();g.globalAlpha=al;numCard(g,1420,470,'联军','五万出头','#a5ead0','孙权三万＋刘备两万');g.restore()}}
  if(v>a.t0+5.0){const [z,cx,cy]=cameraFor(v),pf=screenFit(300,806,46,z,cx,cy);
    const fo=1-range(v,a.t1-3.4,a.t1-2.2);
    if(pf*fo>0){g.save();g.globalAlpha=pf*fo;circlePortrait(g,'zhouyu',300,806,46,'#67d9b3','周瑜');g.restore()}}
  /* 「曹操自称八十万」：北军主帅随数字牌同现（与刘备两张卡错时，不叠在一起） */
  cmdCard(g,'cao',1400,300,36,'#d98067',v,a,2.2,6.0,.9,.9);
  /* 「孙权三万」（37.2s）、「刘备两万」（37.9s）：点名即出卡，江东/夏口各归其位 */
  const sq=range(v,a.t0+16.0,a.t0+17.2)*(1-range(v,a.t1-.5,a.t1-.1));
  if(sq>0){const [z,cx,cy]=cameraFor(v),pf=screenFit(560,650,40,z,cx,cy);
    if(pf>0){g.save();g.globalAlpha=sq*pf;circlePortrait(g,'sunquan',560,650,40,'#67d9b3','孙权');g.restore()}}
  const lb=range(v,a.t0+17.6,a.t0+18.8)*(1-range(v,a.t1-.5,a.t1-.1));
  if(lb>0){const [z,cx,cy]=cameraFor(v),pf=screenFit(1400,300,38,z,cx,cy);
    if(pf>0){g.save();g.globalAlpha=lb*pf;circlePortrait(g,'liu',1400,300,38,'#c9a94a','刘备');g.restore()}}
}
/* 数据面板：兵力账跟着口播逐项滚数（旁白说到哪项，哪项的数和条才起来） */
function forcePanel(g,v,a){
  const T=a.t0;
  const show=range(v,T+2.2,T+3.2)*(1-range(v,a.t1-.6,a.t1-.1));
  if(show<=0)return;
  const rows=[
    {label:'曹操自称',value:80,unit:'万',bar:80,color:'#f0a58c',t0:T+2.4},
    {label:'周瑜清点',value:20,unit:'来万',bar:20,color:'#f3c693',t0:T+5.0},
    {label:'北方兵',value:15.5,decimals:1,bar:15.5,color:'#e8b98a',t0:T+8.0},
    {label:'荆州降兵',value:7.5,decimals:1,bar:7.5,color:'#dfae86',t0:T+8.0},
    {label:'联军五万出头',value:5,unit:'万',bar:5,color:'#a5ead0',t0:T+8.0},
  ];
  dataPanel(g,1500,738,rows,v,{title:'兵力账 · 万人',rowh:48,h:320});
}
/* 段2 路线：曹操自襄阳→江陵→赤壁（沿长江），刘备长坂败退→夏口 */
const PATH_CAO=buildPath([[196,150],[252,268],[330,382],[430,470],[540,590],[640,700]]);
const PATH_LIU=buildPath([[330,150],[760,138],[1120,180],[1400,248],[1508,330]]);
const PATH_FIRE=buildPath([[1250,700],[1180,630],[1120,566],[1040,506],[960,452],[892,414]]);
const PATH_CLASH=buildPath([[1080,724],[1000,640],[920,560],[860,496]]);
const PATH_HUARONG=buildPath([[140,1060],[430,940],[700,830],[900,720],[1120,620],[1240,586]]);
function marchWorld(g,v,a){
  const t0=a.t0;
  const arc=range(v,t0+.4,t0+4.2);
  if(arc>0){g.save();g.globalAlpha=arc;
    g.beginPath();g.moveTo(70,70);g.quadraticCurveTo(130,220,244,252);
    g.strokeStyle='rgba(240,150,110,.85)';g.lineWidth=8;g.lineCap='round';g.stroke();
    attackArrow(g,124,158,244,252,v,'rgba(240,150,110,.95)',150,8);
    txt(g,'曹操自襄阳南下',96,44,32,'rgba(250,196,164,.95)',700);g.restore()}
  /* 荆州水军战船归曹：船队沿江面路径南下，错峰跟进 */
  const cap=range(v,t0+4.6,t0+8.6)*(1-range(v,t0+9.8,t0+10.8));
  if(cap>0){g.save();g.globalAlpha=cap;
    for(let i=0;i<5;i++){
      const u=unitAt(PATH_CAO,v,t0+4.6,t0+8.6,i*.07);
      boat(g,u.x,u.y,u.ang,1.0,'#8f493a',0,'');
    }
    /* 主帅卡跟着船队走：曹操立在领头船上（镜头跟着推，卡跟着船走） */
    const [zc,cxc,cyc]=cameraFor(v);
    const ld=unitAt(PATH_CAO,v,t0+4.6,t0+8.6,0);
    const lpf=screenFit(ld.x,ld.y-58,20,zc,cxc,cyc);
    if(lpf>0){g.save();g.globalAlpha=cap*lpf;circlePortrait(g,'cao',ld.x-4,ld.y-58,20,'#d98067','曹操');g.restore()}
    txt(g,'荆州水军战船归曹',516,540,26,'rgba(243,206,166,.95)',700);g.restore()}
  /* 刘备长坂败退：兵船沿同一条大路由西向东撤向夏口 */
  const lv=range(v,t0+8.2,t0+12.0)*(1-range(v,t0+14.4,t0+15.4));
  if(lv>0){g.save();g.globalAlpha=lv;g.setLineDash([14,12]);g.lineDashOffset=-v*40;
    g.beginPath();g.moveTo(320,150);g.quadraticCurveTo(960,116,1638,232);
    g.strokeStyle='rgba(150,220,200,.8)';g.lineWidth=5;g.stroke();g.setLineDash([]);g.lineDashOffset=0;
    attackArrow(g,1460,206,1620,232,v,'rgba(150,220,200,.85)',160,7);
    for(let i=0;i<3;i++){
      const u=unitAt(PATH_LIU,v,t0+8.2,t0+12.0,i*.05);
      boat(g,u.x,u.y,u.ang,1.0,'#3fb98f',0,'刘');
    }
    /* 刘备随本部兵船同进退（人跟着部队走） */
    const [zl,zxl,zyl]=cameraFor(v);
    const ll=unitAt(PATH_LIU,v,t0+8.2,t0+12.0,0);
    const lpf=screenFit(ll.x,ll.y-58,20,zl,zxl,zyl);
    if(lpf>0){g.save();g.globalAlpha=lv*lpf;circlePortrait(g,'liu',ll.x-2,ll.y-58,20,'#c9a94a','刘备');g.restore()}
    txt(g,'刘备长坂败退 → 夏口',1080,142,28,'rgba(186,240,222,.95)',700);g.restore()}
  /* 朝堂：孙权坐镇江东决策（与「拔刀斫案」面板同步） */
  const court=range(v,t0+11.6,t0+12.8)*(1-range(v,a.t1-.6,a.t1-.1));
  if(court>0){const [zs,zxs,zys]=cameraFor(v),pf=screenFit(880,840,36,zs,zxs,zys);
    if(pf>0){g.save();g.globalAlpha=court*pf;circlePortrait(g,'sunquan',880,840,36,'#3fb894','孙权');g.restore()}}
}
function marchUI(g,v,a){
  const t0=a.t0;const k=range(v,t0+12.4,t0+13.8)*(1-range(v,a.t1-1.2,a.t1-.2));
  if(k<=0)return;g.save();g.globalAlpha=k;panel(g,560,420,800,236,'rgba(26,20,15,.94)','rgba(226,196,140,.7)');
  song(g,'孙权拔刀斫案',600,472,40,'#f3e6c8',1,'left');
  txt(g,'张昭等主降 · 鲁肃周瑜主战',600,522,26,'rgba(220,226,214,.9)',600,'left');
  line(g,600,554,1320,554,'#9f895f',2);
  txt(g,'「诸将吏敢复有言当迎操者，与此案同！」',600,596,26,'rgba(240,210,160,.95)',700,'left');
  g.restore();
}
function standWorld(g,v,a){
  const t0=a.t0,[z,cx,cy]=cameraFor(v);
  g.save();g.globalAlpha=range(v,t0+.4,t0+1.8)*screenFit(1240,300,38,z,cx,cy);circlePortrait(g,'cao',1240,300,38,'#d98067','曹操');g.restore();
  g.save();g.globalAlpha=range(v,t0+.4,t0+1.8)*screenFit(700,798,38,z,cx,cy);circlePortrait(g,'zhouyu',700,798,38,'#67d9b3','周瑜');g.restore();
  /* 孙权同属孙军：与周瑜并肩列于联军船队（江东三万的主人） */
  const sq=range(v,t0+.6,t0+2.0)*(1-range(v,a.t1-.6,a.t1-.1));
  const sp=screenFit(822,798,34,z,cx,cy);
  if(sq*sp>0){g.save();g.globalAlpha=sq*sp;circlePortrait(g,'sunquan',822,798,34,'#67d9b3','孙权');g.restore()}
  /* 孙军将领旗列：九员主帅随联军船队铺开（段3 点将） */
  rosterRow(g,v,a);
  /* 第一次交手（口播 85–91s）：联军小船的攻击路线 + 交战区闪烁 */
  const hit=range(v,t0+11.6,t0+13.0)*(1-range(v,t0+14.2,t0+15.0));
  if(hit>0){g.save();g.globalAlpha=hit*.9;
    attackArrow(g,640,760,880,500,v,'rgba(120,232,196,.95)',140,7);
    battleZone(g,900,470,120,70,v,1.0);g.restore()}
  /* 小船贴舷（口播 86–91s）、退回江北（93–94s）分别对齐各自台词 */
  const p=range(v,t0+14.4,t0+16.8)*(1-range(v,t0+19.2,t0+20.2));
  const back=range(v,t0+21.2,t0+22.2)*(1-range(v,t0+22.5,t0+22.9));
  if(p>0){g.save();g.globalAlpha=p;
    for(let i=0;i<4;i++){
      const u=unitAt(PATH_CLASH,v,t0+14.4,t0+16.8,i*.12);
      boat(g,u.x,u.y,u.ang,1.0,'#4cae94',0,'');
    }
    battleZone(g,880,470,130,72,v,p);
    txt(g,'小船贴舷冲击',1190,646,28,'rgba(190,244,226,.95)',700);g.restore()}
  if(back>0){g.save();g.globalAlpha=back;
    attackArrow(g,880,470,700,360,v,'rgba(240,160,120,.95)',150,8);
    /* 这句压在船阵与江面上，加一层暗底保证可读 */
    const bt='曹军败退 · 引次江北';g.font=`700 28px ${SONG}`;
    const bw=g.measureText(bt).width;
    g.fillStyle='rgba(20,16,12,.66)';g.beginPath();g.roundRect(620-16,560-27,bw+32,54,9);g.fill();
    txt(g,bt,620,560,28,'rgba(250,205,175,.98)',700);g.restore()}
}
function weakWorld(g,v,a){
  const t0=a.t0;
  /* 全段是曹军的软肋：双方主帅同框（曹操在江北船阵、周瑜在联军船队），观众一眼对上号 */
  cmdCard(g,'cao',1240,300,38,'#d98067',v,a,.5,-.5);
  cmdCard(g,'zhouyu',700,660,34,'#67d9b3',v,a,.9,-.6);
  const link=range(v,t0+.4,t0+4.4);
  if(link>0){g.save();g.globalAlpha=link*.95;
    for(let row=0;row<3;row++)for(let col=0;col<7;col++){
      const x=700+col*92+row*18,y=392+row*46,p=Math.min(1,link*1.35-col*.12);
      if(p>0&&col<6)line(g,x+20,y,x+92*p,y,'rgba(214,190,132,.85)',4)}
    txt(g,'战船首尾相接',640,566,30,'rgba(240,226,188,.95)',700);g.restore()}
  const ico=range(v,t0+4.8,t0+6.0)*(1-range(v,t0+10.6,t0+11.6));
  if(ico>0){g.save();g.globalAlpha=ico;
    for(let i=0;i<7;i++){const x=660+i*118,y=356-((v*22+i*40)%120);iconTag(g,x,y,i%2?'疫':'晕','rgba(120,30,26,.85)')}
    g.restore()}
}
function weakUI(g,v,a){
  const t0=a.t0,k=range(v,t0+11.8,a.t1-.4);
  if(k<=0)return;g.save();g.globalAlpha=k;panel(g,1210,470,600,150,'rgba(26,20,15,.9)','rgba(214,150,120,.6)');
  song(g,'铁索连环＝演义加工',1240,522,34,'#f0cfae',1,'left');
  txt(g,'史书只记「首尾相接」，铁索是后人添的',1240,578,24,'rgba(224,220,204,.9)',500,'left');g.restore();
}
function planWorld(g,v,a){
  const t0=a.t0;
  const [z,cx,cy]=cameraFor(v),pf=screenFit(1230,606,56,z,cx,cy);
  if(pf>0){g.save();g.globalAlpha=range(v,t0+.4,t0+2.0)*pf;circlePortrait(g,'huanggai',1230,606,56,'#d9b27b','黄盖');g.restore()}
  const hi=range(v,t0+2.0,t0+3.4)*(1-range(v,t0+6.8,t0+7.6));
  if(hi>0){g.save();g.globalAlpha=hi;g.setLineDash([12,10]);g.lineDashOffset=-v*44;
    g.beginPath();g.moveTo(1200,600);g.quadraticCurveTo(960,470,860,420);g.strokeStyle='rgba(92,224,184,.85)';g.lineWidth=5;g.stroke();
    g.setLineDash([]);g.lineDashOffset=0;
    txt(g,'一艘着火 · 全阵跟着烧',980,468,28,'rgba(190,244,226,.95)',700);g.restore()}
  /* 曹操盘问信使（口播 t0+14.9s 起）：北岸主帅对诈降书起疑 */
  cmdCard(g,'cao',1240,300,36,'#d98067',v,a,13.6,-.8);
}
function planUI(g,v,a){
  const k=range(v,a.t0+7.6,a.t0+8.8)*(1-range(v,a.t1-1.0,a.t1-.1));
  if(k<=0)return;g.save();g.globalAlpha=k;letter(g,960,520,600,380,'黄盖诈降书',['先书报曹公 · 欺以欲降','「但恐汝诈耳」'],'黄',-.045);g.restore();
}
/* 火船与东南风（段6）：黄盖押风、曹操在乌林等风信 */
function windWorld(g,v,a){
  cmdCard(g,'huanggai',1250,690,26,'#d9b27b',v,a,.4,-15.0,.9,.9);
  cmdCard(g,'cao',1046,300,34,'#d98067',v,a,6.0,-1.2,1.0,1.0);
}
function windUI(g,v,a){
  const t0=a.t0;
  const pr=range(v,t0+.4,t0+1.8)*(1-range(v,t0+6.4,t0+7.4));
  if(pr>0){g.save();g.globalAlpha=pr;panel(g,300,470,540,320,'rgba(26,20,15,.93)','rgba(214,184,126,.65)');
    txt(g,'火船剖面 · 示意',340,522,31,'#d5ebd4',700);
    boat(g,560,626,0,2.4,'#569f86',0,'黄');
    pill(g,'帷幕',480,566,'#e9dbaf','rgba(30,53,47,.8)',22);
    pill(g,'薪草 / 油脂',600,690,'#e9dbaf','rgba(30,53,47,.8)',22);
    pill(g,'撤离走舸',700,736,'#e9dbaf','rgba(30,53,47,.8)',22);
    txt(g,'十艘蒙冲 · 《周瑜传》',340,764,22,'rgba(214,222,208,.85)',500);g.restore()}
  const p=range(v,t0+3.6,t0+9.2);
  if(p>0){g.save();g.globalAlpha=Math.min(1,p*2.2)*(1-range(v,a.t1-.8,a.t1-.1));
    compass(g,1420,560,96,315-180*p,p<.5?'西北风':'东南风');
    txt(g,'冬令多西北风 · 那天转了向',1420,758,26,'rgba(240,226,188,.95)',700,'center');g.restore()}
}
function fireWorld(g,v,a){
  const t0=a.t0,d=Math.max(1,a.t1-t0);
  const row=range(v,t0+.3,t0+2.4),travel=range(v,t0+2.6,t0+d-2.2);
  /* 待机期黄盖就立在领头火船上（起锚即随队出发；点火后改贴撤离小艇） */
  if(travel<=0&&row>0){
    const [zr,xr,yr]=cameraFor(v),rpf=screenFit(1230,654,26,zr,xr,yr);
    if(rpf>0){g.save();g.globalAlpha=row*rpf;circlePortrait(g,'huanggai',1230,654,26,'#d9b27b','黄盖');g.restore()}
  }
  /* 曹军「延颈观望 → 撞入船阵」期间曹操在北岸露脸（与 fireUI 面板同位） */
  cmdCard(g,'cao',1240,300,36,'#d98067',v,a,6.4,-8.9);
  /* 态势标绘铺在最底层（火船队的后面）：突击路线 + 后援跟上 + 交战区闪烁 */
  const mark=range(v,t0+2.6,t0+3.4)*(1-range(v,t0+d-2.4,t0+d-1.4));
  if(mark>0){g.save();g.globalAlpha=mark*.9;
    attackArrow(g,1180,660,900,430,v,'rgba(255,170,110,.95)',170,8);
    battleZone(g,930,440,150,80,v,mark);g.restore()}
  /* 后面的攻击箭头：二线梯队从待机水域继续压上（贴着火船队尾迹） */
  const rear=range(v,t0+4.2,t0+5.4)*(1-range(v,t0+d-2.6,t0+d-1.2));
  if(rear>0){g.save();g.globalAlpha=rear*.8;
    for(let i=0;i<3;i++)attackArrow(g,1268+i*26,752-i*16,1120+i*40,560-i*22,v+i*.5,'rgba(255,196,140,.75)',150,6);
    txt(g,'后队继进',1330,700,24,'rgba(255,214,170,.85)',700);g.restore()}
  fireships.forEach((b,i)=>{
    if(travel<=0){if(row>0)boat(g,b.sx,b.sy+Math.sin(v*1.5+i)*1.2,-2.18+Math.sin(v*1.1+i*.7)*.01,1.06,'#4cae94',0,'黄');return}    /* 火船沿 PATH_FIRE 弧线冲阵（不再走直线），各船错峰跟进 */
    const u=unitAt(PATH_FIRE,v,t0+2.6,t0+d-2.2,i*.03);
    const x=u.x,y=u.y,ang=u.ang;
    const burn=range(v,t0+2.8+i*.14,t0+4.6+i*.14);
    if(u.q>.03){
      g.save();g.strokeStyle='rgba(202,244,234,.20)';g.lineWidth=7;g.lineCap='round';
      g.beginPath();g.moveTo(x-Math.cos(ang)*16,y-Math.sin(ang)*16);
      g.lineTo(x-Math.cos(ang)*(30+52*u.q),y-Math.sin(ang)*(30+52*u.q));g.stroke();g.restore()}
    boat(g,x,y,ang-0.12,1.08,'#4cae94',burn,'黄');
    if(travel>.2&&travel<.9)boat(g,x+43,y+31,ang-0.2,.45,'#b39b6f');   /* 「船尾各拴一只轻快小船」：每条火船都拖一条撤走小艇 */
  });
  /* 黄盖点完火跳上撤走的小船：主帅卡跟着撤离船移动（人跟着部队走） */
  if(travel>.12&&travel<.98){
    const ld=unitAt(PATH_FIRE,v,t0+2.6,t0+d-2.2,0);
    const [zf,zxf,zyf]=cameraFor(v);
    const hpf=screenFit(ld.x+43,ld.y+31,22,zf,zxf,zyf);
    if(hpf>0){g.save();g.globalAlpha=Math.min(1,(travel-.12)*6)*hpf;circlePortrait(g,'huanggai',ld.x+43,ld.y+31,22,'#d9b27b','黄盖');g.restore()}
  }
  const imp=range(v,t0+d-2.0,t0+d-1.0);
  if(imp>0){g.save();g.globalAlpha=imp*.6;const f=g.createRadialGradient(960,470,10,960,470,240*imp+10);
    f.addColorStop(0,'rgba(255,218,106,.95)');f.addColorStop(.34,'rgba(245,104,40,.6)');f.addColorStop(1,'rgba(244,83,28,0)');
    g.fillStyle=f;g.beginPath();g.arc(960,470,240*imp+10,0,2*PI);g.fill();g.restore()}
}
function fireUI(g,v,a){
  const k=range(v,a.t0+4.6,a.t0+6.2)*(1-range(v,a.t1-1.0,a.t1-.2));
  if(k<=0)return;g.save();g.globalAlpha=k;panel(g,1300,170,560,110,'rgba(26,20,15,.78)','rgba(240,180,120,.7)');
  txt(g,'延颈观望',1340,226,36,'#9fbdac',600);txt(g,'以为来降',1660,226,36,'#ffc07b',800);g.restore();
}
function burnWorld(g,v,a){
  const t0=a.t0,sp=range(v,t0+.3,t0+3.6);
  /* 联军压上：周瑜在联军船队一侧（压上箭头的主人） */
  cmdCard(g,'zhouyu',700,640,36,'#67d9b3',v,a,.8,-15.9,.9,.9);
  /* 延烧岸上营落：曹操在北岸船阵（他的本钱在烧） */
  cmdCard(g,'cao',1240,300,38,'#d98067',v,a,4.2,-6.0,1.0,1.0);
  /* 后面的攻击箭头：联军主力从江南一线压向火场（位于燃烧船阵背后） */
  const press=range(v,t0+.8,t0+2.2)*(1-range(v,t0+7.6,t0+8.8));
  if(press>0){g.save();g.globalAlpha=press*.85;
    for(let i=0;i<4;i++)attackArrow(g,820+i*130,856,900+i*135,536,v+i*.45,'rgba(150,224,190,.9)',150,7);
    txt(g,'联军压上',1290,846,26,'rgba(190,244,226,.95)',700);g.restore()}
  if(sp>0){g.save();g.globalAlpha=sp*.85;
    caoboats.forEach(([x,y],i)=>{const k=range(v,t0+.3+i*.11,t0+1.6+i*.11);if(k>0)boat(g,x,y+Math.sin(v*1.6+i*.8)*1.3,-.08+Math.sin(v*1.2+i*.6)*.012,.91,'#8f493a',k*.8)});
    g.restore();
    g.save();g.globalAlpha=sp*.7;const f=g.createRadialGradient(1000,470,30,1000,470,540*sp+40);
    f.addColorStop(0,'rgba(255,226,140,.9)');f.addColorStop(.4,'rgba(246,110,44,.55)');f.addColorStop(1,'rgba(240,80,30,0)');
    g.fillStyle=f;g.beginPath();g.arc(1000,470,540*sp+40,0,2*PI);g.fill();g.restore()}
  const ashore=range(v,t0+4.2,t0+6.6);
  if(ashore>0){g.save();g.globalAlpha=ashore*.85;
    for(let i=0;i<8;i++){const x=720+i*104,y=top(x)-30,hh=(v*30+i*20)%46;
      g.fillStyle='rgba(230,120,60,.85)';
      g.beginPath();g.moveTo(x-8,y+16);g.quadraticCurveTo(x-4,y-24-hh,x,y-40-hh);g.quadraticCurveTo(x+4,y-24-hh,x+8,y+16);g.closePath();g.fill()}
    g.restore();
    /* 岸上营落＝曹军陆军：营旗旁同样挂主帅卡 */
    const [za,axa,aya]=cameraFor(v);
    factionCmd(g,'cao',1100,top(1100)-92,20,'#d98067',za,axa,aya,ashore*.92,'曹操');}
  const jump=range(v,t0+7.2,t0+9.8);
  if(jump>0){g.save();g.globalAlpha=jump;
    for(let i=0;i<9;i++){const x=700+i*64,y=520+((v*60+i*30)%80);
      g.fillStyle='rgba(180,220,235,.7)';g.beginPath();g.arc(x,y,4,0,2*PI);g.fill()}g.restore()}
}
/* 压在火光／船阵上的注释：先铺一层暗底，远看也读得清（与「曹军败退」同一套底） */
function plateTxt(g,s,x,y,size,color,weight=700,align='center'){
  g.save();g.font=`${weight} ${size}px ${HEI}`;
  const w=g.measureText(s).width,pad=15,bh=size+22;
  const x0=align==='center'?x-w/2:align==='right'?x-w:x;
  g.fillStyle='rgba(20,16,12,.62)';g.beginPath();g.roundRect(x0-pad,y-bh/2,w+pad*2,bh,8);g.fill();
  g.restore();
  txt(g,s,x,y,size,color,weight,align);
}
function burnUI(g,v,a){
  const k=range(v,a.t0+4.4,a.t0+6.0)*(1-range(v,a.t1-1.2,a.t1-.2));
  if(k>0){g.save();g.globalAlpha=k;plateTxt(g,'火延烧岸上营落 · 烟炎张天',960,182,32,'rgba(255,214,150,.98)');g.restore()}
  const j=range(v,a.t0+7.4,a.t0+8.8)*(1-range(v,a.t1-1.0,a.t1-.1));
  if(j>0){g.save();g.globalAlpha=j;plateTxt(g,'人马烧溺死者甚众',700,690,28,'rgba(214,236,244,.98)',700,'left');g.restore()}
  /* 战损统计面板：与「延烧／跳水」解说同步，只引用旁白口径（水军几乎全军覆没） */
  const T=a.t0;
  const show=range(v,T+6.6,T+7.6)*(1-range(v,a.t1-1.4,a.t1-.3));
  if(show>0){
    const rows=[
      {label:'曹军水军（火攻前）',value:20,unit:'余万',bar:20,color:'#f0a58c',t0:T+7.0},
      {label:'焚溺之后（旁白口径）',value:1,decimals:0,bar:1.2,color:'#e8836a',t0:T+9.4},
    ];
    dataPanel(g,1500,742,rows,v,{title:'火攻之后 · 战损',rowh:62});
  }
}
function routWorld(g,v,a){
  const t0=a.t0,atk=range(v,t0+.3,t0+3.6);
  /* 周瑜主力压上：联军主帅与五路攻击箭头同现 */
  cmdCard(g,'zhouyu',700,798,38,'#67d9b3',v,a,.3,-19.9,.9,.9);
  if(atk>0){g.save();g.globalAlpha=atk;
    /* 周瑜主力压上：五路攻击箭头同时推进 */
    for(let i=0;i<5;i++)attackArrow(g,700+i*130,900,830+i*130,560,v+i*.4,'rgba(150,224,190,.9)',150,7);g.restore()}
  /* 主帅卡跟着曹军船阵北撤：与 drawFleets 同一偏移量（卡随部队走） */
  const sh=caoShift(v,a);
  const c1=range(v,t0+.2,t0+1.0)*(1-range(v,t0+1.8,t0+2.4));
  if(c1>0){const [z,cx,cy]=cameraFor(v),pf=screenFit(1240-sh*14,300-sh*62,38,z,cx,cy);
    if(pf>0){g.save();g.globalAlpha=c1*pf;circlePortrait(g,'cao',1240-sh*14,300-sh*62,38,'#d98067','曹操');g.restore()}}
  /* 烧船自退：残兵烧船后曹操在北岸露脸 */
  const c2=range(v,t0+12.4,t0+13.4)*(1-range(v,t0+16.4,t0+17.2));
  if(c2>0){const [z,cx,cy]=cameraFor(v),pf=screenFit(940,300,36,z,cx,cy);
    if(pf>0){g.save();g.globalAlpha=c2*pf;circlePortrait(g,'cao',940,300,36,'#d98067','曹操');g.restore()}}
  /* 黄盖中流矢堕江 · 韩当听声救起：两张卡贴在江面交战点上（口播 215s） */
  const hd=range(v,t0+6.2,t0+7.2)*(1-range(v,t0+10.6,t0+11.4));
  if(hd>0){const [z,cx,cy]=cameraFor(v),pf=screenFit(1080,700,24,z,cx,cy);
    if(pf>0){g.save();g.globalAlpha=hd*pf;circlePortrait(g,'handang',1076,698,24,'#67d9b3','韩当');g.restore()}
    const p2=screenFit(1146,728,22,z,cx,cy);
    if(p2>0){g.save();g.globalAlpha=hd*p2;circlePortrait(g,'huanggai',1146,728,22,'#d9b27b','黄盖');g.restore()}}
  /* 后面的攻击箭头：前头是火、后头是兵——追兵纵队贴着溃兵背后压上 */
  const back=range(v,t0+6.6,t0+8.2)*(1-range(v,t0+14.0,t0+15.0));
  if(back>0){g.save();g.globalAlpha=back*.85;
    for(let i=0;i<4;i++)attackArrow(g,700+i*140,1010,756+i*150,830,v+i*.4,'rgba(150,224,190,.85)',160,7);
    txt(g,'后头是兵',1290,890,26,'rgba(190,244,226,.95)',700);g.restore()}
  /* 联军江面防线高亮 */
  const dl=range(v,t0+.4,t0+2.0)*(1-range(v,t0+16.0,t0+18.0));
  if(dl>0){g.save();g.globalAlpha=dl;defenseLine(g,560,800,1360,620,v,'#7fd8bf','联军 · 江南');g.restore()}
}
function routUI(g,v,a){
  const t0=a.t0;
  const atk=range(v,t0+.5,t0+2.0)*(1-range(v,t0+6.0,t0+7.0));
  if(atk>0){g.save();g.globalAlpha=atk;txt(g,'周瑜主力压上',430,884,30,'rgba(190,244,226,.95)',700);g.restore()}
  const hit=range(v,t0+6.4,t0+7.6)*(1-range(v,t0+12.4,t0+13.4));
  if(hit>0){g.save();g.globalAlpha=hit;panel(g,1290,600,560,240,'rgba(26,20,15,.92)','rgba(214,150,120,.6)');
    txt(g,'黄盖中流矢堕江',1330,668,32,'#f0cfae',700);
    txt(g,'「此公覆声也」——韩当救起',1330,726,25,'rgba(224,220,204,.9)',500);
    txt(g,'《吴书》',1330,782,21,'rgba(180,176,160,.8)',400);g.restore()}
  const rd=range(v,t0+17.4,t0+19.8);
  if(rd>0){g.save();g.globalAlpha=rd*.96;
    g.fillStyle='rgba(52,40,26,.96)';g.fillRect(0,0,W,H);
    g.fillStyle='rgba(96,74,44,.9)';g.beginPath();
    g.moveTo(120,1080);g.bezierCurveTo(560,820,760,700,1180,560);g.lineTo(1260,620);g.bezierCurveTo(820,780,640,900,300,1080);g.closePath();g.fill();
    for(let i=0;i<26;i++){const x=180+i*40,y=1040-i*20;g.fillStyle='rgba(40,30,18,.75)';g.beginPath();g.ellipse(x,y,26,10,0,0,2*PI);g.fill()}
    /* 败兵沿华容道土路缓慢移动（羸兵填泥） */
    const ut=(v*0.5)%1;
    for(let i=0;i<9;i++){
      const p=Math.max(0,Math.min(1,(ut+i*.11)%1));
      const q=unitAt(PATH_HUARONG,p,0,1,0);
      g.fillStyle='rgba(30,22,14,.92)';g.beginPath();g.ellipse(q.x,q.y,17,8,0,0,2*PI);g.fill();
    }
    song(g,'华容道',700,470,72,'#f0dcb4',1,'center');
    txt(g,'路遇泥泞 · 羸兵负草填之 · 人马蹈藉死者甚众',700,556,26,'rgba(236,220,188,.95)',700,'center');
    txt(g,'《山阳公载记》',700,606,21,'rgba(198,184,156,.8)',400,'center');
    /* 华容道残军＝败退中的陆军：泥路旁标曹操 */
    circlePortrait(g,'cao',1100,660,24,'#d98067','曹操');g.restore()}
}
/* 真正败因（段10）：曹操自辩 letter 与四枚败因标签期，双方主帅分段露脸 */
function whyWorld(g,v,a){
  cmdCard(g,'cao',1240,300,38,'#d98067',v,a,.3,-9.4,1.0,1.0);
  cmdCard(g,'zhouyu',700,798,38,'#67d9b3',v,a,7.0,-12.35,.9,.9);
}
function whyUI(g,v,a){
  const t0=a.t0;
  const lt=range(v,t0+.3,t0+1.5)*(1-range(v,t0+4.8,t0+5.8));
  if(lt>0){g.save();g.globalAlpha=lt;letter(g,600,500,540,330,'曹操事后自辩',['「赤壁之役，值有疾病」','「孤烧船自退」'],'曹',-.05);g.restore()}
  const tags=[['大疫',''],['水土不服',''],['东南风','非定论'],['后方不稳','']];
  tags.forEach((s,i)=>{
    const k=range(v,t0+5.8+i*.85,t0+6.8+i*.85);if(k<=0)return;
    g.save();g.globalAlpha=k*(1-range(v,a.t1-.6,a.t1-.1));
    const x=1150,y=300+i*108;
    panel(g,x,y-40,560,80,'rgba(26,20,15,.94)','rgba(214,184,126,.6)',12);
    song(g,s[0],x+34,y,40,'#e8e2cf',1,'left');
    if(s[1])txt(g,s[1],x+520,y,22,'rgba(220,180,140,.9)',600,'right');
    g.restore();
  });
  const strike=range(v,t0+9.8,t0+10.6);
  if(strike>0){g.save();g.globalAlpha=strike;panel(g,1150,760,560,90,'rgba(52,22,20,.92)','rgba(214,120,96,.8)',12);
    song(g,'只败在火',1190,806,42,'rgba(232,226,210,.85)',1,'left');
    g.strokeStyle='#e0604a';g.lineWidth=6;g.beginPath();g.moveTo(1170,806);g.lineTo(1686,806);g.stroke();
    txt(g,'×',1700,802,52,'#e0604a',800,'center');g.restore()}
}
function splitWorld(g,v,a){
  const t0=a.t0;
  const k1=range(v,t0+.6,t0+1.8),k2=range(v,t0+2.6,t0+3.8),k3=range(v,t0+4.6,t0+5.8);
  const zone=(x,y,w,h,c,k,label)=>{
    if(k<=0)return;g.save();g.globalAlpha=k*.45;g.fillStyle=c;g.beginPath();g.roundRect(x,y,w,h,18);g.fill();g.restore();
    txt(g,label,x+w/2,y+h/2,34,'#fff6e4',800,'center');
  };
  zone(120,140,430,250,'#c47a4a',k1,'江陵 · 曹仁守');
  zone(120,640,530,300,'#c9a94a',k2,'荆南四郡 · 刘备');
  zone(1390,600,480,340,'#4aa88c',k3,'江东 · 孙权');
  /* 三方主帅卡各守各的地盘（跟着领地走）：曹仁·江陵 / 刘备·荆南 / 孙权·江东 */
  const cmd=(key,x,y,r,col,t0off,dur)=>{
    const kk=range(v,t0+t0off,t0+t0off+.9)*(1-range(v,t0+t0off+dur-.9,t0+t0off+dur));
    if(kk<=0)return;
    const [z,cx,cy]=cameraFor(v),pf=screenFit(x,y,r,z,cx,cy);
    if(pf<=0)return;
    g.save();g.globalAlpha=kk*pf;circlePortrait(g,key,x,y,r,col,CMD_NAMES[key]);g.restore()
  };
  cmd('caoren',335,178,34,'#c4563a',.8,3.4);
  cmd('liu',385,702,34,'#c9a94a',5.4,1.9);
  cmd('sunquan',1630,678,34,'#3fb894',7.4,2.4);
  /* 战后三方防线高亮：各守各的地盘，比箭头更克制 */
  const dl=range(v,t0+4.6,t0+6.4)*(1-range(v,a.t1-1.0,a.t1-.2));
  if(dl>0){g.save();g.globalAlpha=dl;
    defenseLine(g,120,390,560,390,v,'#e0a06a','曹 · 江陵一线');
    defenseLine(g,120,940,650,940,v,'#e6cf8a','刘 · 荆南');
    defenseLine(g,1390,940,1870,940,v,'#8fd8c0','孙 · 江东');g.restore()}
}
function splitUI(g,v,a){
  const k=range(v,a.t0+6.8,a.t1-.4);
  if(k>0){g.save();g.globalAlpha=k;song(g,'三分天下之势定',960,500,66,'rgba(248,238,214,.96)',1,'center');g.restore()}
}
function endWorld(g,v,a){
  const k=range(v,a.t0+.3,a.t0+1.8)*(1-range(v,a.t0+4.6,a.t0+5.6));
  if(k>0){g.save();g.globalAlpha=k;circlePortrait(g,'zhouyu',960,430,66,'#67d9b3','周瑜');g.restore()}
  /* 「曹操再难南征」与「四条软肋」两段：北岸主帅收尾露脸 */
  cmdCard(g,'cao',1240,300,38,'#d98067',v,a,31.9,-3.6,1.0,1.0);
  /* 孙权素服发丧（口播 266.8s 起）：与周瑜同框 */
  const sq=range(v,a.t0+4.4,a.t0+5.4)*(1-range(v,a.t0+9.4,a.t0+10.4));
  if(sq>0){const [z,cx,cy]=cameraFor(v),pf=screenFit(812,472,38,z,cx,cy);
    if(pf>0){g.save();g.globalAlpha=sq*pf;circlePortrait(g,'sunquan',812,472,38,'#67d9b3','孙权');g.restore()}}
}
function endUI(g,v,a){
  const t0=a.t0,d=Math.max(1,a.t1-t0);
  const k=range(v,t0+.5,t0+2.0)*(1-range(v,t0+4.6,t0+5.6));
  if(k>0){g.save();g.globalAlpha=k;
    txt(g,'三十六岁 · 病逝巴丘',960,552,32,'rgba(226,242,236,.95)',700,'center');
    txt(g,'「孤非周公瑾，不帝矣」',960,608,28,'rgba(200,232,220,.9)',500,'center');g.restore()}
  /* 四张卡严格跟着配音口播：进/出时码为段内秒（见 captions.json 274.1s 起） */
  const CARD=[
    ['草船借箭','赤壁后五年 · 濡须口 · 孙权事',10.37,16.37],
    ['登坛借东风','戏台上的戏说',16.47,20.07],
    ['华容道关羽放行','史书无此事',20.17,22.67],
    ['周瑜打黄盖','他递的是诈降信',22.77,25.57]
  ];
  CARD.forEach((c,i)=>{
    const k=range(v,t0+c[2]-1.2,t0+c[2]);
    if(k<=0)return;
    const al=k*(1-range(v,t0+c[3],t0+c[3]+1.0));
    if(al>0)yanyiCard(g,500+(i%2)*930,300+Math.floor(i/2)*330,760,190,c[0],c[1],1-k,al);
  });
  const tail=a.t1-9.4;
  const fin=range(v,tail,tail+1.8)*(1-range(v,a.t1-4.6,a.t1-3.4));
  if(fin>0){g.save();g.globalAlpha=fin;song(g,'分清演义与真事',960,520,64,'rgba(248,238,214,.96)',1,'center');g.restore()}
  const brand=range(v,a.t1-4.2,a.t1-2.4);
  if(brand>0){g.save();g.globalAlpha=brand;
    g.fillStyle='rgba(4,18,22,.74)';g.fillRect(0,0,W,H);
    circlePortrait(g,'xualan',960,462,96,'#e9ca8a');
    song(g,'徐艾伦 · 图说战史',960,632,56,'#f7ecd3',1,'center');
    txt(g,'赤壁之战 · 完整版',960,704,30,'rgba(226,222,200,.9)',600,'center');g.restore()}
}

/* 段 2..13 的世界层 / 屏幕层 */
const WORLD=[forceWorld,marchWorld,standWorld,weakWorld,planWorld,windWorld,fireWorld,burnWorld,routWorld,whyWorld,splitWorld,endWorld];
const UI=[forcePanel,marchUI,null,weakUI,planUI,windUI,fireUI,burnUI,routUI,whyUI,splitUI,endUI];

/* ================= 镜头表：按口播节拍快推到「正在说话的一方」 =================
   [段, 段内偏移秒, 缩放, 中心x, 中心y, 镜头名, 阵营]
   开打前谁被点名就推向谁；开打后在曹营与联军之间来回切。
   中心点在建表时夹在无黑边范围内（W/2z..W-W/2z）：边角城邑会被推近而不能居中，
   这是固定画幅下的取舍，靠镜头名与势力标补读。 */
const SHOT_DEFS=[
  /* 0 钩子 0–19.6 */
  [0,0.00,1.00,960,540,'开场 · 全图',null],
  [0,4.78,1.18,814,457,'曹操南下','cao'],
  [0,6.72,1.30,900,665,'周瑜 · 江东军','sun'],
  [0,7.64,1.25,1152,500,'刘备 · 夏口','liu'],
  [0,9.70,1.35,1030,400,'曹军水军','cao'],
  [0,13.50,1.42,1000,500,'那把火不是诸葛亮','sun'],
  /* 1 兵力账 */
  [1,0.00,1.10,960,540,'先算账 · 两军',null],
  [1,0.78,1.28,1050,430,'八十万 · 恐吓','cao'],
  [1,6.30,1.35,711,680,'周瑜算账','sun'],
  [1,8.12,1.18,1000,470,'北方兵十五六万','cao'],
  [1,16.06,1.22,900,638,'联军五万','sun'],
  [1,17.34,1.28,780,658,'孙权三万','sun'],
  [1,18.02,1.28,1150,420,'刘备两万','liu'],
  [1,19.24,1.06,960,540,'五万迎二十万',null],
  /* 2 怎么碰上的 */
  [2,0.00,1.02,960,540,'两家怎么撞上',null],
  [2,2.02,1.20,800,450,'曹操平荆州','cao'],
  [2,6.56,1.40,760,430,'荆州水军归曹','cao'],
  [2,12.80,1.22,1133,443,'刘备退夏口','liu'],
  [2,16.80,1.30,711,665,'孙权朝堂','sun'],
  [2,24.18,1.30,960,600,'拔刀斫案','sun'],
  /* 3 对峙与初战 */
  [3,0.00,1.22,760,660,'周瑜逆江而上','sun'],
  [3,5.23,1.40,1128,694,'樊口会师',null],
  [3,7.21,1.18,900,622,'联军江南摆开','sun'],
  [3,9.17,1.28,1030,450,'曹军乌林列阵','cao'],
  [3,11.59,1.15,900,520,'第一次交手',null],
  [3,14.67,1.35,950,640,'小船贴舷','sun'],
  [3,17.33,1.35,980,400,'北兵晕船','cao'],
  [3,21.43,1.22,1000,443,'退回江北','cao'],
  /* 4 曹军的软肋 */
  [4,0.00,1.30,980,415,'毛病全露','cao'],
  [4,2.23,1.35,1050,450,'军中疫病','cao'],
  [4,9.19,1.45,980,470,'不习舟船','cao'],
  [4,14.86,1.45,1000,470,'首尾相接','cao'],
  [4,18.52,1.25,1100,520,'铁索＝演义','cao'],
  /* 5 黄盖献计 */
  [5,0.00,1.30,1100,650,'黄盖献计','sun'],
  [5,3.44,1.40,1000,450,'一艘着火全阵烧','cao'],
  [5,8.96,1.10,960,520,'诈降书',null],
  [5,14.94,1.28,1030,430,'曹操盘问信使','cao'],
  /* 6 火船与风 */
  [6,0.00,1.06,960,540,'十艘火船',null],
  [6,8.36,1.20,1120,540,'等风转向','sun'],
  [6,12.67,1.32,1150,640,'黄盖押风','sun'],
  /* 7 点火与撞阵 */
  [7,0.00,1.25,1050,590,'二里余点火',null],
  [7,2.48,1.45,1150,650,'同时发火','sun'],
  [7,8.14,1.40,1000,440,'延颈观望','cao'],
  [7,12.72,1.35,960,490,'撞入船阵',null],
  [7,16.40,1.30,1070,640,'点火撤离','sun'],
  [7,18.60,1.45,970,500,'撞哪儿烧哪儿',null],
  /* 8 火烧连营 */
  [8,0.00,1.40,1000,450,'首尾相连散不开','cao'],
  [8,4.66,1.45,1000,460,'火沿缆绳','cao'],
  [8,9.38,1.12,980,520,'一条火龙',null],
  [8,11.25,1.30,950,540,'跳水又爬船',null],
  [8,18.87,1.30,1000,415,'延烧乌林营寨','cao'],
  /* 9 溃退与华容道 */
  [9,0.00,1.25,900,648,'周瑜主力压上','sun'],
  [9,2.49,1.15,950,500,'前头火后头兵',null],
  [9,6.73,1.08,960,540,'黄盖中箭','sun'],
  [9,13.36,1.22,850,443,'曹操烧船北撤','cao'],
  [9,18.40,1.20,900,500,'华容道','cao'],
  /* 10 真正败因 */
  [10,0.00,1.05,900,500,'曹操嘴硬','cao'],
  [10,7.20,1.15,800,640,'周瑜名声','sun'],
  [10,8.94,1.05,960,540,'真不光是火',null],
  [10,11.75,1.25,1000,430,'大疫','cao'],
  [10,16.95,1.10,960,540,'东南风非定论',null],
  /* 11 战后格局 */
  [11,0.00,1.02,960,540,'战后格局',null],
  [11,1.20,1.25,820,432,'曹仁守江陵','cao'],
  [11,5.76,1.30,711,680,'刘备取荆南',null],
  [11,7.78,1.30,1182,650,'孙权守江东',null],
  [11,9.98,1.00,960,540,'三分天下',null],
  /* 12 结尾与演义对照 */
  [12,0.00,1.10,1000,420,'曹操再难南征','cao'],
  [12,1.10,1.30,960,520,'周瑜病逝巴丘','sun'],
  [12,4.76,1.40,960,500,'孙权悼周瑜','sun'],
  [12,9.58,1.00,960,540,'演义对照',null],
  [12,26.15,1.12,900,620,'真正胜负手','sun'],
  [12,32.17,1.15,1000,450,'四条软肋','cao'],
  [12,36.11,1.04,960,540,'以少胜多',null],
  [12,38.63,1.08,960,540,'水 · 病 · 气候',null],
  [12,43.13,1.00,960,540,'片尾',null],
];
let SHOTS=null;
function buildShots(){
  SHOTS=[];
  for(const [k,off,z,cx,cy,label,fac] of SHOT_DEFS){
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
  const whip=Math.min(.6,Math.max(.28,span*.42));
  let p=1;
  if(i>0){
    const q=Math.min(1,Math.max(0,(t-cur.t0)/whip));
    p=.86*smooth(q)+.14*Math.min(1,Math.max(0,(t-cur.t0-whip)/Math.max(.25,span-whip)));
  }
  const z0=prev.z+(cur.z-prev.z)*p;
  const cx0=prev.cx+(cur.cx-prev.cx)*p,cy0=prev.cy+(cur.cy-prev.cy)*p;
  /* 镜头呼吸：切镜落稳后仍有极慢的推拉与游移，画面不再定格。
     钩子段 1 秒抖动结束后才起，避免和砸屏抢戏。 */
  const br=range(t,1.2,4.2);
  const z=z0*(1+.011*Math.sin(t*.47+1.1)*br);
  const cx=cx0+(26*Math.sin(t*.29+.6)+9*Math.sin(t*.73+2.2))*br;
  const cy=cy0+(15*Math.sin(t*.23+1.9)+6*Math.sin(t*.61+.4))*br;
  const hx=W/(2*z),hy=H/(2*z);
  return [z,Math.min(W-hx,Math.max(hx,cx)),Math.min(H-hy,Math.max(hy,cy))];
}
/* 切镜速度线：快推前 0.48 秒从画外向内收，强化运镜冲击但不过火 */
function whipFX(g,t){
  if(!SHOTS||!SHOTS.length)return;
  const cur=shotAt(t);if(cur.i===0)return;
  const q=(t-cur.t0)/.48;
  if(q<0||q>1)return;
  g.save();g.globalAlpha=Math.pow(1-q,2)*.18;
  for(let i=0;i<18;i++){
    const ang=i*Math.PI*2/18+.13,r0=560+((i*53)%120),r1=980+((i*97)%220);
    line(g,W/2+Math.cos(ang)*r0,H/2+Math.sin(ang)*r0,
      W/2+Math.cos(ang)*r1,H/2+Math.sin(ang)*r1,'rgba(244,238,214,.9)',2.2);
  }
  g.restore();
}
/* 缓慢扫过地图的侧光：即便镜头静止，画面也有持续的光影流动。
   用 lighter（叠加）而非 overlay：软件光栅下 overlay 全屏混合会慢一个数量级。 */
function lightSweep(g,t){
  const x=W*(.5+.42*Math.sin(t*.041+.8)),y=H*(.36+.16*Math.sin(t*.057+2.0));
  g.save();g.globalCompositeOperation='lighter';
  const gr=g.createRadialGradient(x,y,30,x,y,820);
  gr.addColorStop(0,'rgba(255,232,184,.075)');gr.addColorStop(.55,'rgba(255,210,150,.034)');gr.addColorStop(1,'rgba(255,200,140,0)');
  g.fillStyle=gr;g.fillRect(0,0,W,H);g.restore();
}

/* ================= 双军阵位（世界层） ================= */
function drawFleets(g,v){
  const a=actOf(v);if(!ACTS)return;
  const hook=a.i===0&&v>=4.6;             /* 开场点名两军时就让船队入画 */
  if(a.i<3&&!hook)return;
  const inn=hook?range(v,4.6,6.6):range(v,ACTS[3].t0-1.0,ACTS[3].t0+.8);
  const gone=1-range(v,ACTS[9].t0,ACTS[9].t0+2.2);   /* 火攻之后水军已没：船队与幡一同撤出，后段地图只剩陆上格局 */
  const sh=caoShift(v,a);
  g.save();g.globalAlpha=inn*gone;
  caoboats.forEach(([x,y],k)=>boat(g,x-sh*14,y-sh*62+Math.sin(v*1.55+k*.9)*1.4,
    -.08+Math.sin(v*1.15+k*.7)*.012,.91,k%3===0?'#8f493a':'#9f5845',0));
  allyboats.forEach(([x,y],k)=>boat(g,x,y+Math.sin(v*1.7+k*.8)*1.2,
    -2.2+Math.sin(v*1.25+k*.6)*.012,1.0,'#4cae94',0,''));
  g.restore();
  const [z,cx,cy]=cameraFor(v);
  const pc=screenFit(612,194+77,58,z,cx,cy),ps=screenFit(1420,846+77,58,z,cx,cy);
  if(pc>0){g.save();g.globalAlpha=inn*gone*pc;pennant(g,612,194,'曹军水师','#c86550',v);g.restore()}
  if(ps>0){g.save();g.globalAlpha=inn*gone*ps;pennant(g,1420,846,'周瑜水师','#3fb894',v);g.restore()}
  /* 水军主帅卡统一由 drawFactionLabels 在剧情卡之后补，同一帧同一人只留一张。 */
}

/* ================= 主绘制 ================= */
let grainTiles=null,embers=null;

mount({
  slug:'chibi-full',
  assets,
  captions:[],
  seconds:FILM,
  /* 画面直接按配音时间编排，不改变节奏：映射用恒等，只在配音之后追加片尾时长，
     否则 renderAt 会把 t 钳在配音总长上，片尾品牌卡永远到不了全亮。 */
  buildTimeline(starts,dur){return {warp:t=>t,filmEnd:dur+TAIL}},
  prepare(api){
    if(api.captions&&api.captions.length){
      const acts=buildActs(api.captions,api.filmEnd);
      if(acts){ACTS=acts;FILM=api.filmEnd;HOOK_END=Math.min(3.2,(api.captions[1]?api.captions[1][1]:3.0))}
    }
    grainTiles=makeGrain();
    embers=makeEmbers(9001,600,900,420,120,110);
    buildAncientMap();
    makeCurrents();
    buildShots();
    if(typeof window!=='undefined'&&window.tushuo)window.tushuo.shots=SHOTS;
  },
  draw(g,{t,v,captions,cover=false}){
    const a=actOf(v),k=a.i;
    const [z,cx,cy]=cameraFor(v);
    g._cmdSeen=new Set();   /* 本帧已出场的主帅（alpha 足够高），势力/水军小卡据此避让 */
    g.fillStyle='#171310';g.fillRect(0,0,W,H);   /* 地图垫底，夹紧后理论上不露边 */
    /* 开场镜头地震：0–1.0s 整画面跟着抖（世界/标绘/图例/颗粒一起，制造砸屏感） */
    const hs=hookShake(v);
    g.save();
    if(hs){g.translate(W/2,H/2);g.rotate(hs.rot);g.scale(hs.sc,hs.sc);g.translate(-W/2,-H/2);g.translate(hs.x,hs.y)}
    g.save();g.translate(W/2,H/2);g.scale(z,z);g.translate(-cx,-cy);
    g.drawImage(off,0,0);
    drawTerritories(g,v);
    drawCurrents(g,v);
    drawFleets(g,v);
    if(k===0){if(!cover)hookWorld(g,v,a)}else if(WORLD[k-1])WORLD[k-1](g,v,a);
    if(!cover)drawFactionLabels(g,v);
    g.restore();
    lightSweep(g,v);
    whipFX(g,v);
    if(!cover){   /* 封面模式只留战场画面，不叠字幕/图例/势力卡/信息面板 */
      if(k===0)hookUI(g,v,a);
      else{
        bannerKey(g,ACT_KEYS[k],fade(v,a.t0-.2,a.t0+.9,a.t0+4.6,a.t0+5.8));
        if(UI[k-1])UI[k-1](g,v,a);
      }
    }
    postFXBase(g,v,grainTiles);
    if(k>=7&&k<=9){const al=range(v,ACTS[7].t0,ACTS[7].t0+2)*(1-range(v,ACTS[9].t0+3,ACTS[9].t0+6));
      if(al>0)drawEmbers(g,v,embers,al)}
    if(!cover){
      factionLegend(g,territoryAlpha(v));
      if(!(k===0&&v<HOOK_END+.6))drawCaption(g,t,captions);
      txt(g,'东汉建安十三年 · 相对阵位示意 / 地望有争议',64,1029,20,'rgba(231,225,196,.73)',500);
    }
    g.restore();
  },
});
