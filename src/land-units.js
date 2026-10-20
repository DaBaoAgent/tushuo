/* tushuo · 陆军单位图元
   官渡是陆战：营寨、方阵、骑兵、辎重、粮道、土山箭楼、夜袭火把。
   这里只提供可组合的「兵棋符号」与少量动画，具体阵位和节奏由 scene-<slug>.js 编排。
   所有图元都是纯函数：给定 t 与 seed 画同一帧，绝不使用 Math.random。 */

import {PI,smooth,HEI} from './engine.js';
import {buildPath,pointAtPath,tangentAtPath,tracePath} from './terrain.js';

export {buildPath,pointAtPath,tangentAtPath,tracePath};

/* ================= 小工具 ================= */
const clamp01=x=>Math.max(0,Math.min(1,x));
function wave(i,seed,f=12.9898){return Math.sin(i*f+seed*1.731)*.5+.5}

/* 单个兵：小盾＋盔＋一支斜出的矛。俯视符号，尺寸 6–9px，
   在总览镜头能读成队列，在近景也不至于变成一坨色块。 */
export function soldier(g,x,y,color,opt={}){
  const s=opt.scale??1,dir=opt.dir??0;
  g.save();g.translate(x,y);g.rotate(dir);
  g.fillStyle='rgba(18,16,10,.22)';
  g.beginPath();g.ellipse(.6*s,2.2*s,4.2*s,2.4*s,0,0,PI*2);g.fill();
  g.strokeStyle=opt.spearColor||'rgba(48,38,24,.9)';g.lineWidth=1.15*s;g.lineCap='round';
  g.beginPath();g.moveTo(2*s,1*s);g.lineTo(7.5*s,-8.5*s);g.stroke();
  g.fillStyle=color;g.beginPath();g.roundRect(-3*s,-3*s,6*s,6*s,1.6*s);g.fill();
  g.fillStyle=opt.helmet||'rgba(241,232,207,.92)';
  g.beginPath();g.arc(0,-3.7*s,1.65*s,0,PI*2);g.fill();
  g.restore();
}

export function unitTag(g,text,x,y,color,opt={}){
  const size=opt.size||18,padX=opt.padX??10,padY=opt.padY??5;
  g.save();g.globalAlpha*=opt.alpha??1;
  g.font=`600 ${size}px ${HEI}`;
  const w=g.measureText(text).width+padX*2,h=size+padY*2;
  g.fillStyle=opt.fill||'rgba(12,24,26,.86)';
  g.beginPath();g.roundRect(x-w/2,y-h/2,w,h,5);g.fill();
  g.strokeStyle=color;g.lineWidth=1.2;g.stroke();
  g.fillStyle=opt.color||'#f6edda';g.textAlign='center';g.textBaseline='middle';g.fillText(text,x,y+1);
  g.restore();
}

/* ================= 步兵方阵 ================= */
export function infantryBlock(g,x,y,w,h,color,opt={}){
  const alpha=opt.alpha??1;if(alpha<=0)return;
  const cols=opt.cols||Math.max(3,Math.round(w/15));
  const rows=opt.rows||Math.max(2,Math.round(h/13));
  const seed=opt.seed||1;
  g.save();g.globalAlpha*=alpha;
  g.fillStyle=opt.fill||'rgba(38,30,18,.22)';
  g.beginPath();g.roundRect(x-w/2,y-h/2,w,h,4);g.fill();
  g.globalAlpha*=.6;g.strokeStyle=color;g.lineWidth=1.4;
  g.beginPath();g.roundRect(x-w/2,y-h/2,w,h,4);g.stroke();
  g.globalAlpha/=.6;
  const dir=opt.dir??0;
  const stepX=w/(cols+.6),stepY=h/(rows+.6);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const sx=x-w/2+stepX*(c+.8)+(wave(r*cols+c,seed)-.5)*1.8;
    const sy=y-h/2+stepY*(r+.8)+(wave(r*cols+c,seed+3)-.5)*1.4;
    soldier(g,sx,sy,opt.bodyColor||color,{scale:opt.scale??.86,dir,helmet:opt.helmet,shield:opt.shield});
  }
  if(opt.flag!==false){
    const fx=x-w/2+4,fy=y-h/2+2;
    g.strokeStyle='rgba(60,46,28,.9)';g.lineWidth=1.6;
    g.beginPath();g.moveTo(fx,fy+4);g.lineTo(fx,fy-22);g.stroke();
    g.fillStyle=color;g.beginPath();g.moveTo(fx,fy-22);g.lineTo(fx+15,fy-18);g.lineTo(fx,fy-13);g.closePath();g.fill();
  }
  if(opt.label)unitTag(g,opt.label,x,y+h/2+(opt.labelGap??17),color,{size:opt.labelSize||17});
  g.restore();
}

