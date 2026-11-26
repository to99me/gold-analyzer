/* GOLD ANALYZER - SMC Step 1: swing high/low detection */
(() => {
 "use strict";
 const $ = id => document.getElementById(id);
 let lastPoints = [];
 const MAJOR = 5, MINOR = 2, DISPLAY = 100;

 function valid(p) {
  return p && Number.isFinite(Number(p.h)) && Number.isFinite(Number(p.l)) && Number.isFinite(Number(p.c));
 }
 function findPivots(points, side, left, right) {
  const key = side === "high" ? "h" : "l";
  const out = [];
  for (let i = left; i < points.length - right; i++) {
   const v = Number(points[i][key]);
   let ok = true, strict = false;
   for (let j = i-left; j < i; j++) {
    const x = Number(points[j][key]);
    if (side === "high" ? x >= v : x <= v) { ok = false; break; }
    if (side === "high" ? x < v : x > v) strict = true;
   }
   if (!ok) continue;
   for (let j = i+1; j <= i+right; j++) {
    const x = Number(points[j][key]);
    if (side === "high" ? x > v : x < v) { ok = false; break; }
    if (side === "high" ? x < v : x > v) strict = true;
   }
   if (ok && strict) out.push({index:i, side, price:v, confirmed:true});
  }
  return out;
 }
 function provisional(points, side, lookback) {
  if (points.length < lookback + 1) return null;
  const i = points.length - 1, key = side === "high" ? "h" : "l";
  const v = Number(points[i][key]);
  for (let j=i-lookback;j<i;j++) {
   const x=Number(points[j][key]);
   if (side === "high" ? x >= v : x <= v) return null;
  }
  return {index:i,side,price:v,confirmed:false};
 }
 function detect(points) {
  const major = [...findPivots(points,"high",MAJOR,MAJOR),...findPivots(points,"low",MAJOR,MAJOR)]
   .sort((a,b)=>a.index-b.index);
  const minor = [...findPivots(points,"high",MINOR,MINOR),...findPivots(points,"low",MINOR,MINOR)]
   .sort((a,b)=>a.index-b.index);
  const candidates = [
   provisional(points,"high",MAJOR), provisional(points,"low",MAJOR),
   provisional(points,"high",MINOR), provisional(points,"low",MINOR)
  ].filter(Boolean);
  return {major,minor,candidates};
 }
 function getFibonacci(major) {
  for(let i=major.length-1;i>0;i--) {
   const end=major[i], start=major[i-1];
   if(start.side===end.side || end.index<=start.index) continue;
   const span=Math.abs(end.price-start.price);
   if(!Number.isFinite(span) || span<=0) continue;
   const ratios=[0,.236,.382,.5,.618,.786,1];
   return {
    start,end,direction:end.side==="high"?"上昇波の押し目":"下降波の戻り",
    levels:ratios.map(r=>({ratio:r,price:end.price+(start.price-end.price)*r}))
   };
  }
  return null;
 }
 function formatCandleTime(value) {
  if(value===undefined || value===null || value==="") return "時刻データなし";
  let n=Number(value), date;
  if(Number.isFinite(n)) date=new Date(n < 1e12 ? n*1000 : n);
  else date=new Date(value);
  if(Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(date);
 }
 function auditAnchor(p, label, points) {
  const c=points[p.index]||{};
  const val=k=>Number.isFinite(Number(c[k]))?Number(c[k]).toFixed(2):"--";
  return label+"："+formatCandleTime(c.t ?? c.time ?? c.timestamp)+
   " ／ O "+val("o")+" H "+val("h")+" L "+val("l")+" C "+val("c")+
   " ／ "+p.side.toUpperCase()+"採用値 "+p.price.toFixed(2);
 }
 function draw(points, result, fib) {
  const canvas=$("swingCanvas"); if(!canvas) return;
  const rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
  const w=Math.max(320,rect.width), h=300;
  canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
  const ctx=canvas.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  const shown=points.slice(-DISPLAY), offset=points.length-shown.length;
  const highs=shown.map(p=>Number(p.h)), lows=shown.map(p=>Number(p.l));
  let min=Math.min(...lows), max=Math.max(...highs);
  if(!Number.isFinite(min)||!Number.isFinite(max)||max===min){ctx.fillStyle="#9eabbc";ctx.fillText("データ不足",12,24);return;}
  const pad={l:10,r:62,t:18,b:22}, pw=w-pad.l-pad.r, ph=h-pad.t-pad.b;
  const y=v=>pad.t+(max-v)/(max-min)*ph;
  const step=pw/shown.length, body=Math.max(2,Math.min(8,step*.58));
  if(fib) {
   ctx.save();ctx.font="10px sans-serif";ctx.textAlign="left";
   fib.levels.forEach(level=>{
    if(level.price<min || level.price>max) return;
    const yy=y(level.price);
    ctx.strokeStyle=level.ratio===0.618?"#f3c65e":"rgba(157,181,210,.48)";
    ctx.lineWidth=level.ratio===0.618?1.5:1;
    ctx.setLineDash(level.ratio===0.618?[]:[4,4]);
    ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=level.ratio===0.618?"#f3c65e":"#b7c5d8";
    ctx.fillText((level.ratio*100).toFixed(1)+"%",pad.l+3,yy-3);
   });
   ctx.restore();
  }
  ctx.strokeStyle="#26364c";ctx.lineWidth=1;
  for(let k=0;k<=4;k++){const yy=pad.t+ph*k/4;ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();
   ctx.fillStyle="#9eabbc";ctx.font="10px sans-serif";ctx.fillText((max-(max-min)*k/4).toFixed(1),w-pad.r+5,yy+3);}
  shown.forEach((p,i)=>{
   const x=pad.l+step*(i+.5), o=Number(p.o), c=Number(p.c), hi=Number(p.h), lo=Number(p.l);
   ctx.strokeStyle=c>=o?"#55d69a":"#ff7777";ctx.fillStyle=ctx.strokeStyle;
   ctx.beginPath();ctx.moveTo(x,y(hi));ctx.lineTo(x,y(lo));ctx.stroke();
   const top=y(Math.max(o,c)), bottom=y(Math.min(o,c));
   ctx.fillRect(x-body/2,top,body,Math.max(1,bottom-top));
  });
  function marker(p,color,major,provisional){
   const local=p.index-offset;if(local<0||local>=shown.length)return;
   const x=pad.l+step*(local+.5), yy=y(p.price), up=p.side==="low";
   ctx.save();ctx.strokeStyle=color;ctx.fillStyle=provisional?"#111b29":color;ctx.lineWidth=major?2:1.4;
   ctx.beginPath();
   if(up){ctx.moveTo(x,yy+ (major?10:7));ctx.lineTo(x-(major?7:5),yy+(major?22:16));ctx.lineTo(x+(major?7:5),yy+(major?22:16));}
   else{ctx.moveTo(x,yy-(major?10:7));ctx.lineTo(x-(major?7:5),yy-(major?22:16));ctx.lineTo(x+(major?7:5),yy-(major?22:16));}
   ctx.closePath();if(!provisional)ctx.fill();ctx.stroke();
   if(major){ctx.font="bold 10px sans-serif";ctx.fillStyle=color;ctx.textAlign="center";ctx.fillText(p.price.toFixed(1),x,up?yy+31:yy-25);}
   ctx.restore();
  }
  result.minor.forEach(p=>marker(p,"#48c7e8",false,false));
  result.major.forEach(p=>marker(p,"#f3c65e",true,false));
  result.candidates.forEach(p=>marker(p,p.side==="high"?"#f3c65e":"#f3c65e",p.index===points.length-1 && (p===result.candidates[0]||p===result.candidates[1]),true));
 }
 window.renderSwingStructure = function(raw) {
  const points=(raw||[]).filter(valid);
  if(points.length<12){window.clearSwingStructure("スイング検出に必要なデータが不足しています");return;}
  lastPoints=points;
  const result=detect(points);
  const fib=getFibonacci(result.major);
  $("majorCount").textContent=result.major.length+" 件";
  $("minorCount").textContent=result.minor.length+" 件";
  $("swingStatus").textContent="検出完了 · "+points.length+"本";
  if($("fibDirection")) $("fibDirection").textContent=fib?fib.direction:"確定スウィング待ち";
  if($("fibAnchor")) $("fibAnchor").textContent=fib?
   "起点 "+fib.start.price.toFixed(2)+" → 終点 "+fib.end.price.toFixed(2):"--";
  if($("fibAudit")) {
   const lowIndex=points.reduce((best,p,i)=>Number(p.l)<Number(points[best].l)?i:best,0);
   const highIndex=points.reduce((best,p,i)=>Number(p.h)>Number(points[best].h)?i:best,0);
   const lowPivot={index:lowIndex,side:"low",price:Number(points[lowIndex].l)};
   const highPivot={index:highIndex,side:"high",price:Number(points[highIndex].h)};
   $("fibAudit").textContent=fib?
    "計算元：XAUS API（15分足）\n"+auditAnchor(fib.start,"起点",points)+"\n"+auditAnchor(fib.end,"終点",points)+"\n\n取得データ全体の最安値："+auditAnchor(lowPivot,"全体Low",points)+"\n取得データ全体の最高値："+auditAnchor(highPivot,"全体High",points):
    "Majorの高値・安値が交互に確定すると検証情報を表示します\n取得データ全体の最安値："+auditAnchor(lowPivot,"全体Low",points);
  }
  if($("fibLevels")) $("fibLevels").textContent=fib?
   fib.levels.map(x=>(x.ratio*100).toFixed(1)+"%："+x.price.toFixed(2)).join("　／　"):"Majorの高値・安値が交互に確定すると表示します";
  draw(points,result,fib);
 };
 window.clearSwingStructure = function(message) {
  if($("swingStatus"))$("swingStatus").textContent=message;
  if($("majorCount"))$("majorCount").textContent="--";
  if($("minorCount"))$("minorCount").textContent="--";
  const c=$("swingCanvas");if(c){const x=c.getContext("2d");x.clearRect(0,0,c.width,c.height);}
 };
 window.addEventListener("resize",()=>{if(lastPoints.length){const r=detect(lastPoints);draw(lastPoints,r,getFibonacci(r.major));}});
})();