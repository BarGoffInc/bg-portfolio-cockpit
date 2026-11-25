/* Charts page (2026-11-25b: plans.json hidden_tickers are left out of the picker (SUPER).
   2026-11-25a: Max Buy house recipe rows — rung 1 is drawn at the confirmed Max Buy close when there is one; the weekly-close adds have no price, so they are list rows only (no mark on the chart).
   Was 2026-11-24a: rung 1 of the Nov 24 Max-Buy lines has no price — it buys at the next open — so it sorts first and is left out of the average).
   Was 2026-11-23b. Per-name profile: score, CTA, blurb, chart,
   planned levels, position and P&L. Chart marks are the 2026-11-23a design
   (points on the price × time grid, no text over candles). plans.json is
   not written here. */
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
const bp=e=>e.price==null?Infinity:+e.price;
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
  const m={};const by=k=>list.filter(e=>k.includes(e.kind)&&!e.recipe);
  list.forEach(e=>{if(e.recipe)m[e.id]=e.recipe.role==='add_repeat'?'Add 10% (repeats)':'Buy '+(e.recipe.step||1);});
  by(['buy_rung']).sort((a,b)=>bp(b)-bp(a)).forEach((e,i)=>m[e.id]='Buy '+(i+1));
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
  if(e.recipe&&e.trigger)return e.trigger;
  if(/^lines 2026-11-24/.test(e.source||'')&&e.trigger)return e.trigger;
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
    const buys=items.filter(e=>e.kind==='buy_rung'||e.kind==='rebuy_rung').sort((a,c)=>bp(c)-bp(a));
    const sells=items.filter(e=>e.kind==='sell_target'||e.kind==='runner').sort((a,c)=>a.price-c.price);
    const stops=items.filter(e=>e.kind==='kill_line').sort((a,c)=>c.price-a.price);
    const other=items.filter(e=>!['buy_rung','rebuy_rung','sell_target','runner','kill_line'].includes(e.kind));
    // weighted average buy for R:R
    let tw=0,tp=0;
    buys.forEach(e=>{if(e.price==null)return;const w=e.size_usd||(unitsOf(e)&&e.price?Math.abs(unitsOf(e)*e.price):1);tw+=w;tp+=e.price*w;});
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
  return {id:e.id,ids:e._ids||[e.id],e,g,price:e.price!=null?e.price:(e.mb_close!=null&&e.recipe&&e.recipe.role==='rung1'?e.mb_close:null),L0,L1,color:colorFor(e,g),faint:g.perp,old:g.old};}

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

let P=null,B=null,R=null,HIST=null,ENG=null,PN=null,chart=null,series=null,TK=null,TF='D',bars=[],AT='stock';
let marks=[],rangeFn=null,ro=null,hoverId=null;
const qs=new URLSearchParams(location.search);

function tickers(){const m={};const HID=new Set((P&&P.hidden_tickers)||[]);
  ((P&&P.entries)||[]).forEach(e=>{const t=e.ticker;if(HID.has(t))return;m[t]=m[t]||{t,last:'',house:0,perp:0,at:e.asset_type};
    if(e.created_at>m[t].last)m[t].last=e.created_at;
    if(ACTIVE.has(e.status)){if(isPerp(e))m[t].perp++;else m[t].house++;}});
  ((P&&P.events)||[]).forEach(v=>{if(m[v.ticker]&&v.at>m[v.ticker].last)m[v.ticker].last=v.at;});
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
  return `<b>${esc(label)}</b> · ${esc(px(e.price!=null?e.price:e.mb_close))}${sz?' · '+esc(sz):''}${m.g.perp?' · Perp Desk':''} <span class="pill ${placedClass(e)}">${esc(placedLabel(e))}</span><div>${esc(plainCta(e,t))}${when?' '+esc(when):''}</div>`;}

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

function recipeSum(g){
  const r=g.buys.find(e=>e.recipe);if(!r)return null;const R=r.recipe,b=R.budget||0;
  const mb=R.mb_close!=null?`confirmed Max Buy: week ending ${short(R.mb_week_end+'T12:00:00-05:00')} at ${px(R.mb_close)}`:'no confirmed weekly Max Buy yet';
  return R.cls==='crypto'
    ?`Max Buy recipe (${mb}) · 40% (${usd(b*0.4)}) at the Max Buy close, then 10% (${usd(b*0.1)}) on every Sunday close below the Max Buy close and the lowest paid, up to 2× = ${usd(2*b)} (keep that cash set aside)`
    :`Max Buy recipe (${mb}) · 40% (${usd(b*0.4)}) at the Max Buy close, then 20% (${usd(b*0.2)}) on each Friday close below the Max Buy close and the lowest paid · 4 buys max · budget ${usd(b)}`;}