/* ================= 骑兵 ================= */
export function horse(g,x,y,color,opt={}){
  const s=opt.scale??1;
  g.save();g.translate(x,y);
  if(opt.flip)g.scale(-1,1);
  g.fillStyle=opt.body||color;
  g.beginPath();g.ellipse(0,0,5.6*s,2.9*s,0,0,PI*2);g.fill();
  g.beginPath();g.moveTo(4*s,-1.4*s);g.lineTo(7.4*s,-6*s);g.lineTo(9.2*s,-5*s);g.lineTo(6.2*s,.6*s);g.closePath();g.fill();
  g.strokeStyle=opt.legs||'rgba(44,34,22,.9)';g.lineWidth=1.1*s;g.lineCap='round';
  g.beginPath();g.moveTo(-3.4*s,2*s);g.lineTo(-4.2*s,5.4*s);g.moveTo(2.8*s,2*s);g.lineTo(3.4*s,5.4*s);g.stroke();
  g.fillStyle='rgba(242,232,207,.94)';g.beginPath();g.arc(-.4*s,-4*s,1.7*s,0,PI*2);g.fill();
  g.restore();
}
export function cavalry(g,x,y,w,h,color,opt={}){
  const alpha=opt.alpha??1;if(alpha<=0)return;
  const cols=opt.cols||Math.max(2,Math.round(w/26));
  const rows=opt.rows||Math.max(2,Math.round(h/20));
  const seed=opt.seed||7;
  g.save();g.globalAlpha*=alpha;
  g.fillStyle=opt.fill||'rgba(38,30,18,.18)';
  g.beginPath();g.roundRect(x-w/2,y-h/2,w,h,4);g.fill();
  g.globalAlpha*=.55;g.strokeStyle=color;g.lineWidth=1.4;
  g.beginPath();g.roundRect(x-w/2,y-h/2,w,h,4);g.stroke();
  g.globalAlpha/=.55;
  const stepX=w/(cols+.8),stepY=h/(rows+.8);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const sx=x-w/2+stepX*(c+.9)+(wave(r*cols+c,seed)-.5)*3;
    const sy=y-h/2+stepY*(r+.9)+(wave(r*cols+c,seed+9)-.5)*2.4;
    horse(g,sx,sy,color,{scale:opt.scale??.9,body:color});
  }
  if(opt.flag!==false){
    const fx=x-w/2+6,fy=y-h/2+4;
    g.strokeStyle='rgba(60,46,28,.9)';g.lineWidth=1.6;
    g.beginPath();g.moveTo(fx,fy+4);g.lineTo(fx,fy-24);g.stroke();
    g.fillStyle=color;g.beginPath();g.moveTo(fx,fy-24);g.lineTo(fx+17,fy-19);g.lineTo(fx,fy-14);g.closePath();g.fill();
  }
  if(opt.label)unitTag(g,opt.label,x,y+h/2+(opt.labelGap??17),color,{size:opt.labelSize||17});
  g.restore();
}

/* ================= 辎重车 ================= */
export function baggageCart(g,x,y,a=0,opt={}){
  const s=opt.scale??1;
  g.save();g.globalAlpha*=opt.alpha??1;g.translate(x,y);g.rotate(a);g.scale(s,s);
  g.fillStyle='rgba(18,16,10,.24)';g.beginPath();g.ellipse(0,4,20,5,0,0,PI*2);g.fill();
  /* 牛 */
  g.fillStyle=opt.ox||'#5d4a32';
  g.beginPath();g.ellipse(-16,0,8,4.4,0,0,PI*2);g.fill();
  g.beginPath();g.moveTo(-22,-2);g.lineTo(-27,-6);g.lineTo(-25,0);g.closePath();g.fill();
  g.strokeStyle='rgba(44,34,22,.85)';g.lineWidth=1.3;
  g.beginPath();g.moveTo(-20,3);g.lineTo(-20,7);g.moveTo(-13,3);g.lineTo(-13,7);g.stroke();
  /* 车 */
  g.fillStyle='#6b4a2c';g.fillRect(-6,-8,23,10);
  g.strokeStyle='rgba(40,28,16,.9)';g.lineWidth=1.4;g.strokeRect(-6,-8,23,10);
  g.fillStyle='rgba(226,208,168,.95)';
  for(let i=0;i<3;i++){g.beginPath();g.arc(-1+i*7,-9,3.2,0,PI*2);g.fill()}
  g.strokeStyle='rgba(40,28,16,.9)';g.beginPath();g.arc(12,4,5,0,PI*2);g.stroke();
  g.beginPath();g.moveTo(12,0);g.lineTo(12,8);g.moveTo(8,4);g.lineTo(16,4);g.stroke();
  g.restore();
}

