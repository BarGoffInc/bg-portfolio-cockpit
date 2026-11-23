/* Charts page (2026-11-22a). Plan levels from plans.json (append-only, written by plans.py),
   fills from book.json (account APIs), candles from candles/<T>.json (baked each refresh:
   Yahoo for stocks, Coinbase for crypto) with a live Coinbase merge for crypto. */
(function(){
const $=s=>document.querySelector(s);
const bust=u=>u+(u.includes('?')?'&':'?')+'_='+Date.now();
const get=u=>fetch(bust(u),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const px=v=>v==null?'—':v>=1000?'$'+Math.round(v).toLocaleString('en-US'):v>=100?'$'+(+v).toFixed(v%1?2:0):v>=1?'$'+(+v).toFixed(2):'$'+String(+(+v).toPrecision(3));
const usd=v=>v==null?'':v>=1000?'$'+(v/1000).toFixed(v%1000?1:0).replace(/\.0$/,'')+'k':'$'+Math.round(v);
const ACTIVE=new Set(['planned','armed','partially filled']);
const C={buy:'#1e8a4c',rebuy:'#2f9e5b',add:'#0f6e6e',sell:'#e07b24',runner:'#b7791f',kill:'#c0392b',opt:'#2b6cb0',old:'#7c8b92'};
const KW={buy_rung:'Buy',rebuy_rung:'Re-buy',strength_add:'Strength add',sell_target:'Sell',runner:'Runner',kill_line:'Kill',option:'Option'};
const colorOf=e=>({buy_rung:C.buy,rebuy_rung:C.rebuy,strength_add:C.add,sell_target:C.sell,runner:C.runner,kill_line:C.kill,option:C.opt})[e.kind];
const etDay=iso=>new Date(iso).toLocaleDateString('en-CA',{timeZone:'America/New_York'});
const utcDay=iso=>new Date(iso).toISOString().slice(0,10);
const short=iso=>new Date(iso).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'});
const shortT=iso=>new Date(iso).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET';
function underlying(sym){const s=String(sym||'').trim().toUpperCase();const m=s.match(/^([A-Z.]+)\s+\d{6}[CP]\d{8}$/);
  if(m)return [m[1],'option'];if(s.endsWith('-PERP'))return [s.slice(0,-5),'perp'];return [s,''];}
function fid(f){return f.id||[f.ts,f.account,f.symbol,f.side,f.qty,f.price].join('|');}
function trigTag(e){const t=(e.trigger||'').toLowerCase();
  if(e.kind==='kill_line')return 'wk close';
  if(e.kind==='strength_add')return 'hold >'+px(e.price);
  if(e.kind==='option')return 'option';
  if(e.kind==='sell_target'||e.kind==='runner')return 'into strength';
  if(/resting limit|limit,|^limit/.test(t+' '+(e.notes||'').toLowerCase()))return 'limit';
  if(/rsi/.test(t))return 'RSI18/div';
  return '';}
function sizeTxt(e){const p=[];if(e.ladder_pct)p.push(e.ladder_pct+'%');if(e.size_usd)p.push(usd(e.size_usd));
  if(e.size_units)p.push(e.size_units+(e.unit_label?' '+e.unit_label:''));if(e.size_note)p.push(e.size_note);return p.join(' · ');}
function names(list){const m={};const by=k=>list.filter(e=>k.includes(e.kind));
  by(['buy_rung','rebuy_rung']).sort((a,b)=>b.price-a.price).forEach((e,i)=>m[e.id]=(e.kind==='rebuy_rung'?'Re-buy R':'R')+(i+1));
  by(['sell_target']).sort((a,b)=>a.price-b.price).forEach((e,i)=>m[e.id]='T'+(i+1));
  list.forEach(e=>{if(!m[e.id])m[e.id]=e.kind==='kill_line'?'Kill':KW[e.kind];});return m;}
function endOf(e){const h=e.status_history||[];const last=h[h.length-1];return last&&!ACTIVE.has(last.status)&&last.status!=='filled'?last.at:null;}

let P=null,B=null,chart=null,series=null,TK=null,TF='D',bars=[],extra=[];
const qs=new URLSearchParams(location.search);

function tickers(){const m={};(P.entries||[]).forEach(e=>{const t=e.ticker;m[t]=m[t]||{t,last:'',active:0,at:e.asset_type};
  if(e.created_at>m[t].last)m[t].last=e.created_at;if(ACTIVE.has(e.status))m[t].active++;});
  (P.events||[]).forEach(v=>{if(m[v.ticker]&&v.at>m[v.ticker].last)m[v.ticker].last=v.at;});
  return Object.values(m).sort((a,b)=>b.last.localeCompare(a.last)||a.t.localeCompare(b.t));}

function paintPicker(){const list=tickers();
  $('#tkpick').innerHTML=list.map(x=>`<button data-tk="${esc(x.t)}" class="${x.t===TK?'on':''}">${esc(x.t)}<small>${x.active}</small></button>`).join('');}

function toWeekly(d){const out=[];let cur=null;
  d.forEach(b=>{const dt=new Date(b.time+'T00:00:00Z');const wd=(dt.getUTCDay()+6)%7;dt.setUTCDate(dt.getUTCDate()-wd);const wk=dt.toISOString().slice(0,10);
    if(!cur||cur.time!==wk){cur={time:wk,open:b.open,high:b.high,low:b.low,close:b.close};out.push(cur);}
    else{cur.high=Math.max(cur.high,b.high);cur.low=Math.min(cur.low,b.low);cur.close=b.close;}});return out;}
function snap(day){if(!bars.length)return null;let lo=0,hi=bars.length-1;if(day<=bars[0].time)return bars[0].time;if(day>=bars[hi].time)return bars[hi].time;
  while(lo<hi){const mid=(lo+hi+1)>>1;if(bars[mid].time<=day)lo=mid;else hi=mid-1;}return bars[lo].time;}
function dayFor(iso,at){return at==='crypto'?utcDay(iso):etDay(iso);}

async function loadCandles(t,at){
  const baked=await get('candles/'+encodeURIComponent(t)+'.json');let rows={};let src=baked?baked.source:'';
  (baked&&baked.bars||[]).forEach(r=>rows[r[0]]={time:r[0],open:r[1],high:r[2],low:r[3],close:r[4]});
  if(at==='crypto'){try{const r=await fetch('https://api.exchange.coinbase.com/products/'+t+'-USD/candles?granularity=86400');
      if(r.ok){const j=await r.json();j.forEach(c=>{const d=new Date(c[0]*1000).toISOString().slice(0,10);rows[d]={time:d,open:c[3],high:c[2],low:c[1],close:c[4]};});src='Coinbase '+t+'-USD daily (live)';}}catch(e){}}
  return {bars:Object.values(rows).sort((a,b)=>a.time.localeCompare(b.time)),src,baked:baked&&baked.baked_at};}

async function show(t){TK=t;paintPicker();history.replaceState(null,'','?tk='+encodeURIComponent(t));
  const ents=P.entries.filter(e=>e.ticker===t);const at=(ents[0]||{}).asset_type||'stock';
  const cd=await loadCandles(t,at);if(TK!==t)return;
  const daily=cd.bars;bars=TF==='W'?toWeekly(daily):daily;
  $('#src').textContent=(cd.src||'No candles')+(cd.baked?' · baked '+shortT(cd.baked):'')+'. Crypto days are UTC; stock days are ET sessions.';
  const last=daily[daily.length-1];$('#pxnow').innerHTML=last?`${esc(t)} <b>${px(last.close)}</b> <span class="muted">${esc(last.time)}</span>`:'';
  drawChart(t,ents,at,last);paintSide(t,ents,at);}

function drawChart(t,ents,at,last){
  const el=$('#chart');if(chart){chart.remove();chart=null;}
  chart=LightweightCharts.createChart(el,{autoSize:true,layout:{background:{color:'#fff'},textColor:'#33464f',fontFamily:'-apple-system,Segoe UI,Inter,sans-serif'},
    grid:{vertLines:{color:'#f0f3f4'},horzLines:{color:'#f0f3f4'}},rightPriceScale:{borderColor:'#e3e8eb'},timeScale:{borderColor:'#e3e8eb'},crosshair:{mode:0}});
  const lc=last?last.close:null;
  const act=ents.filter(e=>(ACTIVE.has(e.status)||e.status==='filled')&&e.price!=null&&e.chart!==false&&!(e.kind==='option'&&lc&&Math.abs(e.price/lc-1)>0.6));
  const inRange=act.map(e=>e.price).filter(p=>!lc||(p>lc*0.45&&p<lc*1.8));
  series=chart.addCandlestickSeries({upColor:'#1e8a4c',downColor:'#c0392b',borderVisible:false,wickUpColor:'#1e8a4c',wickDownColor:'#c0392b',
    autoscaleInfoProvider:orig=>{const r=orig();if(!r||!inRange.length)return r;return {priceRange:{minValue:Math.min(r.priceRange.minValue,...inRange),maxValue:Math.max(r.priceRange.maxValue,...inRange)}};}});
  series.setData(bars);
  // active levels: full-width price lines
  const nm=names(act);
  act.forEach(e=>{const col=e.status==='filled'?'#9bb7bd':colorOf(e);const tag=trigTag(e);const sz=sizeTxt(e);
    const usz=e.size_usd?usd(e.size_usd):(e.size_note||'');const title=(e.status==='filled'?'✓ ':'')+nm[e.id]+(usz?' '+usz:'')+(tag?' · '+tag:'')+(e.price_hi?' (to '+px(e.price_hi)+')':'');
    series.createPriceLine({price:e.price,color:col,lineWidth:e.kind==='kill_line'?2:1.5,lineStyle:e.kind==='kill_line'?2:(e.kind==='strength_add'?1:0),axisLabelVisible:true,title});});
  // replaced/cancelled levels: dotted segments over the dates they were live
  if($('#showold').checked&&bars.length){
    ents.filter(e=>!ACTIVE.has(e.status)&&e.status!=='filled'&&e.price!=null&&e.chart!==false).forEach(e=>{
      const s=snap(dayFor(e.created_at,at)),en=snap(dayFor(endOf(e)||e.created_at,at));if(!s)return;
      let i0=bars.findIndex(b=>b.time===s),i1=bars.findIndex(b=>b.time===en);if(i1<i0)i1=i0;if(i1-i0<3)i0=Math.max(0,i1-3);
      const ls=chart.addLineSeries({color:C.old+'99',lineWidth:1,lineStyle:1,lastValueVisible:false,priceLineVisible:false,crosshairMarkerVisible:false,autoscaleInfoProvider:()=>null});
      ls.setData([{time:bars[i0].time,value:e.price},{time:bars[i1].time,value:e.price}]);});}
  // markers: plans made, fills
  const mk=[];const seen=new Set();
  (P.events||[]).filter(v=>v.ticker===t).forEach(v=>{const d=snap(dayFor(v.at,at));if(!d)return;const key=d+v.kind;if(seen.has(key))return;seen.add(key);
    mk.push({time:d,position:'aboveBar',color:v.kind==='revision'?'#b7791f':v.kind==='signal'?'#6b4fa0':v.kind==='fill'?'#1e8a4c':'#0f6e6e',shape:'circle',text:v.kind==='revision'?'Revised':v.kind==='signal'?'Signal':v.kind==='fill'?'':'Plan'});});
  grouped(t,at).forEach(f=>{if(f._kind==='option')return;const p=+f.price;if(lc&&(p<lc*0.2||p>lc*5))return;const d=snap(dayFor(f.ts,at));if(!d||d<bars[0].time)return;
    const buy=String(f.side).toUpperCase()==='BUY';mk.push({time:d,position:buy?'belowBar':'aboveBar',color:buy?'#1e8a4c':'#c0392b',shape:buy?'arrowUp':'arrowDown',
      text:(buy?'B ':'S ')+(+f.qty.toPrecision(3))+' @ '+px(p)+(f._kind==='perp'?' perp':'')});});
  mk.sort((a,b)=>a.time.localeCompare(b.time));series.setMarkers(mk);
  chart.timeScale().setVisibleLogicalRange({from:Math.max(0,bars.length-(TF==='W'?80:130)),to:bars.length+4});}

function fillsFor(t){return (B&&B.fills||[]).map(f=>{const [u,k]=underlying(f.symbol);return Object.assign({},f,{_u:u,_kind:k});}).filter(f=>f._u===t&&f.price);}
function grouped(t,at){const g={};fillsFor(t).forEach(f=>{const key=dayFor(f.ts,at)+'|'+String(f.side).toUpperCase()+'|'+f._kind+'|'+f.account+'|'+(f._kind==='option'?f.symbol:'');
  const q=Math.abs(+f.qty||0),n=Math.abs(+f.notional||q*f.price);const x=g[key]=g[key]||{ts:f.ts,side:String(f.side).toUpperCase(),_kind:f._kind,account:f.account,symbol:f.symbol,qty:0,notional:0,ids:[],n:0};
  x.qty+=q;x.notional+=n;x.ids.push(fid(f));x.n++;if(f.ts>x.ts)x.ts=f.ts;});
  return Object.values(g).map(x=>Object.assign(x,{price:x._kind==='option'?(x.notional/x.qty/100):x.notional/x.qty}));}

function paintSide(t,ents,at){
  const order={sell_target:0,runner:0,strength_add:1,option:2,buy_rung:3,rebuy_rung:3,kill_line:4};
  const act=ents.filter(e=>ACTIVE.has(e.status)||e.status==='filled').sort((a,b)=>(order[a.kind]-order[b.kind])||((b.price||0)-(a.price||0)));
  const old=ents.filter(e=>!ACTIVE.has(e.status)&&e.status!=='filled');
  const nm=names(act);const row=(e,o)=>{const st=e.status.split(' ')[0];const end=endOf(e);
    return `<tr class="${o?'old':''}"><td class="p"><span class="k" style="background:${o?C.old:colorOf(e)}"></span>${e.price!=null?px(e.price):'—'}${e.price_hi?'–'+px(e.price_hi):''}</td>
    <td title="${esc(e.trigger||'')}"><b>${esc(o?KW[e.kind]:nm[e.id])}</b> ${esc(sizeTxt(e))} <span class="pill ${st}">${esc(e.status)}</span><div class="tr">${esc(o?`${short(e.created_at)} → ${end?short(end):''} · ${e.set_label}`:[trigTag(e),e.notes].filter(Boolean).join(' · '))}</div></td></tr>`;};
  $('#levels').innerHTML=(act.length?act.map(e=>row(e,false)).join(''):'<tr><td class="muted">No live levels.</td></tr>')+
    (old.length?`<tr><td colspan="2"><details style="margin:4px 0 0"><summary>${old.length} replaced / cancelled</summary><table class="lv">${old.map(e=>row(e,true)).join('')}</table></details></td></tr>`:'');
  // timeline: events + non-trivial status changes
  const items=(P.events||[]).filter(v=>v.ticker===t).map(v=>({at:v.at,kind:v.kind,text:v.text}));
  ents.forEach(e=>(e.status_history||[]).forEach(h=>{if(['created','superseded'].includes(h.status)||h.note==='created'||h.by==='match')return;
    if(h.status==='superseded')return;items.push({at:h.at,kind:h.status==='filled'?'fill':'note',text:`${KW[e.kind]} ${px(e.price)} → ${h.status}${h.note?': '+h.note:''}`});}));
  items.sort((a,b)=>b.at.localeCompare(a.at));
  $('#timeline').innerHTML=items.map(i=>`<li class="${esc(i.kind)}"><time>${esc(shortT(i.at))}</time>${esc(i.text)}</li>`).join('')||'<li>No plan changes yet.</li>';
  const matched={};P.entries.forEach(e=>(e.fills||[]).forEach(id=>matched[id]=e));
  const fl=grouped(t,at).sort((a,b)=>b.ts.localeCompare(a.ts)).slice(0,10);
  $('#fills').innerHTML=fl.map(f=>{const m=f.ids.map(i=>matched[i]).find(Boolean);return `<li>${esc(short(f.ts))}: <b>${esc(f.side)}</b> ${f.qty.toLocaleString('en-US',{maximumFractionDigits:4})} ${esc(f._kind==='perp'?'perp':f._kind==='option'?f.symbol:'')} @ ${f.n>1?'avg ':''}${px(f.price)} <span class="muted">${esc(f.account)}${f.n>1?' · '+f.n+' fills':''}</span>${m?` <span class="pill filled">${esc(KW[m.kind]+' '+px(m.price))}</span>`:' <span class="muted">· not tied to a plan</span>'}</li>`;}).join('')||'<li class="muted">No fills in the latest API window.</li>';}

function bind(){
  $('#tkpick').addEventListener('click',e=>{const b=e.target.closest('button[data-tk]');if(b)show(b.dataset.tk);});
  $('#tf').addEventListener('click',e=>{const b=e.target.closest('button[data-tf]');if(!b)return;TF=b.dataset.tf;document.querySelectorAll('#tf button').forEach(x=>x.classList.toggle('on',x===b));show(TK);});
  $('#showold').addEventListener('change',()=>show(TK));
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