function summarize(g,t){
  const bits=[];
  const rs=recipeSum(g);
  if(rs) bits.push(rs);
  else if(g.buys.length){
    const pb=g.buys.filter(e=>e.price!=null);const nxt=pb.length<g.buys.length?'Next open on a Max Buy, then ':'';
    const lo=pb[pb.length-1]||g.buys[g.buys.length-1],hi=pb[0]||g.buys[0];
    const sh=g.buys.reduce((s,e)=>s+(sizeShort(e)?unitsOf(e)||0:0),0);
    const stock=g.buys.every(e=>(e.asset_type||'stock')==='stock'&&!isPerp(e));
    const usdSum=g.buys.reduce((s,e)=>s+(e.size_usd||0),0);
    const sz=stock&&sh?Math.round(sh)+' sh':(usdSum?usd(usdSum):'');
    bits.push(nxt+(hi.price!==lo.price?`Buy ${px(hi.price)}–${px(lo.price)}${sz?' · '+sz:''}`:`Buy ${px(hi.price)}${sz?' · '+sz:''}`));
  }
  if(g.hard) bits.push('Exit '+px(g.hard.price)+(g.stops.length>1?` (${g.stops.length} exits)`:''));
  if(g.sells.length){
    const a=g.sells[0],b=g.sells[g.sells.length-1];
    bits.push(g.sells.length===1||a.price===b.price?'First sell '+px(a.price):`Sells ${px(a.price)}–${px(b.price)}`);
  }
  const rr=g.rr!=null&&isFinite(g.rr)&&g.rr>0?`<span class="rr">${g.rr>=10?g.rr.toFixed(0):g.rr.toFixed(1)} to 1</span> reward to risk, from the average buy to the first sell versus the exit.`:'';
  const title=g.perp?'Perp Desk proposal':rs?'House plan — Max Buy recipe':(delayedStart(g.buys[0]||g.stops[0]||{})?'Re-entry from '+short(g.start+'T12:00:00-05:00'):'House plan');
  return `<div class="boxsum"><b>${esc(title)}</b>${esc(bits.join(' · '))}${rr?'<div>'+rr+'</div>':''}</div>`;}