/* ================= 营寨 ================= */
function tentSymbol(g,x,y,s,color,opt={}){
  g.save();g.translate(x,y);
  g.fillStyle=opt.fill||'rgba(238,228,202,.94)';
  g.beginPath();g.moveTo(0,-11*s);g.lineTo(-9*s,7*s);g.lineTo(9*s,7*s);g.closePath();g.fill();
  g.strokeStyle=color;g.lineWidth=1.5;g.stroke();
  g.fillStyle='rgba(56,40,24,.62)';
  g.beginPath();g.moveTo(0,-2*s);g.lineTo(-3*s,7*s);g.lineTo(3*s,7*s);g.closePath();g.fill();
  g.strokeStyle='rgba(60,46,28,.8)';g.lineWidth=1.2;
  g.beginPath();g.moveTo(0,-11*s);g.lineTo(0,-16*s);g.stroke();
  g.fillStyle=color;g.beginPath();g.moveTo(0,-16*s);g.lineTo(6*s,-13.6*s);g.lineTo(0,-11.5*s);g.closePath();g.fill();
  g.restore();
}
export function camp(g,x,y,w,h,color,opt={}){
  const alpha=opt.alpha??1;if(alpha<=0)return;
  const seed=opt.seed||3,t=opt.t||0;
  g.save();g.globalAlpha*=alpha;
  g.fillStyle=opt.ground||'rgba(92,72,44,.16)';
  g.beginPath();g.roundRect(x-w/2,y-h/2,w,h,8);g.fill();
  /* 栅栏：虚线示意木寨，四角加桩 */
  g.strokeStyle=color;g.lineWidth=2.2;g.setLineDash([8,5]);
  g.beginPath();g.roundRect(x-w/2,y-h/2,w,h,8);g.stroke();g.setLineDash([]);
  g.strokeStyle='rgba(62,46,28,.85)';g.lineWidth=2;g.lineCap='round';
  const step=18;
  for(let px=x-w/2;px<=x+w/2;px+=step){
    g.beginPath();g.moveTo(px,y-h/2-3);g.lineTo(px,y-h/2+3);g.stroke();
    g.beginPath();g.moveTo(px,y+h/2-3);g.lineTo(px,y+h/2+3);g.stroke();
  }
  for(let py=y-h/2;py<=y+h/2;py+=step){
    g.beginPath();g.moveTo(x-w/2-3,py);g.lineTo(x-w/2+3,py);g.stroke();
    g.beginPath();g.moveTo(x+w/2-3,py);g.lineTo(x+w/2+3,py);g.stroke();
  }
  /* 营门：南侧留缺口，用两段深色短柱标出 */
  g.strokeStyle=color;g.lineWidth=3;
  g.beginPath();g.moveTo(x-16,y+h/2);g.lineTo(x-16,y+h/2+6);g.moveTo(x+16,y+h/2);g.lineTo(x+16,y+h/2+6);g.stroke();
  /* 帐篷 */
  const tents=opt.tents??6,cols=opt.tentCols||3;
  const rows=Math.ceil(tents/cols);
  const padX=w*.16,padY=h*.20;
  let n=0;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    if(n>=tents)break;
    const tx=x-padX+ (cols===1?0:(c/(cols-1))*padX*2)+(wave(n,seed)-.5)*8;
    const ty=y-padY+ (rows===1?0:(r/(rows-1))*padY*1.5)+(wave(n,seed+5)-.5)*6;
    tentSymbol(g,tx,ty,opt.tentScale??1,color,{fill:opt.tentFill});
    n++;
  }
  /* 中军大帐 */
  if(opt.bigTent!==false){
    const bx=x,by=y-h*.28;
    g.fillStyle='rgba(238,228,202,.96)';
    g.beginPath();g.moveTo(bx,by-17);g.lineTo(bx-15,by+9);g.lineTo(bx+15,by+9);g.closePath();g.fill();
    g.strokeStyle=color;g.lineWidth=2;g.stroke();
    g.fillStyle='rgba(56,40,24,.6)';
    g.beginPath();g.moveTo(bx,by-4);g.lineTo(bx-5,by+9);g.lineTo(bx+5,by+9);g.closePath();g.fill();
    g.strokeStyle='rgba(60,46,28,.85)';g.lineWidth=2;
    g.beginPath();g.moveTo(bx,by-17);g.lineTo(bx,by-40);g.stroke();
    const sway=Math.sin(t*2.2+bx*.01)*3;
    g.fillStyle=color;g.beginPath();g.moveTo(bx,by-40);g.lineTo(bx+18+sway,by-35);g.lineTo(bx,by-29);g.closePath();g.fill();
  }
  if(opt.label)unitTag(g,opt.label,x,y-h/2-(opt.labelGap??18),color,{size:opt.labelSize||19});
  g.restore();
}

