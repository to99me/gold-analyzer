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

 function latestTwo(pivots, side) {
  return pivots.filter(p=>p.side===side).slice(-2);
 }
 function structuredSwings(points,left,right) {
  const raw=[...findPivots(points,"high",left,right),...findPivots(points,"low",left,right)]
   .sort((a,b)=>a.index-b.index);
  const alternating=[];
  for(const p of raw){
   const last=alternating[alternating.length-1];
   if(!last||last.side!==p.side){alternating.push(p);continue;}
   if((p.side==="high"&&p.price>last.price)||(p.side==="low"&&p.price<last.price))alternating[alternating.length-1]=p;
  }
  const atr=atrValue(points,14)||0;
  const minMove=atr*(left>=5?0.65:0.45);
  const filtered=[];
  for(const p of alternating){
   const last=filtered[filtered.length-1];
   if(!last){filtered.push(p);continue;}
   if(last.side===p.side)continue;
   if(Math.abs(p.price-last.price)>=minMove)filtered.push(p);
  }
  return filtered;
 }
 function structureSummary(raw, left, right) {
  const points=(raw||[]).filter(valid);
  if(points.length<Math.max(12,left+right+3)) return {ready:false};
  const sequence=structuredSwings(points,left,right);
  const highs=sequence.filter(p=>p.side==="high");
  const lows=sequence.filter(p=>p.side==="low");
  const h=highs.slice(-2), l=lows.slice(-2);
  let trend="判定保留", detail="高値・安値の確定待ち";
  if(h.length===2 && l.length===2) {
   const hh=h[1].price>h[0].price, hl=l[1].price>l[0].price;
   const lh=h[1].price<h[0].price, ll=l[1].price<l[0].price;
   if(hh&&hl){trend="上昇";detail="高値切り上げ・安値切り上げ";}
   else if(lh&&ll){trend="下降";detail="高値切り下げ・安値切り下げ";}
   else {trend="レンジ／転換警戒";detail="高値・安値の方向が不一致";}
  }
  const last=points[points.length-1];
  const low=l.length?l[l.length-1]:null, high=h.length?h[h.length-1]:null;
  return {ready:true,trend,detail,last:Number(last.c),low,high,
   previousHigh:h.length===2?h[0]:null,previousLow:l.length===2?l[0]:null,
   lowTime:low?formatCandleTime(points[low.index].t??points[low.index].time??points[low.index].timestamp):"--",
   highTime:high?formatCandleTime(points[high.index].t??points[high.index].time??points[high.index].timestamp):"--",
   lastTime:formatCandleTime(last.t??last.time??last.timestamp),
   count:points.length,sequenceCount:sequence.length};
 }
 function writeStructure(prefix, data, label) {
  const el=$(prefix+"Structure");
  if(!el)return;
  if(!data.ready){el.textContent=label+"：データ不足";return;}
  const trendColor=data.trend==="上昇"?"#55d69a":data.trend==="下降"?"#ff7777":"#f3c65e";
  const lines=[
   label+"トレンド："+data.trend+"（"+data.detail+"）",
   "最新足終値："+data.last.toFixed(2)+" ／ 足時刻："+data.lastTime,
   "直近押し安値："+(data.low?data.low.price.toFixed(2)+" ／ "+data.lowTime:"未確定"),
   "直近戻り高値："+(data.high?data.high.price.toFixed(2)+" ／ "+data.highTime:"未確定"),
   "前回高値："+(data.previousHigh?data.previousHigh.price.toFixed(2):"--")+" ／ 前回安値："+(data.previousLow?data.previousLow.price.toFixed(2):"--")
  ];
  el.textContent=lines.join("\n");
  el.style.borderLeft="3px solid "+trendColor;
 }
 window.renderMultiTimeframe = function(hourlyRaw, fifteenRaw) {
  const h=structureSummary(hourlyRaw,MAJOR,MAJOR);
  const m=structureSummary(fifteenRaw,MINOR,MINOR);
  writeStructure("hourly",h,"1時間足");
  writeStructure("fifteen",m,"15分足");
  const state=$("mtfConclusion");
  if(state){
   let msg="上位足・下位足のデータを確認中";
   if(h.ready&&m.ready){
    if(h.trend==="上昇"&&m.trend==="上昇")msg="上昇方向で一致。押し目候補を監視";
    else if(h.trend==="下降"&&m.trend==="下降")msg="下降方向で一致。戻り売り候補を監視";
    else if(h.trend==="上昇"&&m.trend==="下降")msg="1時間足は上昇、15分足は調整中の可能性";
    else if(h.trend==="下降"&&m.trend==="上昇")msg="1時間足は下降、15分足は戻し中の可能性";
    else msg="方向不一致。エントリーは慎重に";
   }
   state.textContent=msg+"\n※確定スイングを交互化し、ATRに対して小さすぎる波を除外";
  }
 };

 function atrValue(points, period=14) {
  if(points.length<period+1)return null;
  const ranges=[];
  for(let i=1;i<points.length;i++){
   const p=points[i], prev=points[i-1];
   ranges.push(Math.max(Number(p.h)-Number(p.l),Math.abs(Number(p.h)-Number(prev.c)),Math.abs(Number(p.l)-Number(prev.c))));
  }
  return ranges.slice(-period).reduce((a,b)=>a+b,0)/period;
 }
 function findRetestSetup(raw, hourlyRaw) {
  const points=(raw||[]).filter(valid);
  if(points.length<40)return {status:"データ不足",detail:"15分足データが不足しています"};
  const atr=atrValue(points);
  if(!atr)return {status:"データ不足",detail:"ATRを計算できません"};
  const pivL=findPivots(points,"low",MINOR,MINOR);
  const pivH=findPivots(points,"high",MINOR,MINOR);
  const events=[];
  for(const p of pivL){
   for(let i=p.index+1;i<points.length;i++){
    if(Number(points[i].c)<p.price-atr*0.03){events.push({side:"short",level:p.price,breakIndex:i,pivot:p});break;}
   }
  }
  for(const p of pivH){
   for(let i=p.index+1;i<points.length;i++){
    if(Number(points[i].c)>p.price+atr*0.03){events.push({side:"long",level:p.price,breakIndex:i,pivot:p});break;}
   }
  }
  if(!events.length)return {status:"ブレイク待ち",detail:"直近スイング高値・安値の明確な終値ブレイクを待っています"};
  events.sort((a,b)=>b.breakIndex-a.breakIndex);
  const e=events[0], age=points.length-1-e.breakIndex;
  if(age>48)return {status:"ブレイク待ち",detail:"直近のブレイクは古いため、新しいスイングを監視します"};
  const tol=atr*0.18;
  let retest=null, rejection=null;
  for(let i=e.breakIndex+1;i<points.length;i++){
   const p=points[i],o=Number(p.o),c=Number(p.c),hi=Number(p.h),lo=Number(p.l);
   if(e.side==="short"){
    if(c>e.level+atr*0.25)return {status:"ブレイク失敗・見送り",detail:"価格がブレイク水準を上回って定着。次の構造を待ちます"};
    if(hi>=e.level-tol){retest={index:i,price:hi};const body=Math.abs(c-o),wick=hi-Math.max(o,c);
     if(c<o&&c<e.level&&wick>=body*0.7)rejection={index:i,price:hi};}
   }else{
    if(c<e.level-atr*0.25)return {status:"ブレイク失敗・見送り",detail:"価格がブレイク水準を下回って定着。次の構造を待ちます"};
    if(lo<=e.level+tol){retest={index:i,price:lo};const body=Math.abs(c-o),wick=Math.min(o,c)-lo;
     if(c>o&&c>e.level&&wick>=body*0.7)rejection={index:i,price:lo};}
   }
  }
  const side=e.side, aligned=(hourlyRaw&&structureSummary(hourlyRaw,MAJOR,MAJOR));
  const trendAligned=aligned&&aligned.ready&&((side==="short"&&aligned.trend==="下降")||(side==="long"&&aligned.trend==="上昇"));
  const price=Number(points[points.length-1].c);
  if(!retest)return {status:"リテスト待ち",side,level:e.level,detail:(side==="short"?"安値":"高値")+"ブレイクを確認。ブレイク水準への戻りを待っています",trendAligned};
  if(!rejection)return {status:"反転確認待ち",side,level:e.level,detail:"リテスト接近。反対方向へのローソク足確定を待っています",trendAligned};
  const bar=points[rejection.index],stop=side==="short"?rejection.price+atr*0.15:rejection.price-atr*0.15;
  const risk=Math.abs(price-stop);
  const tp1=side==="short"?price-risk:price+risk, tp2=side==="short"?price-risk*2:price+risk*2;
  if(!trendAligned)return {status:"時間足不一致・見送り",side,level:e.level,detail:"15分足では反転確認。ただし1時間足の方向と一致していません",trendAligned:false};
  return {status:side==="short"?"ショート候補":"ロング候補",side,level:e.level,detail:"リテスト後の反転ローソク足を確認。確定足ベースの候補です",trendAligned:true,stop,tp1,tp2,entry:price,rr:"1:1 / 1:2",time:formatCandleTime(bar.t??bar.time??bar.timestamp)};
 }
 window.renderEntrySetup=function(hourlyRaw,fifteenRaw){
  const el=$("entrySetup");if(!el)return;
  const x=findRetestSetup(fifteenRaw,hourlyRaw);
  const colors={"ロング候補":"#55d69a","ショート候補":"#ff7777"};
  el.style.borderLeft="3px solid "+(colors[x.status]||"#f3c65e");
  const lines=["判定："+x.status,x.detail||""];
  if(x.level!==undefined)lines.push("ブレイク基準："+x.level.toFixed(2));
  if(x.trendAligned!==undefined)lines.push("1時間足方向："+(x.trendAligned?"一致":"不一致"));
  if(x.entry!==undefined)lines.push("現在値："+x.entry.toFixed(2),"損切り候補："+x.stop.toFixed(2),"利確候補 TP1："+x.tp1.toFixed(2)+" ／ TP2："+x.tp2.toFixed(2),"目安RR："+x.rr,"確認足："+x.time);
  lines.push("※機械的な構造判定です。実際の約定価格・スプレッド・急変動を考慮した注文指示ではありません。");
  el.textContent=lines.join("\n");
 };

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
   const first=points[0], last=points[points.length-1];
   const dataRange="取得本数："+points.length+"本 ／ 取得期間："+formatCandleTime(first.t ?? first.time ?? first.timestamp)+" ～ "+formatCandleTime(last.t ?? last.time ?? last.timestamp)+"\n";
   $("fibAudit").textContent=dataRange+(fib?
    "計算元：XAUS API（15分足）\n"+auditAnchor(fib.start,"起点",points)+"\n"+auditAnchor(fib.end,"終点",points)+"\n\n取得データ全体の最安値："+auditAnchor(lowPivot,"全体Low",points)+"\n取得データ全体の最高値："+auditAnchor(highPivot,"全体High",points):
    "Majorの高値・安値が交互に確定すると検証情報を表示します\n取得データ全体の最安値："+auditAnchor(lowPivot,"全体Low",points));
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