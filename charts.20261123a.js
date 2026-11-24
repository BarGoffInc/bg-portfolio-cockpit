/* Charts page (2026-11-23a). Display-only. Default view is the house plan
   drawn as points + short ticks on the price × time grid. Perp Desk and old
   plans stay behind toggles. plans.json is not written here. */
(function(){
const $=s=>document.querySelector(s);
const bust=u=>u+(u.includes('?')?'&':'?')+'_='+Date.now();
const get=u=>fetch(bust(u),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const px=v=>v==null?'—':v>=1000?'$'+Math.round(v).toLocaleString('en-US'):v>=100?'$'+(+v).toFixed(v%1?2:0):v>=1?'$'+(+v).toFixed(2):'$'+String(+(+v).toPrecision(3));
const axisNum=v=>v==null?'':v>=1000?Math.round(v).toLocaleString('en-US'):v>=100?(+v).toFixed(v%1?2:0):v>=1?(+v).toFixed(2):String(+(+v).toPrecision(3));
const usd=v=>v==null?'':v>=1000?'$'+(v/1000).toFixed(v%1000?1:0).replace(/\.0$/,'')+'k':'$'+Math.round(v);
const ACTIVE=new Set(['planned','armed','partially filled']);
const C={buy:'#1e8a4c',rebuy:'#2f9e5b',add:'#0f6e6e',sell:'#e07b24',runner:'#b7791f',kill:'#c0392b',opt:'#2b6cb0',old:'#7c8b92'};
const GREENS=['#9edcb5','#3aa86a','#1e8a4c','#0b4f2c'];
const ORANGES=['#f3c89a','#e8a04a','#e07b24','#8f4a10'];
const REDS=['#f0a8a2','#e06a62','#c0392b','#7a1814'];
const KW={buy_rung:'Buy',rebuy_rung:'Re-buy',strength_add:'Add',sell_target:'Sell',runner:'Rest',kill_line:'Exit',option:'Option'};
const colorOf=e=>({buy_rung:C.buy,rebuy_rung:C.rebuy,strength_add:C.add,sell_target:C.sell,runner:C.runner,kill_line:C.kill,option:C.opt})[e.kind]||C.old;
const etDay=iso=>new Date(iso).toLocaleDateString('en-CA',{timeZone:'America/New_York'});
const utcDay=iso=>new Date(iso).toISOString().slice(0,10);
const short=iso=>new Date(iso).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'});
const shortT=iso=>new Date(iso).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET';
function underlying(sym){const s=String(sym||'').trim().toUpperCase();const m=s.match(/^([A-Z.]+)\s+\d{6}[CP]\d{8}$/);
  if(m)return [m[1],'option'];if(s.endsWith('-PERP'))return [s.slice(0,-5),'perp'];return [s,''];}
function fid(f){return f.id||[f.ts,f.account,f.symbol,f.side,f.qty,f.price].join('|');}
function isPerp(e){const s=(e.set_label||'')+' '+(e.set||'')+' '+(e.unit_label||'');
  return /perp desk|hl isolated/i.test(s)||e.unit_label==='perp'||e.asset_type==='perp';}
function isHouse(e){return !isPerp(e);}
function showPerp(){return !!( $('#showperp') && $('#showperp').checked );}
function showOld(){return !!( $('#showold') && $('#showold').checked );}
function weeklyKill(e){return /weekly close/i.test((e.trigger||'')+' '+(e.notes||''));}
function needsBounce(e){return /rsi|divergence|wash|exhaust/i.test((e.trigger||'')+' '+(e.notes||''));}
function unitsOf(e){if(e.size_units!=null&&e.size_units!=='')return +e.size_units;
  if(e.size_usd&&e.price)return e.size_usd/e.price;return null;}
function sizeShort(e){
  const u=unitsOf(e);
  if(e.unit_label==='perp'||isPerp(e)){if(u)return (u>=10?Math.round(u):+u.toFixed(1))+' perp';if(e.size_usd)return usd(e.size_usd);}
  if((e.asset_type||'stock')==='stock'){if(u)return Math.round(u)+' sh';if(e.size_usd)return usd(e.size_usd);}
  if(u&&u>=0.05)return (u>=10?Math.round(u):+u.toFixed(u>=1?1:2))+' '+(e.unit_label||e.ticker||'');
  if(e.size_usd)return usd(e.size_usd);
  if(e.size_note)return e.size_note;return '';}
function sizeLong(e,t){
  const u=unitsOf(e);
  if(e.unit_label==='perp'||isPerp(e)){if(u){const n=u>=10?Math.round(u):+u.toFixed(1);return n+' '+t+' perp'+(n===1?'':'s');}if(e.size_usd)return usd(e.size_usd)+' of '+t+' perps';}
  if((e.asset_type||'stock')==='stock'){if(u){const n=Math.round(u);return n+' share'+(n===1?'':'s');}if(e.size_usd)return usd(e.size_usd)+' of '+t;}
  if(u&&u>=0.05){const n=u>=10?Math.round(u):+u.toFixed(u>=1?1:2);return n+' '+(e.unit_label||t);}
  if(e.size_usd)return usd(e.size_usd)+' of '+t;
  return '';}
function placedLabel(e){
  if(e.status==='partially filled')return 'Partly filled';
  if(e.status==='filled')return 'Filled';
  if(e.status==='superseded'||e.status==='cancelled'||e.status==='missed')return e.status[0].toUpperCase()+e.status.slice(1);
  return 'Planned, not placed';}
function placedClass(e){const s=e.status||'';if(s==='partially filled')return 'partially';return s.split(' ')[0];}
function scaleColor(palette,i,n){
  if(n<=1)return palette[palette.length-1];
  const t=i/Math.max(1,n-1);
  const x=t*(palette.length-1);
  return palette[Math.round(x)];}

function names(list){
  const m={};const by=k=>list.filter(e=>k.includes(e.kind));
  by(['buy_rung']).sort((a,b)=>b.price-a.price).forEach((e,i)=>m[e.id]='Buy '+(i+1));
  by(['rebuy_rung']).sort((a,b)=>b.price-a.price).forEach((e,i)=>m[e.id]='Re-buy '+(i+1));
  by(['sell_target']).sort((a,b)=>a.price-b.price).forEach((e,i)=>m[e.id]=by(['sell_target']).length>1?'Sell '+(i+1):'Sell');
  by(['runner']).sort((a,b)=>a.price-b.price).forEach((e,i)=>m[e.id]=by(['runner']).length>1?'Rest '+(i+1):'Rest');
  list.forEach(e=>{if(!m[e.id])m[e.id]=KW[e.kind]||e.kind;});return m;}

function extraBit(e){
  const n=e.notes||'';
  if(/Open clash/i.test(n))return 'This buy sits on an exit line — do not set it until that exit is cleared.';
  if(/Over seat weight|capitulation flush only/i.test(n))return 'Only buy this on a deep drop.';
  if(/set only after BTC weekly trend/i.test(n))return "Don't place this until Bitcoin's weekly trend turns up.";
  if(/Above the \$[\d,.]+ cost basis only|no loss close/i.test(n))return "Only sell above cost — don't close at a loss.";
  if(/Covered calls only with strikes above cost/i.test(n))return 'Covered calls only with strikes above cost.';
  return '';}
function rangePx(e){
  const a=px(e.price);
  if(e.price_hi!=null&&Math.abs(e.price_hi-e.price)>Math.max(0.005,Math.abs(e.price)*0.001))return a+' to '+px(e.price_hi);
  return a;}
function plainCta(e,t){
  const sz=sizeLong(e,t);
  const p=rangePx(e);
  const n=e.notes||'';
  let s='';
  if(e.kind==='buy_rung'||e.kind==='rebuy_rung'){
    const verb=e.kind==='rebuy_rung'?'Buy back':'Buy';
    if(/pullback after a close above/i.test(n)||/close above \d/i.test((e.trigger||'')+' '+n))
      s=`${verb}${sz?' '+sz:''} if ${t} pulls back to ${p} after it first closes at the breakout.`;
    else
      s=`${verb}${sz?' '+sz:''} if ${t} drops to ${p}.`;
    if(needsBounce(e)) s+=' Wait for the bounce signal.';
  }else if(e.kind==='strength_add'){
    s=`Add${sz?' '+sz:''} if ${t} holds above ${p}.`;
  }else if(e.kind==='sell_target'){
    if(/tax-loss/i.test(n)) s=`Sell if ${t} reaches ${p}. Use this for the tax-loss sale, or sell by Dec 14.`;
    else if(/T1 if assigned|T2 if assigned/i.test(n)) s=`If the put is assigned, sell shares if ${t} reaches ${p}.`;
    else if(/Exit 1 \(gain on/i.test(n)) s=`Sell if ${t} reaches ${p}. That would be a gain on the roughly $1,300 cost.`;
    else s=`Sell${sz?' '+sz:''} if ${t} reaches ${p}.`;
  }else if(e.kind==='runner'){
    s=`Sell the rest if ${t} reaches ${p}.`;
  }else if(e.kind==='kill_line'){
    if(/cuts half|E\*TRADE 200/i.test(n)) s=`If the week closes under ${p}, sell half of the E*TRADE shares.`;
    else if(/Robinhood/i.test(n)) s=`If ${t} falls under ${p}, sell the Robinhood shares.`;
    else if(/buy the put back/i.test(n)) s=`If the week closes under ${p}, buy the put back to close it.`;
    else if(/sell all/i.test(n)) s=`If the week closes under ${p}, sell the whole position.`;
    else if(weeklyKill(e)) s=`Exit if the week closes below ${p}.`;
    else s=`Exit if the price falls to ${p}.`;
  }else if(e.kind==='option'){
    if(/Buy to close the short Dec 18 \$360 call/i.test(n))
      s='Buy back the December 18 $360 call if you can get it at $0.30 or less.';
    else if(/Short .*put/i.test(n))
      s=`This is the short put at ${p}. If it is assigned, that is how we enter.`;
    else s=`Option at ${p}.`;
  }else s='';
  const x=extraBit(e);
  if(x && (s.match(/\./g)||[]).length<2) s=(s?s+' ':'')+x;
  return s.trim();}
function endOf(e){const h=e.status_history||[];const last=h[h.length-1];return last&&!ACTIVE.has(last.status)&&last.status!=='filled'?last.at:null;}

function collapse(list){
  const byKey={};
  list.forEach(e=>{
    if(e.price==null)return;
    const key=e.kind+'@'+Number(e.price).toPrecision(8);
    if(!byKey[key]) byKey[key]=e;
    else{
      const cur=byKey[key];
      const prefer=/HOLDING STOP|existing position|cuts half|Robinhood/i.test(e.notes||'');
      const pick=prefer?e:cur;
      const ids=(cur._ids||[cur.id]).concat(e.id);
      byKey[key]=Object.assign({},pick,{_ids:ids,_group:(cur._group||[cur]).concat(e)});
    }
  });
  return Object.values(byKey).concat(list.filter(e=>e.price==null));}

function liveEntries(ents,last,includePerp){
  const lc=last?last.close:null;
  return ents.filter(e=>{
    if(!ACTIVE.has(e.status))return false;
    if(e.chart===false)return false;
    if(isPerp(e)&&!includePerp)return false;
    if(e.kind==='option'&&lc&&e.price!=null&&Math.abs(e.price/lc-1)>0.6)return false;
    return true;
  });}

function delayedStart(e){
  const n=(e.notes||'')+' '+(e.trigger||'');
  if(/Relevel on Jan 15|Re-entry R\d|Re-entry ladder kill/i.test(n))return '2027-01-15';
  return null;}

function groupPlans(ents,last,assetType,opts){
  const includePerp=opts&&opts.perp;
  const live=collapse(liveEntries(ents,last,includePerp));
  const buckets={};
  live.forEach(e=>{
    const delay=delayedStart(e);
    const key=(e.set||e.set_label||'plan')+'|'+(delay||'now');
    (buckets[key]=buckets[key]||{key,set:e.set,set_label:e.set_label,perp:isPerp(e),startHint:delay,items:[]}).items.push(e);
  });
  return Object.values(buckets).map(b=>{
    const items=b.items;
    const start=b.startHint||minDay(items,assetType);
    const buys=items.filter(e=>e.kind==='buy_rung'||e.kind==='rebuy_rung').sort((a,c)=>c.price-a.price);
    const sells=items.filter(e=>e.kind==='sell_target'||e.kind==='runner').sort((a,c)=>a.price-c.price);
    const stops=items.filter(e=>e.kind==='kill_line').sort((a,c)=>c.price-a.price);
    const other=items.filter(e=>!['buy_rung','rebuy_rung','sell_target','runner','kill_line'].includes(e.kind));
    // weighted average buy for R:R
    let tw=0,tp=0;
    buys.forEach(e=>{const w=e.size_usd||(unitsOf(e)&&e.price?Math.abs(unitsOf(e)*e.price):1);tw+=w;tp+=e.price*w;});
    const avg=tw?tp/tw:null;
    const firstT=sells[0];
    const hard=stops[stops.length-1]||stops[0];
    let rr=null;
    if(avg&&firstT&&hard&&avg>hard.price){const risk=avg-hard.price;if(risk>0)rr=(firstT.price-avg)/risk;}
    return {id:b.key,set_label:b.set_label,perp:b.perp,old:false,start,buys,sells,stops,other,items,avg,firstT,hard,rr};
  });}

function minDay(items,at){
  const ds=items.map(e=>dayFor(e.created_at,at)).sort();
  return ds[0];}

function addDays(ymd,n){
  const d=new Date(ymd+'T00:00:00Z');
  d.setUTCDate(d.getUTCDate()+n);
  return d.toISOString().slice(0,10);}

function colorFor(e,g){
  if(e.kind==='buy_rung'||e.kind==='rebuy_rung'){
    const arr=g.buys;return scaleColor(GREENS,arr.indexOf(e),arr.length);}
  if(e.kind==='sell_target'||e.kind==='runner'){
    const arr=g.sells;const i=arr.indexOf(e);
    return scaleColor(ORANGES,i<0?0:i,arr.length);}
  if(e.kind==='kill_line'){
    const arr=g.stops;
    if(arr.length<=1)return REDS[REDS.length-1];
    return scaleColor(REDS,arr.indexOf(e),arr.length);}
  if(e.kind==='option')return C.opt;
  if(e.kind==='strength_add')return C.add;
  return colorOf(e);}

function placeGroup(g,assetType){
  /* Fork on the price × time grid: down-path (buys then harder stops)
     goes later as it gets deeper; up-path (first target then runner)
     goes later as targets get further away. Explicit dates win.
     Live marks start just after the last candle so they don't sit on the price action. */
  const span=TF==='W'?4:16;
  const tick=TF==='W'?1:5;
  const lastI=Math.max(0,bars.length-1);
  let startL=logicalOf(g.start,assetType);
  if(!g.old && startL<=lastI) startL=lastI+1;
  const spaced=(n,from,to)=>{
    if(n<=0)return [];
    if(n===1)return [from];
    return Array.from({length:n},(_,i)=>from+(to-from)*i/(n-1));
  };
  const marks=[];
  const buyOff=spaced(g.buys.length,0,span*0.7);
  g.buys.forEach((e,i)=>{const L=startL+buyOff[i];marks.push(markOf(e,g,L,L+tick));});
  const stopFrom=g.buys.length?span*0.7:0;
  const stopOff=spaced(g.stops.length,stopFrom,span);
  g.stops.forEach((e,i)=>{const L=startL+stopOff[i];marks.push(markOf(e,g,L,L+tick));});
  const sellOff=spaced(g.sells.length,0,span);
  g.sells.forEach((e,i)=>{const L=startL+sellOff[i];marks.push(markOf(e,g,L,L+tick));});
  g.other.forEach((e,i)=>{const L=startL+i;marks.push(markOf(e,g,L,L+tick));});
  return marks;}

function markOf(e,g,L0,L1){
  return {id:e.id,ids:e._ids||[e.id],e,g,price:e.price,L0,L1,color:colorFor(e,g),faint:g.perp,old:g.old};}

function oldGroups(ents,assetType){
  const old=ents.filter(e=>!ACTIVE.has(e.status)&&e.status!=='filled'&&e.price!=null&&e.chart!==false);
  const buckets={};
  old.forEach(e=>{
    const key=e.set||e.set_label||e.id;
    (buckets[key]=buckets[key]||[]).push(e);
  });
  return Object.values(buckets).map((items,i)=>{
    const collapsed=collapse(items);
    const buys=collapsed.filter(e=>e.kind==='buy_rung'||e.kind==='rebuy_rung').sort((a,c)=>c.price-a.price);
    const sells=collapsed.filter(e=>e.kind==='sell_target'||e.kind==='runner').sort((a,c)=>a.price-c.price);
    const stops=collapsed.filter(e=>e.kind==='kill_line').sort((a,c)=>c.price-a.price);
    const other=collapsed.filter(e=>!['buy_rung','rebuy_rung','sell_target','runner','kill_line'].includes(e.kind));
    const start=minDay(items,assetType);
    return {id:'old-'+i,set_label:items[0].set_label,perp:isPerp(items[0]),old:true,start,buys,sells,stops,other,items:collapsed,avg:null,firstT:null,hard:null,rr:null};
  });}

let P=null,B=null,chart=null,series=null,TK=null,TF='D',bars=[],AT='stock';
let marks=[],rangeFn=null,ro=null,hoverId=null;
const qs=new URLSearchParams(location.search);

function tickers(){const m={};(P.entries||[]).forEach(e=>{const t=e.ticker;m[t]=m[t]||{t,last:'',house:0,perp:0,at:e.asset_type};
  if(e.created_at>m[t].last)m[t].last=e.created_at;
  if(ACTIVE.has(e.status)){if(isPerp(e))m[t].perp++;else m[t].house++;}});
  (P.events||[]).forEach(v=>{if(m[v.ticker]&&v.at>m[v.ticker].last)m[v.ticker].last=v.at;});
  return Object.values(m).sort((a,b)=>b.last.localeCompare(a.last)||a.t.localeCompare(b.t));}

function paintPicker(){const list=tickers();
  $('#tkpick').innerHTML=list.map(x=>{
    const n=showPerp()?(x.house+x.perp):x.house;
    const sm=n?`<small>${n}</small>`:(x.perp?`<small class="perp">perp</small>`:'');
    return `<button data-tk="${esc(x.t)}" class="${x.t===TK?'on':''}">${esc(x.t)}${sm}</button>`;
  }).join('');}

function toWeekly(d){const out=[];let cur=null;
  d.forEach(b=>{const dt=new Date(b.time+'T00:00:00Z');const wd=(dt.getUTCDay()+6)%7;dt.setUTCDate(dt.getUTCDate()-wd);const wk=dt.toISOString().slice(0,10);
    if(!cur||cur.time!==wk){cur={time:wk,open:b.open,high:b.high,low:b.low,close:b.close};out.push(cur);}
    else{cur.high=Math.max(cur.high,b.high);cur.low=Math.min(cur.low,b.low);cur.close=b.close;}});return out;}
function snap(day){if(!bars.length)return null;let lo=0,hi=bars.length-1;if(day<=bars[0].time)return bars[0].time;if(day>=bars[hi].time)return bars[hi].time;
  while(lo<hi){const mid=(lo+hi+1)>>1;if(bars[mid].time<=day)lo=mid;else hi=mid-1;}return bars[lo].time;}
function dayFor(iso,at){return at==='crypto'?utcDay(iso):etDay(iso);}

function logicalOf(dateStr,at){
  if(!bars.length)return 0;
  const last=bars[bars.length-1].time;
  if(dateStr<=last){
    const s=snap(dateStr);
    const i=bars.findIndex(b=>b.time===s);
    return i<0?0:i;
  }
  const days=(Date.parse(dateStr+'T00:00:00Z')-Date.parse(last+'T00:00:00Z'))/86400000;
  const future=TF==='W'?days/7:(at==='crypto'?days:days*5/7);
  return (bars.length-1)+Math.max(0,future);}

async function loadCandles(t,at){
  const baked=await get('candles/'+encodeURIComponent(t)+'.json');let rows={};let src=baked?baked.source:'';
  (baked&&baked.bars||[]).forEach(r=>rows[r[0]]={time:r[0],open:r[1],high:r[2],low:r[3],close:r[4]});
  if(at==='crypto'){try{const r=await fetch('https://api.exchange.coinbase.com/products/'+t+'-USD/candles?granularity=86400');
      if(r.ok){const j=await r.json();j.forEach(c=>{const d=new Date(c[0]*1000).toISOString().slice(0,10);rows[d]={time:d,open:c[3],high:c[2],low:c[1],close:c[4]};});src='Coinbase '+t+'-USD daily (live)';}}catch(e){}}
  return {bars:Object.values(rows).sort((a,b)=>a.time.localeCompare(b.time)),src,baked:baked&&baked.baked_at};}

function clearChart(){
  if(rangeFn&&chart){try{chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeFn);}catch(err){}}
  rangeFn=null;
  if(ro){try{ro.disconnect();}catch(err){}} ro=null;
  ['chplot','chaxis'].forEach(id=>{const n=document.getElementById(id);if(n)n.remove();});
  if(chart){chart.remove();chart=null;}series=null;marks=[];
}

function paneBox(){
  const el=$('#chart');
  const w=el.clientWidth,h=el.clientHeight;
  let psW=56,tsH=26;
  try{const pw=chart.priceScale('right').width();if(pw&&pw>12)psW=pw;}catch(err){}
  try{
    const root=chart.chartElement();
    const table=root&&root.querySelector('table');
    if(table&&table.rows&&table.rows.length>=2){
      const rh=table.rows[1].getBoundingClientRect().height;
      if(rh>8&&rh<80)tsH=rh;
      if(table.rows[0].cells.length>=2){
        const cw=table.rows[0].cells[1].getBoundingClientRect().width;
        if(cw>20&&cw<160)psW=cw;
      }
    }
  }catch(err){}
  return {w,h,psW,tsH,pw:w-psW,ph:h-tsH};}

function ensureLayers(){
  const el=$('#chart');
  let plot=$('#chplot'),axis=$('#chaxis');
  if(!plot){plot=document.createElement('div');plot.id='chplot';plot.innerHTML='<svg xmlns="http://www.w3.org/2000/svg"></svg>';el.appendChild(plot);}
  if(!axis){axis=document.createElement('div');axis.id='chaxis';el.appendChild(axis);}
  const p=paneBox();
  plot.style.cssText=`position:absolute;top:0;left:0;width:${p.pw}px;height:${p.ph}px;overflow:hidden;pointer-events:none;z-index:2;`;
  axis.style.cssText=`position:absolute;top:0;left:${p.pw}px;width:${p.psW}px;height:${p.ph}px;overflow:hidden;pointer-events:none;z-index:3;`;
  const svg=plot.querySelector('svg');
  svg.setAttribute('width',p.pw);svg.setAttribute('height',p.ph);
  svg.setAttribute('viewBox',`0 0 ${p.pw} ${p.ph}`);
  return {plot,axis,svg,p};}

function layoutMarks(){
  if(!chart||!series)return;
  const {axis,svg,p}=ensureLayers();
  const lastI=Math.max(0,bars.length-1);
  const xOf=L=>{
    const ts=chart.timeScale();
    const x=ts.logicalToCoordinate(L);
    if(x!=null && !(x<=0 && L>lastI)) return x;
    const xa=ts.logicalToCoordinate(lastI), xb=ts.logicalToCoordinate(Math.max(0,lastI-10));
    if(xa==null||xb==null||lastI===0) return (x!=null&&x>0)?x:null;
    const pxPer=(xa-xb)/Math.max(1,lastI-Math.max(0,lastI-10));
    const est=xa+(L-lastI)*pxPer;
    return est;
  };
  const yOf=pr=>series.priceToCoordinate(pr);
  const parts=[];
  marks.forEach(m=>{
    const y=yOf(m.price);const x0=xOf(m.L0);const x1=xOf(m.L1);
    if(y==null||y<-8||y>p.ph+8){m._x=null;m._y=null;return;}
    if((x0==null||x0<2)&&(x1==null||x1<2)){m._x=null;m._y=null;return;}
    const xa=(x0==null||x0<2)?x1:x0, xb=(x1==null||x1<2)?x0:x1;
    m._x=xa;m._y=y;
    const cls=['mark',m.faint?'faint':'',m.old?'old':'',hoverId===m.id?'on':''].filter(Boolean).join(' ');
    const xEnd=Math.max(xa+10,xb);
    parts.push(`<g class="${cls}" data-id="${esc(m.id)}">
      <line class="tick" x1="${xa.toFixed(1)}" y1="${y.toFixed(1)}" x2="${xEnd.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${esc(m.color)}" stroke-width="${m.old?1:2}" stroke-linecap="round" ${m.old?'stroke-dasharray="3 3"':m.faint?'stroke-dasharray="5 3"':''}/>
      <circle class="pt" cx="${xa.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${esc(m.color)}" stroke="#fff" stroke-width="1.4"/>
      <circle class="hit" cx="${xa.toFixed(1)}" cy="${y.toFixed(1)}" r="10"/>
    </g>`);
  });
  svg.innerHTML=parts.join('');
  svg.querySelectorAll('.mark').forEach(g=>{
    const id=g.getAttribute('data-id');
    g.addEventListener('pointerenter',()=>setHover(id));
    g.addEventListener('pointerleave',()=>setHover(null));
  });
  // bare price tags on the right axis only — never over the candles
  const tags=marks.filter(m=>!m.old&&m._y!=null).map(m=>({m,y:m._y})).sort((a,b)=>a.y-b.y);
  const gap=13;
  for(let i=1;i<tags.length;i++){if(tags[i].y<tags[i-1].y+gap)tags[i].y=tags[i-1].y+gap;}
  if(tags.length&&tags[tags.length-1].y>p.ph-8){
    const over=tags[tags.length-1].y-(p.ph-8);
    tags.forEach(t=>t.y-=over);
  }
  if(tags.length&&tags[0].y<8){
    const need=8-tags[0].y;tags.forEach(t=>t.y+=need);
    if(tags[tags.length-1].y>p.ph-8){
      const span=(p.ph-16)/Math.max(1,tags.length-1);
      tags.forEach((t,i)=>t.y=8+i*span);
    }
  }
  axis.innerHTML=tags.map(t=>`<span data-id="${esc(t.m.id)}" class="${hoverId===t.m.id?'on':''}" style="top:${t.y.toFixed(1)}px;border-left-color:${esc(t.m.color)}">${esc(axisNum(t.m.price))}</span>`).join('');
}

function hoverText(id){
  const m=marks.find(x=>x.id===id||(x.ids||[]).includes(id));
  if(!m)return '';
  const e=m.e,t=TK;
  const nm=names(m.g.items);
  const label=nm[e.id]||KW[e.kind]||e.kind;
  const sz=sizeShort(e);
  const delayed=delayedStart(e)||(m.g.start&&m.g.start>'2026-11-23'?m.g.start:null);
  const when=delayed?`Expected from ${short(delayed+'T12:00:00-05:00')}.`:'';
  return `<b>${esc(label)}</b> · ${esc(px(e.price))}${sz?' · '+esc(sz):''}${m.g.perp?' · Perp Desk':''} <span class="pill ${placedClass(e)}">${esc(placedLabel(e))}</span><div>${esc(plainCta(e,t))}${when?' '+esc(when):''}</div>`;}

function setHover(id){
  hoverId=id;
  const box=$('#chhover');
  if(box) box.innerHTML=id?hoverText(id):'<span class="muted">Hover a mark or a row in the list to see what that level is for.</span>';
  document.querySelectorAll('#chplot .mark').forEach(g=>g.classList.toggle('on',g.getAttribute('data-id')===id));
  document.querySelectorAll('#chaxis span').forEach(s=>s.classList.toggle('on',s.getAttribute('data-id')===id));
  document.querySelectorAll('#levels tr[data-id]').forEach(r=>{
    const ids=(r.getAttribute('data-id')||'').split(',');
    r.classList.toggle('on',!!id&&ids.includes(id));
  });
}

function drawChart(t,ents,at,last){
  clearChart();
  const el=$('#chart');
  chart=LightweightCharts.createChart(el,{autoSize:true,layout:{background:{color:'#fff'},textColor:'#33464f',fontFamily:'-apple-system,Segoe UI,Inter,sans-serif'},
    grid:{vertLines:{color:'#f0f3f4'},horzLines:{color:'#f0f3f4'}},rightPriceScale:{borderColor:'#e3e8eb'},timeScale:{borderColor:'#e3e8eb',rightOffset:8},crosshair:{mode:0}});
  const groups=groupPlans(ents,last,at,{perp:showPerp()});
  const faded=showOld()?oldGroups(ents,at):[];
  const all=groups.concat(faded);
  marks=all.flatMap(g=>placeGroup(g,at));
  const lc=last?last.close:null;
  const inRange=marks.filter(m=>!m.old&&m.price!=null&&(!lc||(m.price>lc*0.45&&m.price<lc*1.8))).map(m=>m.price);
  series=chart.addCandlestickSeries({upColor:'#1e8a4c',downColor:'#c0392b',borderVisible:false,wickUpColor:'#1e8a4c',wickDownColor:'#c0392b',
    lastValueVisible:false,priceLineVisible:false,
    autoscaleInfoProvider:orig=>{const r=orig();if(!r||!inRange.length)return r;return {priceRange:{minValue:Math.min(r.priceRange.minValue,...inRange),maxValue:Math.max(r.priceRange.maxValue,...inRange)}};}});
  series.setData(bars);
  // actual fills only — no wording on the candles
  const mk=[];
  grouped(t,at).forEach(f=>{if(f._kind==='option')return;const p=+f.price;if(lc&&(p<lc*0.2||p>lc*5))return;const d=snap(dayFor(f.ts,at));if(!d||!bars.length||d<bars[0].time)return;
    const buy=String(f.side).toUpperCase()==='BUY';mk.push({time:d,position:buy?'belowBar':'aboveBar',color:buy?'#1e8a4c':'#c0392b',shape:buy?'arrowUp':'arrowDown',text:''});});
  mk.sort((a,b)=>a.time.localeCompare(b.time));series.setMarkers(mk);
  const lastI=Math.max(0,bars.length-1);
  const maxL=marks.reduce((m,x)=>Math.max(m,x.L1||0),lastI);
  const extra=Math.max(8,Math.ceil(maxL-lastI+3));
  const from=Math.max(0,lastI-(TF==='W'?80:130));
  const to=lastI+extra;
  chart.timeScale().applyOptions({rightOffset:extra,fixRightEdge:false});
  chart.timeScale().setVisibleLogicalRange({from,to});
  rangeFn=()=>layoutMarks();
  chart.timeScale().subscribeVisibleLogicalRangeChange(rangeFn);
  if(typeof ResizeObserver!=='undefined'){ro=new ResizeObserver(()=>layoutMarks());ro.observe(el);}
  requestAnimationFrame(()=>{layoutMarks();setTimeout(layoutMarks,200);setTimeout(layoutMarks,600);});
}

function fillsFor(t){return (B&&B.fills||[]).map(f=>{const [u,k]=underlying(f.symbol);return Object.assign({},f,{_u:u,_kind:k});}).filter(f=>f._u===t&&f.price);}
function grouped(t,at){const g={};fillsFor(t).forEach(f=>{const key=dayFor(f.ts,at)+'|'+String(f.side).toUpperCase()+'|'+f._kind+'|'+f.account+'|'+(f._kind==='option'?f.symbol:'');
  const q=Math.abs(+f.qty||0),n=Math.abs(+f.notional||q*f.price);const x=g[key]=g[key]||{ts:f.ts,side:String(f.side).toUpperCase(),_kind:f._kind,account:f.account,symbol:f.symbol,qty:0,notional:0,ids:[],n:0};
  x.qty+=q;x.notional+=n;x.ids.push(fid(f));x.n++;if(f.ts>x.ts)x.ts=f.ts;});
  return Object.values(g).map(x=>Object.assign(x,{price:x._kind==='option'?(x.notional/x.qty/100):x.notional/x.qty}));}

function detailsBox(e){
  const bits=[];
  if(e.set_label)bits.push('<div><b>Set.</b> '+esc(e.set_label)+'</div>');
  if(e.trigger)bits.push('<div><b>Trigger.</b> '+esc(e.trigger)+'</div>');
  if(e.notes)bits.push('<div><b>Notes.</b> '+esc(e.notes)+'</div>');
  if(e.id)bits.push('<div><b>Id.</b> '+esc(e.id)+((e._ids&&e._ids.length>1)?' · also '+esc(e._ids.filter(x=>x!==e.id).join(', ')): '')+'</div>');
  if(!bits.length)return '';
  return `<details class="det"><summary></summary><div class="box">${bits.join('')}</div></details>`;}

function summarize(g,t){
  const bits=[];
  if(g.buys.length){
    const lo=g.buys[g.buys.length-1],hi=g.buys[0];
    const sh=g.buys.reduce((s,e)=>s+(sizeShort(e)?unitsOf(e)||0:0),0);
    const stock=g.buys.every(e=>(e.asset_type||'stock')==='stock'&&!isPerp(e));
    const usdSum=g.buys.reduce((s,e)=>s+(e.size_usd||0),0);
    const sz=stock&&sh?Math.round(sh)+' sh':(usdSum?usd(usdSum):'');
    bits.push(hi.price!==lo.price?`Buy ${px(hi.price)}–${px(lo.price)}${sz?' · '+sz:''}`:`Buy ${px(hi.price)}${sz?' · '+sz:''}`);
  }
  if(g.hard) bits.push('Exit '+px(g.hard.price)+(g.stops.length>1?` (${g.stops.length} exits)`:''));
  if(g.sells.length){
    const a=g.sells[0],b=g.sells[g.sells.length-1];
    bits.push(g.sells.length===1||a.price===b.price?'First sell '+px(a.price):`Sells ${px(a.price)}–${px(b.price)}`);
  }
  const rr=g.rr!=null&&isFinite(g.rr)&&g.rr>0?`<span class="rr">${g.rr>=10?g.rr.toFixed(0):g.rr.toFixed(1)} to 1</span> reward to risk, from the average buy to the first sell versus the exit.`:'';
  const title=g.perp?'Perp Desk proposal':(delayedStart(g.buys[0]||g.stops[0]||{})?'Re-entry from '+short(g.start+'T12:00:00-05:00'):'House plan');
  return `<div class="boxsum"><b>${esc(title)}</b>${esc(bits.join(' · '))}${rr?'<div>'+rr+'</div>':''}</div>`;}

function paintSide(t,ents,at,last){
  const houseLive=ents.filter(e=>ACTIVE.has(e.status)&&isHouse(e));
  const perpLive=ents.filter(e=>ACTIVE.has(e.status)&&isPerp(e));
  const groups=groupPlans(ents,last,at,{perp:showPerp()});
  const order={sell_target:0,runner:0,strength_add:1,option:2,buy_rung:3,rebuy_rung:3,kill_line:4};
  const list=groups.flatMap(g=>g.items.slice().sort((a,b)=>(order[a.kind]-order[b.kind])||((b.price||0)-(a.price||0))));
  const nm=names(list);
  const old=ents.filter(e=>!ACTIVE.has(e.status)&&e.status!=='filled');
  const row=(e,o)=>{
    const st=placedClass(e);
    const end=endOf(e);
    const label=o?(KW[e.kind]||e.kind):(nm[e.id]||KW[e.kind]||e.kind);
    const cta=o?`${short(e.created_at)} → ${end?short(end):''}`:plainCta(e,t);
    const ids=(e._ids||[e.id]).join(',');
    const col=o?C.old:(()=>{const m=marks.find(x=>x.id===e.id||(x.ids||[]).includes(e.id));return m?m.color:colorOf(e);})();
    return `<tr class="${o?'old':''}" data-id="${esc(ids)}"><td class="p"><span class="k" style="background:${col}"></span>${e.price!=null?px(e.price):'—'}${e.price_hi&&Math.abs(e.price_hi-e.price)>Math.abs(e.price)*0.001?'–'+px(e.price_hi):''}</td>
    <td><b>${esc(label)}</b> <span class="pill ${st}">${esc(placedLabel(e))}</span>
    <div class="cta">${esc(cta)}</div>${o?'':detailsBox(e)}</td></tr>`;};
  let lead='';
  if(!houseLive.length&&perpLive.length&&!showPerp()){
    lead=`<div class="callout">No house plan for ${esc(t)}. There ${perpLive.length===1?'is':'are'} ${perpLive.length} Perp Desk proposal${perpLive.length===1?'':'s'} — turn on “Show Perp Desk levels” to see them. None are placed.</div>`;
  }else if(!groups.length){
    lead=`<div class="callout">No live levels for ${esc(t)}.</div>`;
  }else{
    lead=groups.map(g=>summarize(g,t)).join('');
    if(houseLive.length&&perpLive.length&&!showPerp())
      lead+=`<div class="callout" style="margin-top:8px">${perpLive.length} Perp Desk level${perpLive.length===1?' is':'s are'} hidden.</div>`;
  }
  $('#lvlead').innerHTML=lead;
  $('#levels').innerHTML=(list.length?list.map(e=>row(e,false)).join(''):'<tr><td class="muted">No live levels in this view.</td></tr>')+
    (old.length?`<tr><td colspan="2"><details style="margin:4px 0 0" ${showOld()?'open':''}><summary>${old.length} old plan${old.length===1?'':'s'}</summary><table class="lv">${old.map(e=>row(e,true)).join('')}</table></details></td></tr>`:'');
  const lv=$('#levels');
  lv.querySelectorAll('tr[data-id]').forEach(r=>{
    r.addEventListener('pointerenter',()=>setHover((r.getAttribute('data-id')||'').split(',')[0]));
    r.addEventListener('pointerleave',()=>setHover(null));
  });
  const items=(P.events||[]).filter(v=>v.ticker===t).map(v=>({at:v.at,kind:v.kind,text:v.text}));
  ents.forEach(e=>(e.status_history||[]).forEach(h=>{if(['created','superseded'].includes(h.status)||h.note==='created'||h.by==='match')return;
    if(h.status==='superseded')return;items.push({at:h.at,kind:h.status==='filled'?'fill':'note',text:`${KW[e.kind]||e.kind} ${px(e.price)} → ${h.status}${h.note?': '+h.note:''}`});}));
  items.sort((a,b)=>b.at.localeCompare(a.at));
  $('#timeline').innerHTML=items.map(i=>`<li class="${esc(i.kind)}"><time>${esc(shortT(i.at))}</time>${esc(i.text)}</li>`).join('')||'<li>No plan changes yet.</li>';
  const matched={};P.entries.forEach(e=>(e.fills||[]).forEach(id=>matched[id]=e));
  const fl=grouped(t,at).sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,10);
  $('#fills').innerHTML=fl.map(f=>{const m=f.ids.map(i=>matched[i]).find(Boolean);return `<li>${esc(short(f.ts))}: <b>${esc(f.side)}</b> ${f.qty.toLocaleString('en-US',{maximumFractionDigits:4})} ${esc(f._kind==='perp'?'perp':f._kind==='option'?f.symbol:'')} @ ${f.n>1?'avg ':''}${px(f.price)} <span class="muted">${esc(f.account)}${f.n>1?' · '+f.n+' fills':''}</span>${m?` <span class="pill filled">${esc((KW[m.kind]||m.kind)+' '+px(m.price))}</span>`:' <span class="muted">· not tied to a plan</span>'}</li>`;}).join('')||'<li class="muted">No fills in the latest API window.</li>';
}

function hintFor(t,ents,last){
  const house=ents.filter(e=>ACTIVE.has(e.status)&&isHouse(e));
  const perp=ents.filter(e=>ACTIVE.has(e.status)&&isPerp(e));
  const groups=groupPlans(ents,last,AT,{perp:showPerp()});
  const n=groups.reduce((s,g)=>s+g.items.length,0);
  if(!house.length&&perp.length&&!showPerp())
    return `No house plan on the chart. ${perp.length} Perp Desk proposal${perp.length===1?' is':'s are'} hidden.`;
  if(!n) return 'No live levels on this chart.';
  const bits=[`${n} level${n===1?'':'s'} marked`];
  if(perp.length&&!showPerp()) bits.push(`${perp.length} Perp Desk hidden`);
  if(!showOld()){
    const old=ents.filter(e=>!ACTIVE.has(e.status)&&e.status!=='filled');
    if(old.length) bits.push(`${old.length} old plan${old.length===1?'':'s'} hidden`);
  }
  return bits.join(' · ')+'.';
}

async function show(t){TK=t;hoverId=null;paintPicker();history.replaceState(null,'','?tk='+encodeURIComponent(t));
  const ents=P.entries.filter(e=>e.ticker===t);const at=(ents[0]||{}).asset_type||'stock';AT=at;
  const cd=await loadCandles(t,at);if(TK!==t)return;
  const daily=cd.bars;bars=TF==='W'?toWeekly(daily):daily;
  $('#src').textContent=(cd.src||'No candles')+(cd.baked?' · baked '+shortT(cd.baked):'')+'. Crypto days are UTC; stock days are ET sessions.';
  const last=daily[daily.length-1];
  $('#pxnow').innerHTML=last?`${esc(t)} <b>${px(last.close)}</b> <span class="muted">${esc(last.time)}</span>`:`${esc(t)} <span class="muted">No price history on file yet</span>`;
  $('#chhint').textContent=hintFor(t,ents,last);
  const ho=$('#chhover');if(ho)ho.innerHTML='<span class="muted">Hover a mark or a row in the list to see what that level is for.</span>';
  if(!bars.length){
    clearChart();
    const el=$('#chart');
    if(el) el.innerHTML='<p class="muted" style="padding:28px 8px">No candles for this name yet. The plan is in the list.</p>';
    paintSide(t,ents,at,last);
    return;
  }
  drawChart(t,ents,at,last);paintSide(t,ents,at,last);}

function bind(){
  $('#tkpick').addEventListener('click',e=>{const b=e.target.closest('button[data-tk]');if(b)show(b.dataset.tk);});
  $('#tf').addEventListener('click',e=>{const b=e.target.closest('button[data-tf]');if(!b)return;TF=b.dataset.tf;document.querySelectorAll('#tf button').forEach(x=>x.classList.toggle('on',x===b));show(TK);});
  $('#showold').addEventListener('change',()=>show(TK));
  $('#showperp').addEventListener('change',()=>show(TK));
  document.addEventListener('click',e=>{if(e.target.closest('[data-refresh]')){e.preventDefault();init();}});
  document.addEventListener('submit',e=>{const f=e.target.closest('form.tks');if(!f)return;e.preventDefault();const v=(f.q.value||'').trim().split(/\s/)[0].toUpperCase();
    if(!v)return;if(P&&P.entries.some(x=>x.ticker===v))show(v);else location.href='ticker.html?tk='+encodeURIComponent(v);});}

async function init(){
  [P,B]=await Promise.all([get('plans.json'),get('book.json')]);
  const a=document.querySelector('[data-asof]');if(a)a.textContent=B&&B.as_of_et?'Holdings as of '+B.as_of_et:'';
  if(!P||!P.entries||!P.entries.length){$('main .chgrid').innerHTML='<section class="card wide">No plans logged yet.</section>';return;}
  if(typeof LightweightCharts==='undefined'){$('#chart').innerHTML='<p class="muted">Chart library did not load. Try Refresh.</p>';}
  const list=tickers();const want=(qs.get('tk')||'').toUpperCase();
  await show(TK||(list.find(x=>x.t===want)||list[0]).t);}
bind();init();
})();