/* ================= 箭楼 / 土山 ================= */
export function watchtower(g,x,y,opt={}){
  const s=opt.scale??1,t=opt.t||0;
  g.save();g.globalAlpha*=opt.alpha??1;g.translate(x,y);g.scale(s,s);
  g.fillStyle='rgba(18,16,10,.22)';g.beginPath();g.ellipse(0,2,13,4,0,0,PI*2);g.fill();
  g.strokeStyle=opt.color||'#6f4b2d';g.lineWidth=2.2;g.lineCap='round';
  g.beginPath();g.moveTo(-9,0);g.lineTo(-4,-30);g.moveTo(9,0);g.lineTo(4,-30);g.stroke();
  g.lineWidth=1.4;
  g.beginPath();g.moveTo(-7,-14);g.lineTo(7,-14);g.moveTo(-6,-22);g.lineTo(6,-22);g.stroke();
  g.fillStyle='rgba(226,210,172,.95)';g.fillRect(-11,-38,22,9);
  g.strokeStyle='rgba(60,46,28,.9)';g.lineWidth=1.8;g.strokeRect(-11,-38,22,9);
  g.fillStyle='rgba(88,62,36,.95)';
  g.beginPath();g.moveTo(-13,-38);g.lineTo(0,-48);g.lineTo(13,-38);g.closePath();g.fill();
  const sway=Math.sin(t*2.4+x*.01)*2;
  g.strokeStyle='rgba(60,46,28,.8)';g.lineWidth=1.2;
  g.beginPath();g.moveTo(0,-48);g.lineTo(0,-60);g.stroke();
  g.fillStyle=opt.flag||opt.color||'#b4553e';
  g.beginPath();g.moveTo(0,-60);g.lineTo(11+sway,-56);g.lineTo(0,-52);g.closePath();g.fill();
  g.restore();
}
export function earthworks(g,x,y,w,h,opt={}){
  const alpha=opt.alpha??1;if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;
  g.fillStyle=opt.fill||'rgba(122,96,60,.55)';
  g.beginPath();
  g.moveTo(x-w/2,y+h/2);g.quadraticCurveTo(x-w*.28,y-h*.6,x,y-h*.55);
  g.quadraticCurveTo(x+w*.28,y-h*.6,x+w/2,y+h/2);g.closePath();g.fill();
  g.strokeStyle='rgba(64,50,30,.72)';g.lineWidth=2;g.stroke();
  g.globalAlpha*=.6;g.strokeStyle='rgba(52,40,24,.55)';g.lineWidth=1.1;
  for(let i=1;i<=3;i++){
    g.beginPath();
    g.moveTo(x-w*.42+i*w*.05,y+h/2-i*h*.10);
    g.quadraticCurveTo(x,y-h*.46+i*h*.10,x+w*.42-i*w*.05,y+h/2-i*h*.10);
    g.stroke();
  }
  g.globalAlpha/=.6;
  if(opt.label)unitTag(g,opt.label,x,y-h*.62,opt.color||'#8a6a42',{size:opt.labelSize||17});
  g.restore();
}