function paintSide(t,ents,at,last){
  const houseLive=ents.filter(e=>ACTIVE.has(e.status)&&isHouse(e));
  const perpLive=ents.filter(e=>ACTIVE.has(e.status)&&isPerp(e));
  const groups=groupPlans(ents,last,at,{perp:showPerp()});
  const order={sell_target:0,runner:0,strength_add:1,option:2,buy_rung:3,rebuy_rung:3,kill_line:4};
  const list=groups.flatMap(g=>g.items.slice().sort((a,b)=>(order[a.kind]-order[b.kind])||(bp(b)-bp(a))));
  const nm=names(list);
  const old=ents.filter(e=>!ACTIVE.has(e.status)&&e.status!=='filled');
  const row=(e,o)=>{
    const st=placedClass(e);
    const end=endOf(e);
    const label=o?(KW[e.kind]||e.kind):(nm[e.id]||KW[e.kind]||e.kind);
    const cta=o?`${short(e.created_at)} → ${end?short(end):''}`:plainCta(e,t);
    const ids=(e._ids||[e.id]).join(',');
    const col=o?C.old:(()=>{const m=marks.find(x=>x.id===e.id||(x.ids||[]).includes(e.id));return m?m.color:colorOf(e);})();
    return `<tr class="${o?'old':''}" data-id="${esc(ids)}"><td class="p"><span class="k" style="background:${col}"></span>${e.price!=null?px(e.price):(e.cond_short?esc(e.cond_short):'—')}${e.price_hi&&Math.abs(e.price_hi-e.price)>Math.abs(e.price)*0.001?'–'+px(e.price_hi):''}</td>
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
  const matched={};((P&&P.entries)||[]).forEach(e=>(e.fills||[]).forEach(id=>matched[id]=e));
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


function nfmt(v){if(v==null||v==='')return '—';const n=+v;if(!isFinite(n))return '—';return String(+n.toFixed(1)).replace(/\.0$/,'');}
function md(s){return esc(s).replace(/`([^`]+)`/g,'<code>$1</code>');}
function money(v,d){if(v==null||v==='')return '—';const n=+v;if(!isFinite(n))return '—';const sign=n<0?'−':'';const a=Math.abs(n);
  if(a>=1000)return sign+'$'+a.toLocaleString('en-US',{maximumFractionDigits:d==null?0:d});
  return sign+'$'+a.toLocaleString('en-US',{maximumFractionDigits:d==null?2:d});}
function signed(v){if(v==null||v==='')return '—';const n=+v;if(!isFinite(n))return '—';const cls=n>0?'posi':n<0?'neg':'';return `<span class="${cls}">${money(n)}</span>`;}
function qtyTxt(v){if(v==null||v==='')return '—';const n=+v;if(!isFinite(n))return '—';
  const a=Math.abs(n);if(a>=100)return (n<0?'−':'')+a.toLocaleString('en-US',{maximumFractionDigits:2});
  return (n<0?'−':'')+a.toLocaleString('en-US',{maximumFractionDigits:a>=1?4:6});}
function boardOf(t){return ((R&&R.board)||[]).find(x=>x.tk===t)||null;}
function engineOf(t){return ((ENG&&ENG.names)||[]).find(x=>x.t===t)||null;}
function pnlOf(t){return ((PN&&PN.names)||[]).find(x=>x.t===t)||null;}
function rankOf(t){const L=((R&&R.board)||[]).slice().sort((a,b)=>b.score-a.score||a.tk.localeCompare(b.tk));
  const i=L.findIndex(x=>x.tk===t);return i<0?null:{rank:i+1,n:L.length,row:L[i]};}
function scoreParts(t){
  const en=engineOf(t), bd=boardOf(t);
  if(en&&en.score)return {score:en.score.score,fund:en.score.fund,chart:en.score.chart,mood:en.score.mood,action:en.score.action,seat:en.score.seat,pillars:en.score.pillars,as_of:en.score.as_of};
  if(!bd)return null;
  const p=bd.pillars||{};
  const fund=((p.business||0)/5)*20+((p.tam||0)/5)*25+((p.crowd||0)/5)*15;
  const chart=((p.tech||0)/5)*30, mood=((p.regime||0)/5)*10;
  return {score:bd.score,fund:Math.round(fund*10)/10,chart:Math.round(chart*10)/10,mood:Math.round(mood*10)/10,action:bd.action,seat:bd.seat,pillars:p,as_of:(R&&R.as_of)||''};}
function acctName(id){
  const a=((B&&B.accounts)||[]).find(x=>x.id===id);
  if(a&&a.name)return a.name;
  return {etrade:'E*TRADE',robinhood:'Robinhood',coinbase:'Coinbase',hyperliquid:'Hyperliquid',solana1:'Solana wallet 1',solana2:'Solana wallet 2',hl_conviction:'Hyperliquid Conviction'}[id]||id;}
function positionsFor(t){
  const out=[];
  Object.entries((B&&B.positions)||{}).forEach(([acct,rows])=>{
    (rows||[]).forEach(p=>{
      const raw=String(p.symbol||'');
      const [u,k]=underlying(raw);
      const base=(u||raw).replace(/\s*\(.*\)$/,'').trim().toUpperCase();
      if(base===t||u===t)out.push(Object.assign({},p,{account:acct,acctName:acctName(acct),_u:base,_kind:k||p.kind||''}));
    });
  });
  return out;}
function nextLevelPrice(t,last){
  const ents=((P&&P.entries)||[]).filter(e=>e.ticker===t&&ACTIVE.has(e.status)&&!isPerp(e)&&e.price!=null);
  if(!ents.length)return null;
  const px0=last&&last.close!=null?last.close:((boardOf(t)||{}).px);
  if(px0==null)return ents.slice().sort((a,b)=>a.price-b.price)[0].price;
  const above=ents.filter(e=>e.price>px0).sort((a,b)=>a.price-b.price);
  const below=ents.filter(e=>e.price<=px0).sort((a,b)=>b.price-a.price);
  // prefer the nearest level we would actually meet next (buy below or sell/exit above, else nearest)
  const buys=below.filter(e=>/buy|rebuy/.test(e.kind));
  const sells=above.filter(e=>/sell|runner|option/.test(e.kind));
  if(sells[0]&&buys[0])return (Math.abs(sells[0].price-px0)<=Math.abs(px0-buys[0].price))?sells[0].price:buys[0].price;
  if(sells[0])return sells[0].price;
  if(buys[0])return buys[0].price;
  const all=ents.slice().sort((a,b)=>Math.abs(a.price-px0)-Math.abs(b.price-px0));
  return all[0]&&all[0].price;}
function openOrdersFor(t){
  const n=engineOf(t);
  const oo=(n&&n.oo)||[];
  return Array.isArray(oo)?oo:[];}
function hasOpenOrder(t){return openOrdersFor(t).length>0||((ENG&&ENG.orders&&ENG.orders.count)>0&&openOrdersFor(t).length>0);}
function placedNow(t){return openOrdersFor(t).length?'An order is already open at the venue.':'Planned, not placed.';}

function buildCta(t,last){
  const n=engineOf(t), bd=boardOf(t), px0=last&&last.close!=null?last.close:(bd&&bd.px);
  const official=n&&n.steps&&n.steps.length&&!/not an approved plan|unless Pablo approves/i.test(n.why||'');
  const oo=openOrdersFor(t);
  const pill=`<span class="pill ${oo.length?'armed':'planned'}">${esc(placedNow(t))}</span>`;
  if(official){
    const head=n.act==='mbbuy'?'Buy now — weekly Max Buy confirmed (buy 1 of the recipe).':n.act==='fill'?'Buy now — the first level has been touched.':n.act==='setbuy'?'Set the buy limits if you want them.':'What to do now.';
    return {kind:'do',head,why:'',steps:n.steps,pill};
  }
  // Logged-plan specials
  const ents=((P&&P.entries)||[]).filter(e=>e.ticker===t&&ACTIVE.has(e.status)&&!isPerp(e));
  if(t==='TSLA'&&px0!=null){
    const tax=ents.find(e=>e.kind==='sell_target'&&/tax-loss/i.test(e.notes||''));
    if(tax&&px0>=tax.price*0.98){
      return {kind:'do',head:'Sell the Robinhood lot for the tax-loss harvest (or sell it by Dec 14).',
        why:'Price is at or above the $366 tax-loss sale. Only the Robinhood lot is a loss. The E*TRADE 200 shares cost about $202, so a sale there would be a gain.',
        steps:[
          'On Robinhood: Sell 110 shares of TSLA, limit price $366.00, good-til-cancelled. This is the tax-loss lot (average cost about $478).',
          'Leave the E*TRADE 200 shares alone for this sale. Those cost about $202.',
          'If you have not sold by Dec 14, sell the Robinhood lot then, per the plan.'
        ],pill};
    }
  }
  const nxt=nextLevelPrice(t,last);
  if(n&&n.recipe&&n.why) return {kind:'idle',head:'Nothing to do now. '+n.why+(nxt!=null?` Next price level ${px(nxt)}.`:''),why:'',steps:[],pill};
  const head=nxt!=null?`Nothing to do now — next level ${px(nxt)}.`:'Nothing to do now.';
  return {kind:'idle',head,why:'',steps:[],pill};}

function paintProfile(t,last){
  const bd=boardOf(t), sc=scoreParts(t), rk=rankOf(t), cta=buildCta(t,last);
  const name=(bd&&bd.name)||t;
  const vc=bd&&bd.vc;
  document.title=t+' · '+name+' · BG Portfolio';
  const pass=bd?!!bd.gate_pass:null;
  const gateTxt=bd&&(bd.gate||((bd.gate_notes||[])[0]))||'';
  const gateHtml=bd?`<div class="gate-row"><span class="gate ${pass?'pass':'fail'}">${pass?'Passes the gate':'Fails the gate'}</span>${gateTxt?`<span class="muted">${esc(gateTxt)}</span>`:''}</div>`:'';
  const bits=sc?`<div class="scorebits">
    <div><small>Company · 60</small><b>${nfmt(sc.fund)}/60</b></div>
    <div><small>Chart · 30</small><b>${nfmt(sc.chart)}/30</b></div>
    <div><small>Mood · 10</small><b>${nfmt(sc.mood)}/10</b></div>
  </div>`:'';
  const left=`<section class="card scorehero">
    <h1>${esc(t)}</h1><div class="co">${esc(name)}${bd&&bd.seat?' · '+esc(bd.seat):''}</div>
    ${sc?`<div class="scoreline"><span class="scorebig">${nfmt(sc.score)}<small>/100</small></span>${rk?`<span class="rank">Rank ${rk.rank} of ${rk.n}</span>`:''}</div>${bits}`:`<p class="muted">No Conviction score on file for ${esc(t)} yet.</p>`}
    <div>${gateHtml}</div>
    ${vc?`<p class="vc-line"><b>${esc(vc.verdict)}.</b> ${esc(vc.line||'')}</p>`:`<p class="vc-line muted">No elite-VC write-up yet.</p>`}
  </section>`;
  const steps=cta.steps&&cta.steps.length?`<ol>${cta.steps.map(x=>`<li>${md(x)}</li>`).join('')}</ol>`:'';
  const right=`<section class="card cta-card">
    <h2>What to do now</h2>
    ${cta.kind==='idle'?`<p class="idle">${esc(cta.head)}</p>`:`<p class="lead">${esc(cta.head)} ${cta.pill}</p>${cta.why?`<p>${esc(cta.why)}</p>`:''}${steps}`}
  </section>`;
  $('#profile').innerHTML=left+right;
  paintBlurb(t,bd,sc);}

function paintBlurb(t,bd,sc){
  const box=$('#blurbwrap');
  if(!bd&&!sc){box.hidden=true;box.innerHTML='';return;}
  const blurb=(bd&&(bd.note||bd.why))||(sc&&sc.action)||'';
  const hist=(HIST&&HIST[t])||[];
  const tech=bd&&bd.tech;
  const parts=[];
  if(bd&&bd.why&&bd.why!==blurb)parts.push(`<p>${esc(bd.why)}</p>`);
  if(bd&&bd.gate)parts.push(`<p><b>Buy gate.</b> ${esc(bd.gate)}</p>`);
  if(bd&&bd.gate_notes&&bd.gate_notes.length)parts.push(`<p><b>Gate notes.</b> ${esc(bd.gate_notes.join('; '))}.</p>`);
  if(sc&&sc.pillars){
    const p=sc.pillars;
    parts.push(`<h3>Score pillars (1–5)</h3><p>Business ${p.business} · Market size ${p.tam} · Crowd ${p.crowd} · Chart ${p.tech} · Mood/regime ${p.regime}. Company is Business + Market + Crowd (60). Chart is the technical pillar (30). Mood is the regime pillar (10).</p>`);
  }
  if(tech){
    const src=tech.src?` <span class="chart-only">${esc(tech.src)}</span>`:'';
    const row=(l,v)=>v==null||v===''?'':`<div><b>${esc(l)}.</b> ${esc(Array.isArray(v)?v.join(' · '):v)}</div>`;
    parts.push(`<h3>Chart checks <span class="chart-only">(chart only — not the company score)</span></h3>${src}
      ${row('Daily Money Line', tech.mlD&&(tech.mlD[0]+(tech.mlD[1]!=null?' at '+px(tech.mlD[1]):'')))}
      ${row('Weekly Money Line', tech.mlW&&(tech.mlW[0]+(tech.mlW[1]!=null?' at '+px(tech.mlW[1]):'')))}
      ${row('Daily Gemini', tech.gD)}
      ${row('Weekly Gemini', tech.gW)}
      ${row('RSI18 vs signal', tech.rsi!=null?(Number(tech.rsi).toFixed(1)+(tech.sig!=null?' vs '+Number(tech.sig).toFixed(1):'')):'')}`);
  }
  if(bd&&bd.vc&&bd.vc.full&&bd.vc.full.length){
    parts.push('<h3>Elite-VC analysis</h3>'+bd.vc.full.map(x=>`<p><b>${esc(x[0])}.</b> ${esc(x[1])}</p>`).join(''));
  }
  if(hist.length){
    const rows=hist.slice().reverse().slice(0,8).map(h=>`<tr><td>${esc(h.date)}</td><td><b>${esc(h.score)}</b></td><td>${esc(h.action||'')}</td><td>${h.px!=null?px(h.px):''}</td></tr>`).join('');
    parts.push(`<h3>Score history</h3><table class="pos"><tr><th>Date</th><th>Score</th><th>Call</th><th>Price</th></tr>${rows}</table>`);
  }
  if(bd&&bd.mcap)parts.push(`<p><b>Market cap.</b> ${esc(bd.mcap)}</p>`);
  if(sc&&sc.as_of)parts.push(`<p class="note">Score as of ${esc(sc.as_of)}.</p>`);
  box.hidden=false;
  box.innerHTML=`<p>${esc(blurb||'No summary on file.')}</p>
    <details><summary>Full analysis and report</summary><div class="full">${parts.join('')||'<p class="muted">No deeper write-up on file.</p>'}</div></details>`;}

function paintPosition(t,ents,at,last){
  const holds=positionsFor(t);
  let html='';
  if(!holds.length) html='<p class="muted-block">Not held.</p>';
  else{
    const rows=holds.map(p=>{
      const kind=p.kind&&p.kind!=='stock'?` <span class="muted">${esc(p.kind)}${p.position_type?' · '+esc(p.position_type):''}</span>`:'';
      const cost=p.cost_basis==null?'<span class="muted">cost not on file</span>':money(p.cost_basis, Math.abs(p.cost_basis)>=10?2:4);
      const gap=p.basis_status==='incomplete_no_fills'?' <span class="muted">· fills incomplete</span>':'';
      return `<tr><td>${esc(p.acctName)}</td><td>${esc(p.symbol)}${kind}</td><td>${qtyTxt(p.qty)}</td><td>${cost}${gap}</td><td>${money(p.mv)}</td><td>${signed(p.uPnL)}${p.uPnL_pct!=null?` <span class="muted">(${p.uPnL_pct>0?'+':p.uPnL_pct<0?'−':''}${Math.abs(p.uPnL_pct).toFixed(1)}%)</span>`:''}</td></tr>`;
    }).join('');
    const totMv=holds.reduce((s,p)=>s+(+p.mv||0),0);
    const totP=holds.every(p=>p.uPnL==null)?null:holds.reduce((s,p)=>s+(+p.uPnL||0),0);
    html=`<div class="pos"><table><tr><th>Account</th><th>Symbol</th><th>Qty</th><th>Avg cost</th><th>Value</th><th>Unrealized P&amp;L</th></tr>${rows}
      <tr class="tot"><td colspan="4">Total</td><td>${money(totMv)}</td><td>${totP==null?'—':signed(totP)}</td></tr></table></div>`;
  }
  $('#position').innerHTML=html;
  // fills — reuse grouped()
  const matched={};((P&&P.entries)||[]).forEach(e=>(e.fills||[]).forEach(id=>matched[id]=e));
  const fl=grouped(t,at).sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,12);
  $('#fills').innerHTML=fl.map(f=>{const m=f.ids.map(i=>matched[i]).find(Boolean);return `<li>${esc(short(f.ts))}: <b>${esc(f.side)}</b> ${f.qty.toLocaleString('en-US',{maximumFractionDigits:4})} ${esc(f._kind==='perp'?'perp':f._kind==='option'?f.symbol:'')} @ ${f.n>1?'avg ':''}${px(f.price)} <span class="muted">${esc(f.account)}${f.n>1?' · '+f.n+' fills':''}</span>${m?` <span class="pill filled">${esc((KW[m.kind]||m.kind)+' '+px(m.price))}</span>`:' <span class="muted">· not tied to a plan</span>'}</li>`;}).join('')||'<li class="muted">No fills in the latest API window.</li>';
  const pn=pnlOf(t);
  const box=$('#namepnl');
  if(!pn){box.innerHTML='<p class="muted-block">No Levels P&amp;L numbers for this name yet.</p>';return;}
  const lv=pn.live_version||{};
  box.innerHTML=`<div class="pnlbits">
    <div><small>Projected (expected)</small><b>${signed(pn.projected_ev)}</b></div>
    <div><small>Best / worst</small><b>${signed(pn.projected_best)} / ${signed(pn.projected_worst)}</b></div>
    <div><small>Actual (API fills)</small><b>${signed(pn.actual_api)}</b></div>
    <div><small>Missed hypothetical</small><b>${signed(pn.missed_hypothetical)}</b></div>
    <div><small>Cost of plan changes</small><b>${signed(pn.cost_of_changes)}</b></div>
    <div><small>Levels</small><b>${esc(String(pn.planned||0))} planned · ${esc(String(pn.placed||0))} placed · ${esc(String(pn.filled||0))} filled</b></div>
  </div>
  <p class="note">${esc(pn.sleeve||'')} · ${esc((lv.label||'')+(lv.created?' · '+lv.created:''))} · ${esc(String(pn.versions||1))} plan version${pn.versions===1?'':'s'}.</p>
  <p><a href="pnl-plans.html">Open the Levels P&amp;L page</a></p>`;}

async function show(t){TK=t;hoverId=null;paintPicker();history.replaceState(null,'','?t='+encodeURIComponent(t));
  const ents=((P&&P.entries)||[]).filter(e=>e.ticker===t);
  const bd=boardOf(t);
  const at=(ents[0]||{}).asset_type||(bd&&bd.cls==='crypto'?'crypto':'stock');AT=at;
  const lastHint={close:(bd&&bd.px),time:''};
  paintProfile(t,lastHint);
  const cd=await loadCandles(t,at);if(TK!==t)return;
  const daily=cd.bars;bars=TF==='W'?toWeekly(daily):daily;
  $('#src').textContent=(cd.src||'No candles')+(cd.baked?' · baked '+shortT(cd.baked):'')+'. Crypto days are UTC; stock days are ET sessions.';
  const last=daily[daily.length-1];
  $('#pxnow').innerHTML=last?`${esc(t)} <b>${px(last.close)}</b> <span class="muted">${esc(last.time)}</span>`:`${esc(t)} <span class="muted">No price history on file yet</span>`;
  $('#chhint').textContent=hintFor(t,ents,last);
  const ho=$('#chhover');if(ho)ho.innerHTML='<span class="muted">Hover a mark or a row in the list to see what that level is for.</span>';
  paintProfile(t,last||lastHint);
  if(!bars.length){
    clearChart();
    const el=$('#chart');
    if(el) el.innerHTML='<p class="muted" style="padding:28px 8px">No candles for this name yet. The plan and the rest of the profile are below.</p>';
    paintSide(t,ents,at,last);paintPosition(t,ents,at,last);
    return;
  }
  drawChart(t,ents,at,last);paintSide(t,ents,at,last);paintPosition(t,ents,at,last);}

function bind(){
  $('#tkpick').addEventListener('click',e=>{const b=e.target.closest('button[data-tk]');if(b)show(b.dataset.tk);});
  $('#tf').addEventListener('click',e=>{const b=e.target.closest('button[data-tf]');if(!b)return;TF=b.dataset.tf;document.querySelectorAll('#tf button').forEach(x=>x.classList.toggle('on',x===b));show(TK);});
  $('#showold').addEventListener('change',()=>show(TK));
  $('#showperp').addEventListener('change',()=>show(TK));
  document.addEventListener('click',e=>{if(e.target.closest('[data-refresh]')){e.preventDefault();init();}});
  document.addEventListener('submit',e=>{const f=e.target.closest('form.tks');if(!f)return;e.preventDefault();const v=(f.q.value||'').trim().split(/\s/)[0].toUpperCase();
    if(!v)return;if((P&&P.entries.some(x=>x.ticker===v))||boardOf(v)||engineOf(v)||positionsFor(v).length)show(v);else location.href='ticker.html?tk='+encodeURIComponent(v);});}

async function init(){
  [P,B,R,HIST,ENG,PN]=await Promise.all([get('plans.json'),get('book.json'),get('ranking.json'),get('score-history.json'),get('engine.json'),get('plan-pnl.json')]);
  const a=document.querySelector('[data-asof]');if(a)a.textContent=B&&B.as_of_et?'Holdings as of '+B.as_of_et:(ENG&&ENG.as_of_et?'Engine as of '+ENG.as_of_et:'');
  if(typeof LightweightCharts==='undefined'){const c=$('#chart');if(c)c.innerHTML='<p class="muted">Chart library did not load. Try Refresh.</p>';}
  const list=tickers();const want=(qs.get('t')||qs.get('tk')||'').toUpperCase();
  const start=want||TK||(list[0]&&list[0].t);
  if(!start){$('#profile').innerHTML='<section class="card">No names on file yet.</section>';return;}
  await show(start);}
bind();init();
})();
