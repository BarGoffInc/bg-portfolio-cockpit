(function(){
const $=s=>document.querySelector(s);
const f$=x=>x==null||isNaN(x)?'—':Math.abs(x)>=1000?'$'+Math.round(x).toLocaleString():Math.abs(x)>=1?'$'+x.toFixed(2):Math.abs(x)>=0.01?'$'+x.toFixed(4):'$'+x.toPrecision(3);
const pct=x=>x==null?'—':(100*x).toFixed(1)+'%';
const esc=s=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const md=s=>esc(s).replace(/`([^`]+)`/g,'<code>$1</code>');
const LBL={kill:['Protective sell line hit','stop'],scale:['Sell target reached','go'],fill:['Buy level reached','go'],placed:['Orders working (from API)','go'],setbuy:['OK to set buys · nothing placed','rest'],wait:['Wait',''],'no data':['No data',''],'short history':['Too new','']};
const TR={'-2':'strong downtrend','-1':'downtrend','0':'sideways','1':'uptrend','2':'strong uptrend'};
let D=null,cur=null,H=180;
function scoreLine(n){
  if(n.score){const s=n.score;return `<span class="eg-sc"><b>Score ${s.score}</b>/100 · company ${s.fund}/60 · chart-only ${s.chart}/30 · mood ${s.mood}/10</span>`}
  return `<span class="eg-mut">${esc(n.flag||'No score')}</span>`}
function cta(){
  const act=D.names.filter(n=>['kill','scale','fill','placed','setbuy'].includes(n.act));
  const held=D.names.filter(n=>n.act==='wait'&&n.held>1000);
  let h=`<h2 class="eg-h">Do this now</h2><p class="eg-sub">As of ${esc(D.as_of_et)} · book ${f$(D.book)} · scores from ${esc(D.score_as_of)}. Tap a name for its chart and projection.</p>${feeds()}`;
  const now=act.filter(n=>n.act!=='setbuy');
  if(!now.length) h+=`<p><b>No fills, trims or stops today.</b> No price touched a planned buy level with a sign that selling is exhausted, no sell target is reached, and no protective sell line broke on a weekly close.</p>`;
  for(const n of now) h+=card(n,true);
  h+=`<h2 class="eg-h" style="margin-top:18px">Buy limits you could set now (none are placed)</h2><p class="eg-sub">These are plans, not orders. None of them exist at E*TRADE, Robinhood, Coinbase or Hyperliquid unless the line says PLACED (that comes only from the venue's own open-orders list). Set them only if you want them. Both stock accounts are on margin, so move cash in first.</p>`;
  for(const n of act.filter(n=>n.act==='setbuy')) h+=card(n,true);
  h+=`<details class="eg-more"><summary>Held names on wait (${held.length})</summary>${held.map(n=>card(n,false)).join('')}</details>`;
  $('#cta').innerHTML=h;
  document.querySelectorAll('[data-t]').forEach(e=>e.onclick=()=>open(e.dataset.t));
}
function feeds(){const o=D.orders;if(!o)return '<p class="eg-mut"><b>Order status unknown (no feed ran).</b> Nothing is assumed placed.</p>';
  const it=Object.entries(o.feeds).map(([k,v])=>v.ok?`${esc(k)}: ${v.count} open order${v.count===1?'':'s'}${v.broker_sync?' (broker last synced '+new Date(v.broker_sync).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})+' ET)':''}`:`<b>${esc(k)}: order status unknown (feed ${esc(k)})</b>`);
  return `<p class="eg-sub"><b>What is actually placed, from the venue APIs (read-only, pulled ${esc((o.as_of||'').slice(11))} ET):</b> ${it.join(' · ')}. ${o.count?'':'No open orders anywhere, so every level below is a plan only.'}</p>`}
function lv(n){if(!n.levels||!n.levels.length)return '';
  const L=n.levels.map(x=>`<li><b>${f$(x.price)}</b>${x.usd?' · '+f$(x.usd):''} · <span class="${x.todo==='placed'?'eg-ok':'eg-pl'}">${esc(x.status)}</span>${x.todo==='set'?' · OK to set now (steps below)':x.todo==='wait'?' · '+esc(x.why||"Wait, don't set yet."):''}</li>`).join('');
  const S=(n.slevels||[]).map(x=>`<li>Sell ${f$(x.price)} · <span class="${x.status.startsWith('PLACED')?'eg-ok':'eg-pl'}">${esc(x.status)}</span></li>`).join('');
  return `<ul class="eg-lv">${L}${S}</ul>`}
function card(n,steps){
  const [l,c]=LBL[n.act]||[n.act,''];
  return `<div class="eg-cta"><div class="eg-row"><span class="eg-t" data-t="${n.t}">${n.t}</span><span class="eg-pill ${c}">${l}</span>${scoreLine(n)}<span class="eg-mut">${f$(n.px)}${n.held>1?' · held '+f$(n.held):''}</span></div>
  <div class="eg-mut" style="margin-top:4px">Why: ${esc(n.why)}</div>${lv(n)}${steps&&n.steps.length?`<ol class="eg-steps">${n.steps.map(s=>`<li>${md(s)}</li>`).join('')}</ol>`:''}</div>`}
function board(){
  const rows=D.names.map(n=>`<tr><td><span class="eg-t" data-t2="${n.t}">${n.t}</span></td><td>${n.score?n.score.score:'<span class="eg-mut">none</span>'}</td><td>${(LBL[n.act]||[n.act])[0]}</td><td>${f$(n.px)}</td><td>${n.trend==null?'—':TR[n.trend]}</td><td>${n.ex==null?'—':n.ex+'/6'}</td><td>${n.rsi==null?'—':n.rsi}</td><td>${n.rungs&&n.rungs.length?f$(n.rungs[0]):'—'}</td><td>${n.held>1?f$(n.held):''}</td><td style="text-align:left" class="eg-mut">${esc((n.src||'').slice(0,46))}</td></tr>`).join('');
  $('#board').innerHTML=`<h2 class="eg-h">Every tracked name (${D.names.length})</h2><p class="eg-sub">Held positions (incl. dust and option underlyings) plus every watchlist, plan and Scoring-tab name. Score = the Scoring tab's full company score; names without one are flagged, never filled in.</p><div class="eg-wrap"><table class="eg-tbl"><tr><th>Name</th><th>Score</th><th>Verdict</th><th>Price</th><th>Trend</th><th>Exhaustion signs</th><th>RSI18</th><th>First planned buy</th><th>Held</th><th style="text-align:left">Data</th></tr>${rows}</table></div>`;
  document.querySelectorAll('[data-t2]').forEach(e=>e.onclick=()=>open(e.dataset.t2));
}
function bt(){
  const b=D.backtest,o=b.OOS_chosen,i=b.IS_chosen;const row=(lab,m)=>`<tr><td>${lab}</td><td>${pct(m.cagr)}</td><td>${pct(m.mdd)}</td><td>${m.sharpe.toFixed(2)}</td><td>${pct(m.cash)}</td></tr>`;
  $('#bt').innerHTML=`<h2 class="eg-h">Does it work? Walk-forward test, out of sample 2023 → today</h2><p class="eg-sub">Equal-weight basket of book names, fees and slippage in, cash earns 0. Settings were picked on 2015–2022 only.</p><div class="eg-wrap"><table class="eg-tbl"><tr><th>Strategy</th><th>CAGR</th><th>Max drawdown</th><th>Sharpe</th><th>Avg cash</th></tr>${row('Engine alone',o.eng)}${row('Buy and hold',o.bh)}${row('DCA over 52 weeks',o.dca)}${row('Trend-confirmation only',o.trend)}${row('70% hold + 30% engine',o.blend)}</table></div><p class="eg-mut">Honest read: the engine alone does not beat buy-and-hold on these names; it cuts drawdown and sits in cash. ${esc(D.proxies)}</p>`}
// ---------- chart ----------
function open(t){cur=D.names.find(n=>n.t===t);if(!cur)return;$('#chartcard').hidden=false;$('#projcard').hidden=false;chart();proj();$('#chartcard').scrollIntoView({behavior:'smooth'})}
function paths(n,h){ // conservative/base/bull daily paths from ATR volatility
  const p0=n.px,sd=(n.datr||p0*0.03)/(1.6*p0),out={};
  for(const [k,z] of [['cons',-1],['base',0],['bull',1]]){const a=[];for(let d=0;d<=h;d++)a.push(p0*Math.exp(z*sd*Math.sqrt(d)));out[k]=a}
  const tq=Math.max(1,Math.round(h/3)),lo=-1.5*sd*Math.sqrt(tq),end=0.5*sd*Math.sqrt(h),a=[];
  for(let d=0;d<=h;d++)a.push(p0*Math.exp(d<=tq?lo*Math.sqrt(d/tq):lo+(end-lo)*(d-tq)/(h-tq||1)));out.dip=a;
  return out}
function simulate(n,path){ // apply planned ladder fills, scale-outs and the ladder kill along one path
  let units=(n.held>0?n.held:0)/n.px,cash=(n.sizes||[]).reduce((a,b)=>a+b,0),filled=(n.rungs||[]).map(()=>false),bought=0,maxu=units,sold=0,dead=false,ev=[];
  const vals=[];
  path.forEach((p,d)=>{
    (n.rungs||[]).forEach((r,k)=>{if(!filled[k]&&!dead&&p<=r&&(n.sizes[k]||0)>0){const q=n.sizes[k]/r;units+=q;bought+=q;cash-=n.sizes[k];filled[k]=true;maxu=Math.max(maxu,units);ev.push([d,'buy',r])}});
    if(sold<Math.min(3,(n.sells||[]).length)&&units>0&&p>=n.sells[sold]){const q=Math.min(units,0.25*maxu);cash+=q*n.sells[sold];units-=q;ev.push([d,'sell',n.sells[sold]]);sold++}
    if(d%7===6&&n.kill&&bought>0&&p<n.kill&&!dead){cash+=bought*p;units-=bought;bought=0;dead=true;ev.push([d,'kill',p])}
    vals.push(units*p+cash)});
  return {vals,ev}}
function chart(){
  const n=cur,c=n.chart;if(!c){$('#chartcard').innerHTML=`<h2 class="eg-h">${n.t}</h2><p class="eg-mut">${esc(n.why)}</p>`;return}
  const W=1000,Hh=380,pl=60,pr=10,pt=10,pb=24,N=c.c.length,ph=Math.min(H,120),P=paths(n,ph);
  const lv=[...c.l,...c.h,...(n.rungs||[]),...(n.sells||[]).slice(0,3),n.kill,n.hs,...P.cons,...P.bull].filter(x=>x!=null&&isFinite(x));
  let lo=Math.min(...lv),hi=Math.max(...lv);const pad=(hi-lo)*0.04;lo-=pad;hi+=pad;
  const X=i=>pl+(W-pl-pr)*i/(N+ph),Y=v=>pt+(Hh-pt-pb)*(1-(v-lo)/(hi-lo));
  let s=`<svg viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="${n.t} chart">`;
  for(let g=0;g<=4;g++){const v=lo+(hi-lo)*g/4;s+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e3e8eb"/><text x="4" y="${Y(v)+4}" font-size="11" fill="#6b7c85">${f$(v)}</text>`}
  const bw=Math.max(1,(W-pl-pr)/(N+ph)*0.6);
  c.c.forEach((cl,i)=>{const up=cl>=c.o[i],col=up?'#1e8a4c':'#c0392b';s+=`<line x1="${X(i)}" x2="${X(i)}" y1="${Y(c.h[i])}" y2="${Y(c.l[i])}" stroke="${col}"/><rect x="${X(i)-bw/2}" width="${bw}" y="${Y(Math.max(cl,c.o[i]))}" height="${Math.max(1,Math.abs(Y(cl)-Y(c.o[i])))}" fill="${col}"/>`;
    if(c.wash[i]>=2)s+=`<circle cx="${X(i)}" cy="${Y(c.l[i])+8}" r="3" fill="#0f6e6e"/>`;if(c.gem[i]&&(i===0||!c.gem[i-1]))s+=`<text x="${X(i)-4}" y="${Y(c.l[i])+22}" font-size="10" fill="#0f6e6e">G</text>`});
  const line=(arr,col,dash)=>{let d='';arr.forEach((v,i)=>{if(v!=null)d+=(d?'L':'M')+X(i)+','+Y(v)});return `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.5" ${dash?'stroke-dasharray="4 3"':''}/>`};
  s+=line(c.mld,'#b7791f')+line(c.mlw,'#6b4fa0',1);
  const hl=(v,col,lab,dash)=>v==null?'':`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="${col}" stroke-width="1.2" ${dash?'stroke-dasharray="6 4"':''}/><text x="${W-pr-4}" y="${Y(v)-3}" font-size="11" text-anchor="end" fill="${col}">${lab} ${f$(v)}</text>`;
  (n.rungs||[]).forEach((r,k)=>s+=hl(r,'#1e8a4c',`Planned buy ${k+1}${n.sizes[k]?' · '+f$(n.sizes[k]):''}${(n.levels[k]||{}).todo==='placed'?' · PLACED':' · not placed'}`));
  (n.sells||[]).slice(0,3).forEach((r,k)=>s+=hl(r,'#d9822b',`Sell T${k+1}`));
  s+=hl(n.kill,'#c0392b','Exit line (weekly close)',1);if(n.hs)s+=hl(n.hs,'#c0392b','Protective sell line (weekly close)',1);
  // past decisions: plan creation dots and real fills
  const di=d=>{const k=c.d.indexOf(d);return k};
  (n.plans||[]).forEach(p=>{const k=di(p.created);if(k>=0&&p.price)s+=`<circle cx="${X(k)}" cy="${Y(p.price)}" r="3.5" fill="none" stroke="${p.perp?'#999':'#14232b'}"/>`});
  (n.fills||[]).forEach(f=>{const k=di(f.d);if(k>=0&&f.px){const y=Y(f.px);s+=f.side==='buy'?`<path d="M${X(k)-5},${y+9}L${X(k)+5},${y+9}L${X(k)},${y+1}Z" fill="#1e8a4c"/>`:`<path d="M${X(k)-5},${y-9}L${X(k)+5},${y-9}L${X(k)},${y-1}Z" fill="#c0392b"/>`}});
  // projection cone
  const x0=N-1;const cone=k=>P[k].map((v,d)=>(d?'L':'M')+X(x0+d)+','+Y(v)).join('');
  s+=`<path d="${cone('bull')}" stroke="#1e8a4c" fill="none" stroke-dasharray="3 3"/><path d="${cone('base')}" stroke="#6b7c85" fill="none" stroke-dasharray="3 3"/><path d="${cone('cons')}" stroke="#c0392b" fill="none" stroke-dasharray="3 3"/>`;
  s+=`<line x1="${X(x0)}" x2="${X(x0)}" y1="${pt}" y2="${Hh-pb}" stroke="#ccd5d9"/><text x="${X(x0)+4}" y="${Hh-8}" font-size="11" fill="#6b7c85">today → next ${ph} days</text><text x="${pl}" y="${Hh-8}" font-size="11" fill="#6b7c85">${c.d[0]}</text></svg>`;
  const tr=n.trend==null?'':TR[n.trend];
  $('#chartcard').innerHTML=`<h2 class="eg-h">${n.t} · ${(LBL[n.act]||[n.act])[0]}</h2><div class="eg-row">${scoreLine(n)}</div>
  <p class="eg-mut" style="margin:6px 0">Price ${f$(n.px)} · ${tr} (sets size only) · selling-exhaustion signs ${n.ex}/6${n.tells.length?': '+esc(n.tells.join(', ')):''} · RSI18 ${n.rsi} (weekly ${n.wrsi??'—'}) · daily ATR ${f$(n.datr)}, weekly ATR ${f$(n.watr)} · buy levels from ${esc(n.rsrc||'—')}${n.rule?' · Rule: '+esc(n.rule):''}</p>
  ${s}<div class="eg-leg"><span><i style="background:#1e8a4c"></i>planned buy levels (not orders unless PLACED)</span><span><i style="background:#d9822b"></i>sell targets</span><span><i style="background:#c0392b"></i>exit line / protective sell line</span><span><i style="background:#b7791f"></i>daily Money Line proxy</span><span><i style="background:#6b4fa0"></i>weekly Money Line proxy</span><span>● day with 2+ selling-exhaustion signs</span><span>G Gemini Buy proxy</span><span>○ plan made</span><span>▲▼ real fills</span><span>dashed fan: conservative / base / bull (next 120 days max)</span></div>
  ${n.gate.length?`<p class="eg-mut">Gates: ${esc(n.gate.join(' · '))}</p>`:''}${n.perp.length?`<p class="eg-mut">Perp Desk rows (theirs, kept separate): ${n.perp.map(p=>esc(p.kind+' '+f$(p.price))).join(', ')}</p>`:''}`;
}
function proj(){
  const n=cur;if(!n.px){$('#projcard').hidden=true;return}
  const P=paths(n,H),S={cons:simulate(n,P.cons),dip:simulate(n,P.dip),base:simulate(n,P.base),bull:simulate(n,P.bull)},w={cons:0.25,dip:0.25,base:0.3,bull:0.2};
  const ex=S.base.vals.map((_,d)=>w.cons*S.cons.vals[d]+w.dip*S.dip.vals[d]+w.base*S.base.vals[d]+w.bull*S.bull.vals[d]);
  const start=ex[0],all=[...S.cons.vals,...S.bull.vals,...S.dip.vals];let lo=Math.min(...all),hi=Math.max(...all);if(hi-lo<1){hi+=1;lo-=1}
  const W=1000,Hh=240,pl=70,pr=10,pt=10,pb=22,X=d=>pl+(W-pl-pr)*d/H,Y=v=>pt+(Hh-pt-pb)*(1-(v-lo)/(hi-lo));
  const pth=a=>a.map((v,d)=>(d?'L':'M')+X(d)+','+Y(v)).join('');
  let s=`<svg viewBox="0 0 ${W} ${Hh}" width="100%">`;for(let g=0;g<=3;g++){const v=lo+(hi-lo)*g/3;s+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e3e8eb"/><text x="4" y="${Y(v)+4}" font-size="11" fill="#6b7c85">${f$(v)}</text>`}
  s+=`<path d="${pth(S.bull.vals)}" stroke="#1e8a4c" fill="none"/><path d="${pth(S.base.vals)}" stroke="#6b7c85" fill="none"/><path d="${pth(S.dip.vals)}" stroke="#b7791f" fill="none"/><path d="${pth(S.cons.vals)}" stroke="#c0392b" fill="none"/><path d="${pth(ex)}" stroke="#0f6e6e" stroke-width="2.5" fill="none"/>`;
  for(const k of ['cons','dip','bull'])S[k].ev.forEach(([d,kind,p])=>s+=`<circle cx="${X(d)}" cy="${Y(S[k].vals[d])}" r="4" fill="${kind==='buy'?'#1e8a4c':kind==='sell'?'#d9822b':'#c0392b'}"/>`);
  [0,Math.round(H/2),H].forEach(d=>s+=`<text x="${X(d)-(d===H?40:0)}" y="${Hh-6}" font-size="11" fill="#6b7c85">day ${d}</text>`);s+='</svg>';
  const r=k=>`<tr><td>${k==='ex'?'Weighted 25/25/30/20 (judgment, conservative tilt)':{cons:'Conservative: steady slide (−1σ)',dip:'Dip then recover (−1.5σ, back to +0.5σ)',base:'Base: flat',bull:'Bull: steady climb (+1σ)'}[k]}</td><td>${f$(k==='ex'?ex[H]:S[k].vals[H])}</td><td>${pct((k==='ex'?ex[H]:S[k].vals[H])/start-1)}</td><td style="text-align:left">${k==='ex'?'':S[k].ev.map(e=>e[1]+' '+f$(e[2])+' (day '+e[0]+')').join(', ')||'no orders trigger'}</td></tr>`;
  $('#projcard').innerHTML=`<h2 class="eg-h">${n.t}: project the position day by day</h2><p class="eg-sub">Starts from what is held (${f$(n.held)}) plus the cash set aside for these planned buys (${f$((n.sizes||[]).reduce((a,b)=>a+b,0))}). Each path assumes you have set the planned buys and quarter-position sells, and applies them and the weekly-close exit line as price crosses them (nothing is placed today). Volatility comes from the daily ATR. These are what-if paths, not a forecast.</p>
  <div class="eg-ctrl"><label>Horizon <input type="range" min="30" max="365" step="5" value="${H}" id="hz"/> <b id="hzv">${H} days</b></label></div>${s}
  <div class="eg-wrap"><table class="eg-tbl"><tr><th>Path</th><th>Value on day ${H}</th><th>Change</th><th style="text-align:left">Planned orders that would trigger (if set)</th></tr>${r('cons')}${r('dip')}${r('base')}${r('bull')}${r('ex')}</table></div>`;
  $('#hz').oninput=e=>{H=+e.target.value;proj();chart()};
}
fetch('engine.json?'+Date.now()).then(r=>r.json()).then(j=>{D=j;document.querySelector('[data-asof]').textContent='Engine run '+j.as_of_et;cta();board();bt()}).catch(e=>{$('#cta').textContent='Could not load engine.json: '+e});
})();