/* ================= 火与烟 ================= */
export function fireGlow(g,x,y,r,t=0,intensity=1,opt={}){
  if(intensity<=0)return;
  const fl=.86+.14*Math.sin(t*8.3+x*.03)+.07*Math.sin(t*19.1+y*.017);
  g.save();g.globalCompositeOperation='lighter';
  const gr=g.createRadialGradient(x,y,r*.05,x,y,r*fl);
  const c=opt.color||[255,152,64];
  gr.addColorStop(0,`rgba(255,246,206,${.52*intensity})`);
  gr.addColorStop(.24,`rgba(${c[0]},${c[1]},${c[2]},${.34*intensity})`);
  gr.addColorStop(.62,`rgba(${c[0]},${Math.max(60,c[1]-40)},40,${.16*intensity})`);
  gr.addColorStop(1,'rgba(120,40,10,0)');
  g.fillStyle=gr;g.beginPath();g.arc(x,y,r*fl,0,PI*2);g.fill();
  g.restore();
}
export function torch(g,x,y,t=0,opt={}){
  const s=opt.scale??1;
  const fl=.82+.18*Math.sin(t*13+x*.37)+.07*Math.sin(t*29+y*.11);
  if(opt.glow!==false)fireGlow(g,x,y,34*s,t,.55*(opt.alpha??1),{color:[255,160,70]});
  g.save();g.globalAlpha*=opt.alpha??1;g.translate(x,y);g.scale(s,s);
  g.strokeStyle='rgba(52,38,22,.92)';g.lineWidth=1.8;g.lineCap='round';
  g.beginPath();g.moveTo(0,8);g.lineTo(0,-7);g.stroke();
  for(let k=0;k<3;k++){
    const fx=(k-1)*2.2,wob=Math.sin(t*11+k*2.1+x*.2)*1.6;
    const hgt=11+4*Math.sin(t*9+k*1.7);
    g.fillStyle=k===1?'#ffe1a0':'#ff9a45';
    g.beginPath();g.moveTo(fx-2.2,1);g.quadraticCurveTo(fx-2.8+wob,-hgt*.55,fx+wob,-7-hgt);
    g.quadraticCurveTo(fx+2.2+wob,-hgt*.55,fx+2.2,1);g.closePath();g.fill();
  }
  g.restore();
}
export function fireCluster(g,x,y,w,h,t=0,intensity=1,opt={}){
  if(intensity<=0)return;
  const seed=opt.seed||11;
  const A=g.globalAlpha*(opt.alpha??1);
  fireGlow(g,x,y,Math.max(w,h)*1.15,t,intensity,{color:[255,140,50]});
  g.save();g.globalAlpha=A;
  /* 火底：粮囤与木栅被烧亮的暖色块 */
  const base=g.createRadialGradient(x,y,4,x,y,Math.max(w,h)*.62);
  base.addColorStop(0,`rgba(255,214,128,${.48*intensity})`);
  base.addColorStop(.55,`rgba(236,108,44,${.26*intensity})`);
  base.addColorStop(1,'rgba(110,34,8,0)');
  g.fillStyle=base;g.beginPath();g.ellipse(x,y,w*.68,h*.58,0,0,PI*2);g.fill();
  /* 火舌：固定种子的多点，逐个随时间摆高 */
  for(let i=0;i<15;i++){
    const u=wave(i,seed)-.5,v=wave(i,seed+7)-.5;
    const bx=x+u*w*.8,by=y+v*h*.55+Math.sin(t*2.2+i)*2;
    const hh=(20+26*wave(i,seed+3))*intensity*(.85+.15*Math.sin(t*9+i*1.9));
    const wob=Math.sin(t*7+i*2.3)*4;
    g.fillStyle=i%3===0?'#ffe2a6':i%3===1?'#ff9d49':'#f4692f';
    g.beginPath();g.moveTo(bx-5,by+4);
    g.quadraticCurveTo(bx-7+wob,by-hh*.55,bx+wob,by-hh);
    g.quadraticCurveTo(bx+6+wob,by-hh*.55,bx+5,by+4);
    g.closePath();g.fill();
  }
  /* 火星 */
  for(let i=0;i<14;i++){
    const pp=((t*(.6+wave(i,seed+9)*.8)+wave(i,seed+13))%1);
    const ex=x+(wave(i,seed+4)-.5)*w*1.3+Math.sin(t*3+i)*8;
    const ey=y-pp*h*1.7;
    g.globalAlpha=A*(1-pp)*.9;
    g.fillStyle='#ffd083';g.beginPath();g.arc(ex,ey,1.4+wave(i,seed+2)*2,0,PI*2);g.fill();
  }
  g.restore();
}
export function smoke(g,x,y,w,h,t=0,opt={}){
  const alpha=opt.alpha??.5,seed=opt.seed||21,intensity=opt.intensity??1;
  if(alpha<=0)return;
  g.save();
  for(let i=0;i<9;i++){
    const u=i/8;
    const px=x+(wave(i,seed)-.5)*w*.6+Math.sin(t*.55+i*1.7)*w*.22+u*w*.35;
    const py=y-Math.pow((t*.06+u)%1,1.15)*h*1.5-10;
    const r=(18+u*46)*intensity;
    const a=alpha*(1-u*.72)*(.55+.25*Math.sin(t*.9+i));
    const gr=g.createRadialGradient(px,py,r*.1,px,py,r);
    gr.addColorStop(0,`rgba(70,60,50,${a})`);
    gr.addColorStop(.55,`rgba(52,46,40,${a*.5})`);
    gr.addColorStop(1,'rgba(40,36,32,0)');
    g.fillStyle=gr;g.beginPath();g.arc(px,py,r,0,PI*2);g.fill();
  }
  g.restore();
}

/* ================= 粮道 / 行军路线 ================= */
export function supplyLine(g,path,opt={}){
  const t=opt.t||0,alpha=opt.alpha??1,color=opt.color||'#b4553e';
  if(alpha<=0)return;
  const width=opt.width??3,dash=opt.dash||[10,9];
  g.save();g.globalAlpha*=alpha;g.lineCap='round';
  g.setLineDash(dash);tracePath(g,path);
  g.strokeStyle=opt.halo||'rgba(242,232,206,.32)';g.lineWidth=width+4;g.stroke();
  g.strokeStyle=color;g.lineWidth=width;g.stroke();
  g.setLineDash([]);
  if(opt.flow!==false){
    const count=opt.count??7,speed=opt.speed??.05,seed=opt.seed||5;
    for(let i=0;i<count;i++){
      const u=((i/count+t*speed+wave(i,seed)*.08)%1+1)%1;
      const p=pointAtPath(path,u),tg=tangentAtPath(path,u);
      const fade=Math.min(1,u*8,(1-u)*8);
      g.globalAlpha*=fade;
      if(opt.cart){
        g.save();g.translate(p[0],p[1]);g.rotate(Math.atan2(tg[1],tg[0])+PI/2);
        g.fillStyle=color;g.fillRect(-4,-3,8,6);
        g.strokeStyle='rgba(40,28,16,.9)';g.lineWidth=1;g.strokeRect(-4,-3,8,6);
        g.restore();
      }else{
        g.fillStyle=color;g.beginPath();g.arc(p[0],p[1],2.4,0,PI*2);g.fill();
        g.fillStyle='rgba(255,244,214,.8)';g.beginPath();g.arc(p[0],p[1],1,0,PI*2);g.fill();
      }
      g.globalAlpha/=fade;
    }
  }
  g.restore();
}
export function routeLine(g,path,opt={}){
  const alpha=opt.alpha??1;if(alpha<=0)return;
  g.save();g.globalAlpha*=alpha;g.lineCap='round';
  g.setLineDash(opt.dash||[7,9]);tracePath(g,path);
  g.strokeStyle=opt.color||'rgba(214,196,150,.55)';g.lineWidth=opt.width??2;g.stroke();
  g.setLineDash([]);
  if(opt.label){
    const p=pointAtPath(path,opt.labelAt??.5);
    unitTag(g,opt.label,p[0],p[1]-(opt.labelGap??18),opt.labelColor||'#d8c8a0',{size:opt.labelSize||18});
  }
  g.restore();
}

/* ================= 进攻箭头 ================= */
export function attackArrow(g,x1,y1,x2,y2,opt={}){
  let q=opt.progress;
  if(q==null){
    const t=opt.t??1,t0=opt.t0??0,t1=opt.t1??1;
    q=t1>t0?(t-t0)/(t1-t0):1;
    q=opt.ease===false?clamp01(q):smooth(clamp01(q));
  }
  q=clamp01(q);
  if(q<=.004)return;
  const A=opt.alpha??1;if(A<=0)return;
  const color=opt.color||'rgba(238,148,104,.96)';
  const width=opt.width??6,head=opt.head??18;
  const bend=opt.bend??0;
  const mx=(x1+x2)/2,my=(y1+y2)/2,dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy)||1;
  const cx=mx-dy/l*bend,cy=my+dx/l*bend;
  const pt=u=>{const a=1-u;return [a*a*x1+2*a*u*cx+u*u*x2,a*a*y1+2*a*u*cy+u*u*y2]};
  g.save();g.globalAlpha*=A;g.lineCap='round';g.lineJoin='round';
  if(opt.glow!==false){
    g.strokeStyle=opt.glowColor||'rgba(255,170,110,.20)';g.lineWidth=width+8;
    g.beginPath();g.moveTo(x1,y1);
    const N=26;for(let i=1;i<=N;i++){const p=pt(i/N*q);g.lineTo(p[0],p[1])}
    g.stroke();
  }
  g.strokeStyle=color;g.lineWidth=width;
  if(opt.dash)g.setLineDash(opt.dash);
  g.beginPath();g.moveTo(x1,y1);
  const N=26;for(let i=1;i<=N;i++){const p=pt(i/N*q);g.lineTo(p[0],p[1])}
  g.stroke();g.setLineDash([]);
  const tip=pt(q),prev=pt(Math.max(0,q-.02));
  const a=Math.atan2(tip[1]-prev[1],tip[0]-prev[0]);
  g.fillStyle=color;
  g.beginPath();g.moveTo(tip[0],tip[1]);
  g.lineTo(tip[0]-head*Math.cos(a-.44),tip[1]-head*Math.sin(a-.44));
  g.lineTo(tip[0]-head*Math.cos(a+.44),tip[1]-head*Math.sin(a+.44));
  g.closePath();g.fill();
  if(opt.label){
    const p=pt(opt.labelAt??.55),nx=-dy/l,ny=dx/l;
    unitTag(g,opt.label,p[0]+nx*(opt.labelOffset??22),p[1]+ny*(opt.labelOffset??22),
      opt.labelColor||'#f0b48a',{size:opt.labelSize||19,alpha:A});
  }
  g.restore();
}

/* ================= 行军纵队 ================= */
export function column(g,path,opt={}){
  const t=opt.t||0,t0=opt.t0??0,t1=opt.t1??1;
  const alpha=opt.alpha??1;if(alpha<=0)return;
  const p=smooth(clamp01((t-t0)/Math.max(.001,t1-t0)));
  const count=opt.count??24,span=opt.span??.32,color=opt.color||'#3f9d87';
  const type=opt.type||'infantry',size=opt.size??.9,seed=opt.seed||1;
  g.save();g.globalAlpha*=alpha;g.lineCap='round';
  for(let i=0;i<count;i++){
    const u=Math.max(0,p-(i/(count-1))*span);
    if(p<=.002&&i>0)continue;
    if(u<=0&&p<=0)continue;
    const pt=pointAtPath(path,u),tg=tangentAtPath(path,u);
    const ang=Math.atan2(tg[1],tg[0])+PI/2;
    const nx=-tg[1],ny=tg[0];
    const side=(i%2?1:-1)*(2.6+wave(i,seed)*1.8);
    const jx=(wave(i,seed+2)-.5)*3,jy=(wave(i,seed+5)-.5)*3;
    const x=pt[0]+nx*side+jx,y=pt[1]+ny*side+jy;
    if(type==='cavalry'){
      horse(g,x,y,color,{scale:size*.9,flip:false});
      if(opt.dust){
        g.fillStyle=`rgba(170,146,110,${.10*alpha})`;
        g.beginPath();g.ellipse(x-tg[0]*8,y-tg[1]*8,7,4,ang,0,PI*2);g.fill();
      }
    }else{
      soldier(g,x,y,color,{scale:size,dir:ang,helmet:opt.helmet});
    }
    if(opt.torches&&i%(opt.torchEvery||3)===0)torch(g,x-nx*3,y-ny*3,t,{scale:.6*size});
    if(opt.fakeFlags&&i%5===0){
      const fx=x+nx*7,fy=y+ny*7;
      g.strokeStyle='rgba(60,46,28,.9)';g.lineWidth=1.5;
      g.beginPath();g.moveTo(fx,fy+4);g.lineTo(fx,fy-20*size);g.stroke();
      g.fillStyle=opt.flagColor||'#b4553e';
      g.beginPath();g.moveTo(fx,fy-20*size);g.lineTo(fx+14*size,fy-16*size);g.lineTo(fx,fy-12*size);g.closePath();g.fill();
    }
    if(opt.marks&&i%4===0){
      g.strokeStyle=color;g.globalAlpha*=.5;g.lineWidth=1;
      g.beginPath();g.moveTo(x-5,y);g.lineTo(x+5,y);g.stroke();g.globalAlpha/=.5;
    }
  }
  if(opt.label){
    const head=pointAtPath(path,p);
    const tg=tangentAtPath(path,p);
    unitTag(g,opt.label,head[0]-tg[1]*26,head[1]+tg[0]*26,color,{size:opt.labelSize||19});
  }
  g.restore();
}

/* ================= 箭雨 / 交锋 / 扬尘 ================= */
export function arrowVolley(g,from,to,opt={}){
  const t=opt.t||0,t0=opt.t0??0,dur=opt.dur??.8,stagger=opt.stagger??.06;
  const alpha=opt.alpha??1;if(alpha<=0)return;
  const count=opt.count??14,spread=opt.spread??46,color=opt.color||'rgba(52,42,28,.75)';
  const arc=opt.arc??70,seed=opt.seed||9;
  g.save();g.globalAlpha*=alpha;g.lineCap='round';
  for(let i=0;i<count;i++){
    const raw=(t-t0-i*stagger)/dur;
    if(raw<0)continue;
    if(raw>1.25)continue;
    const p=Math.min(1,raw);
    const sx=Math.sin(i*7.31+seed)*spread,sy=Math.cos(i*3.17+seed)*spread*.45;
    const ex=Math.sin(i*4.77+seed+2)*spread,sy2=Math.cos(i*5.13+seed+1)*spread*.45;
    const x0=from[0]+sx,y0=from[1]+sy,x1=to[0]+ex,y1=to[1]+sy2;
    const at=u=>[x0+(x1-x0)*u,y0+(y1-y0)*u-Math.sin(u*PI)*arc];
    const a=at(p),b=at(Math.max(0,p-.035));
    const fade=p>1?(1.25-p)/.25:1;
    g.globalAlpha*=fade;
    g.strokeStyle=color;g.lineWidth=1.6;
    g.beginPath();g.moveTo(b[0],b[1]);g.lineTo(a[0],a[1]);g.stroke();
    if(opt.sparks&&p>=1){
      g.fillStyle='rgba(220,190,130,.9)';g.beginPath();g.arc(x1,y1,1.8,0,PI*2);g.fill();
    }
    g.globalAlpha/=fade;
  }
  g.restore();
}
export function clash(g,x,y,r,t=0,opt={}){
  const alpha=opt.alpha??1;if(alpha<=0)return;
  const pulse=.72+.28*Math.sin(t*5.7+x*.02);
  g.save();g.globalAlpha*=alpha*pulse;g.lineCap='round';
  const color=opt.color||'#ffb45e';
  g.strokeStyle=color;g.lineWidth=3.2;
  g.beginPath();g.moveTo(x-r*.6,y-r*.6);g.lineTo(x+r*.6,y+r*.6);
  g.moveTo(x+r*.6,y-r*.6);g.lineTo(x-r*.6,y+r*.6);g.stroke();
  g.strokeStyle='rgba(255,238,200,.85)';g.lineWidth=1.2;
  for(let i=0;i<7;i++){
    const a=i*PI*2/7+t*.6;
    const r0=r*(.55+.12*Math.sin(t*7+i)),r1=r*(1.0+.18*Math.sin(t*5+i*2));
    g.beginPath();g.moveTo(x+Math.cos(a)*r0,y+Math.sin(a)*r0);g.lineTo(x+Math.cos(a)*r1,y+Math.sin(a)*r1);g.stroke();
  }
  g.restore();
}
export function dust(g,x,y,w,h,t=0,opt={}){
  const alpha=opt.alpha??.3;if(alpha<=0)return;
  const seed=opt.seed||17,count=opt.count??10;
  g.save();
  for(let i=0;i<count;i++){
    const u=((wave(i,seed)+t*.035*(.5+wave(i,seed+3)))%1);
    const px=x+(wave(i,seed+6)-.5)*w+u*w*.35;
    const py=y+(wave(i,seed+11)-.5)*h-u*h*.25;
    const r=(7+wave(i,seed+8)*13)*(.7+u*.8);
    g.fillStyle=`rgba(168,146,110,${alpha*(1-u)*.34})`;
    g.beginPath();g.ellipse(px,py,r,r*.5,0,0,PI*2);g.fill();
  }
  g.restore();
}
