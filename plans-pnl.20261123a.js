(function(){
const $=s=>document.querySelector(s);
const f$=x=>x==null||isNaN(x)?'—':x===0?'$0':(x<0?'−':'')+(Math.abs(x)>=1000?'$'+Math.round(Math.abs(x)).toLocaleString():Math.abs(x)>=1?'$'+Math.abs(x).toFixed(2):'$'+Math.abs(x).toFixed(4));
const s$=x=>x==null||isNaN(x)?'—':(x>0?'+':'')+f$(x);
const cls=x=>x==null?'':x>0?'pos':x<0?'neg':'';
const esc=s=>String(s==null?'':s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const KW={buy_rung:'buy',rebuy_rung:'re-buy',strength_add:'strength add',sell_target:'sell target',runner:'runner',kill_line:'protective sell line'};
const PILL={'planned, not placed':['Planned, not placed','pl'],'placed (API)':['Placed (API)','pc'],'filled (API)':['Filled (API)','fl'],'retired':['Retired','rt']};
let D=null;
function pill(s){const p=PILL[s]||[s,''];return `<span class="pp-pill ${p[1]}">${p[0]}</span>`}
function chart(el,xs,lines,opt={}){
  const W=900,H=opt.h||260,L=64,R=12,T=12,B=28;const all=lines.flatMap(l=>l.y.filter(v=>v!=null));if(opt.zero)all.push(0);
  let lo=Math.min(...all),hi=Math.max(...all);if(lo===hi){lo-=1;hi+=1}const pad=(hi-lo)*.06;lo-=pad;hi+=pad;
  const X=i=>L+(xs.length<2?0:(W-L-R)*i/(xs.length-1)),Y=v=>T+(H-T-B)*(1-(v-lo)/(hi-lo));
  let g=`<svg class="pp-svg" viewBox="0 0 ${W} ${H}">`;
  for(let k=0;k<5;k++){const v=lo+(hi-lo)*k/4;g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eef1f2"/><text x="${L-6}" y="${Y(v)+4}" text-anchor="end">${f$(v)}</text>`}
  if(opt.zero&&lo<0&&hi>0)g+=`<line x1="${L}" x2="${W-R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#9bb" stroke-dasharray="2 3"/>`;
  const step=Math.max(1,Math.ceil(xs.length/8));xs.forEach((x,i)=>{if(i%step===0||i===xs.length-1)g+=`<text x="${X(i)}" y="${H-8}" text-anchor="middle">${esc(x)}</text>`});
  for(const l of lines){let d='',pen=false;l.y.forEach((v,i)=>{if(v==null){pen=false;return}d+=(pen?'L':'M')+X(i).toFixed(1)+','+Y(v).toFixed(1);pen=true});
    g+=`<path d="${d}" fill="none" stroke="${l.c}" stroke-width="${l.w||2}" ${l.dash?`stroke-dasharray="${l.dash}"`:''}/>`;
    if(l.dots)l.y.forEach((v,i)=>{if(v!=null)g+=`<circle cx="${X(i)}" cy="${Y(v)}" r="3.5" fill="${l.c}"/>`});}
  g+='</svg><div class="pp-leg">'+lines.map(l=>`<span><i style="background:${l.c}${l.dash?';opacity:.6':''}"></i>${esc(l.n)}</span>`).join('')+'</div>';
  el.innerHTML=g;
}
function top(){
  const t=D.totals,g=D.gameout,last=g.weighted[g.weighted.length-1];
  const mis=D.levels.filter(r=>r.missed&&r.missed.hypothetical_pnl!=null).sort((a,b)=>b.missed.hypothetical_pnl-a.missed.hypothetical_pnl);
  const bestN=[...D.names].sort((a,b)=>(b.projected_ev||0)-(a.projected_ev||0));
  let h=`<h2 class="pp-h">What the levels are worth, and what they actually did</h2><p class="pp-sub">As of ${esc(D.as_of)} · book ${f$(D.book_usd)} · open orders checked ${esc(D.orders_as_of||'—')} · fills only from broker/exchange APIs. Nothing here places trades.</p>
  <div class="pp-kpis">
  <div class="pp-k"><span>Expected value of live levels (probability-weighted)</span><b class="${cls(t.projected_ev)}">${s$(t.projected_ev)}</b><span>best ${s$(t.projected_best)} · worst ${s$(t.projected_worst)}</span></div>
  <div class="pp-k"><span>Actual P&amp;L from levels (API fills)</span><b class="${cls(t.actual_api)}">${s$(t.actual_api)}</b><span>${t.filled} filled · ${t.placed} placed now</span></div>
  <div class="pp-k"><span>Unplaced levels price reached (hypothetical)</span><b class="${cls(t.missed_hypothetical)}">${s$(t.missed_hypothetical)}</b><span>if they had been placed, marked to today</span></div>
  <div class="pp-k"><span>Cost of changing levels so far</span><b class="${cls(t.cost_of_changes)}">${s$(t.cost_of_changes)}</b><span>+ means the change helped (hypothetical)</span></div>
  <div class="pp-k"><span>Folio at the Nov 7 2028 election (weighted)</span><b>${f$(last)}</b><span>bear ${f$(g.folio.bear.at(-1))} · bull ${f$(g.folio.bull.at(-1))}</span></div>
  </div>
  <ol class="pp-steps">
   <li><b>${t.live_levels} live levels, ${t.planned_not_placed} planned, not placed.</b> ${t.placed} placed and ${t.filled} filled according to the venue APIs. A level only counts as placed when E*TRADE, Robinhood, Coinbase or Hyperliquid shows the order.</li>
   <li><b>The live ladders are close to break-even on expected value (${s$(t.projected_ev)}).</b> They only pay if price reaches them and then bounces to the target before the protective line; with conservative odds that is roughly a coin flip. Best-weighted names: ${bestN.slice(0,3).map(n=>`${n.t} ${s$(n.projected_ev)}`).join(', ')}. Weakest: ${bestN.slice(-3).reverse().map(n=>`${n.t} ${s$(n.projected_ev)}`).join(', ')}.</li>
   <li>${mis.length?`<b>Levels price reached with no order:</b> best ${esc(mis[0].t)} ${esc(KW[mis[0].kind]||mis[0].kind)} $${mis[0].price} (${s$(mis[0].missed.hypothetical_pnl)}), worst ${esc(mis.at(-1).t)} ${esc(KW[mis.at(-1).kind]||'')} $${mis.at(-1).price} (${s$(mis.at(-1).missed.hypothetical_pnl)}). Hypothetical only.`:'No unplaced level has been reached yet.'}</li>
   <li><b>Protective sell lines:</b> ${t.kills_breached_not_acted?`<span class="neg">${t.kills_breached_not_acted} breached on a weekly close with no API sell.</span>`:'none breached on a weekly close while active.'}</li>
   <li><b>Core weight:</b> TSLA + BTC + SOL are ${g.big3_pct_now}% of the book against the ~35% target (all Core names ${g.core_pct_now}%). The weighted path keeps them near ${g.big3_pct.weighted.at(-1)}% by the election, so the overweight does not fix itself.</li>
  </ol>`;
  $('#top').innerHTML=h;
}
function series(){
  const S=D.series,xs=S.map(r=>r.day.slice(5));
  chart($('#serieschart'),xs,[
    {n:'Expected value of the levels live that day',c:'#0f6e6e',y:S.map(r=>r.projected_ev),w:2.5},
    {n:'Actual P&L from API fills',c:'#14232b',y:S.map(r=>r.actual_api),w:3,dots:true},
    {n:'Unplaced levels, hypothetical',c:'#b7791f',y:S.map(r=>r.unplaced_hypothetical),dash:'2 3',w:2}],{zero:true});
  const l=S.at(-1);$('#seriesnote').innerHTML=`Today: expected value ${s$(l.projected_ev)} across ${l.active_versions} live plan versions (best case ${s$(l.projected_best)}, worst case ${s$(l.projected_worst)} if every rung filled). Actual from API fills ${s$(l.actual_api)}. Unplaced levels, hypothetical ${s$(l.unplaced_hypothetical)}.`;
}
let SC='weighted';
function game(){
  const g=D.gameout,b=D.actual_nav,xs=['Now',...g.labels.map(l=>l.replace(/ \(.*\)/,'').replace('Election Nov 7 2028','Nov 7 ’28'))];
  const w=[g.start_value,...g.weighted];
  chart($('#gamechart'),xs,[
    {n:'Bull: every name on its good path',c:'#1e8a4c',y:[g.start_value,...g.folio.bull],dash:'4 4',w:1.5},
    {n:'Probability-weighted path',c:'#0f6e6e',y:w,w:3},
    {n:'Base path',c:'#6b7c85',y:[g.start_value,...g.folio.base],w:1.5},
    {n:'Bear: every name on its bad path',c:'#c0392b',y:[g.start_value,...g.folio.bear],dash:'4 4',w:1.5},
    {n:'Actual book (API) at each checkpoint',c:'#14232b',y:actualAt(xs.length),w:3,dots:true}],{h:300});
  const rows=[['Checkpoint',...xs],['Weighted folio',...w.map(f$)],['Bear',f$(g.start_value),...g.folio.bear.map(f$)],['Bull',f$(g.start_value),...g.folio.bull.map(f$)],
    ['TSLA+BTC+SOL weight (target ~35%)',g.big3_pct_now+'%',...g.big3_pct.weighted.map(x=>x+'%')],['All Core names weight',g.core_pct_now+'%',...g.core_pct.weighted.map(x=>x+'%')]];
  $('#gametbl').innerHTML=`<table class="pp-tbl">${rows.map((r,i)=>`<tr>${r.map(c=>i?`<td>${c}</td>`:`<th>${c}</th>`).join('')}</tr>`).join('')}</table>`;
  $('#gamenote').innerHTML=`${esc(g.note)} ${esc(g.core_target_note)} Crypto odds: ${Object.entries(g.prob_labels.crypto).map(([k,v])=>esc(v)).join(' · ')}. AI/stock odds: ${Object.entries(g.prob_labels.ai).map(([k,v])=>esc(v)).join(' · ')}. Projected path saved ${esc(b.baseline.saved)} so later actuals are measured against it.`;
}
function actualAt(n){
  // checkpoints: Now = today's book; later checkpoints fill in as the dates arrive
  const g=D.gameout,pts=D.actual_nav.points,out=[pts.length?pts.at(-1).nav:null];
  g.dates.forEach(d=>{const p=pts.filter(x=>x.day<=d);out.push(p.length&&p.at(-1).day>=d.slice(0,8)+'01'&&d<=pts.at(-1).day?p.at(-1).nav:null)});
  return out.slice(0,n);
}
function names(){
  const N=[...D.names].sort((a,b)=>(a.sleeve>b.sleeve?1:a.sleeve<b.sleeve?-1:0)||(b.projected_ev||0)-(a.projected_ev||0));
  let h=`<table class="pp-tbl"><tr><th>Name</th><th class="l">Bucket</th><th class="l">Live plan version</th><th>Expected value</th><th>Best</th><th>Worst</th><th>Actual (API)</th><th>Unplaced, hypothetical</th><th>Cost of changes</th><th class="l">Levels now</th><th>Election value (weighted)</th></tr>`;
  for(const n of N){const go=D.gameout.names[n.t];
    h+=`<tr class="clk" data-t="${esc(n.t)}"><td><b>${esc(n.t)}</b></td><td class="l">${esc(n.sleeve)}</td><td class="l">${n.live_version?`v${n.live_version.n} of ${n.versions} · ${esc(n.live_version.label).slice(0,46)}`:`<span class="muted">all ${n.versions} retired</span>`}</td>
    <td class="${cls(n.projected_ev)}">${s$(n.projected_ev)}</td><td>${s$(n.projected_best)}</td><td>${s$(n.projected_worst)}</td><td class="${cls(n.actual_api)}">${s$(n.actual_api)}</td>
    <td class="pp-hyp">${n.missed_hypothetical?s$(n.missed_hypothetical):'—'}</td><td class="${cls(n.cost_of_changes)}">${n.cost_of_changes?s$(n.cost_of_changes):'—'}</td>
    <td class="l">${n.planned?pill('planned, not placed')+' '+n.planned:''} ${n.placed?pill('placed (API)')+' '+n.placed:''} ${n.filled?pill('filled (API)')+' '+n.filled:''}</td>
    <td>${go?f$(go.weighted.at(-1))+` <span class="muted">(now ${f$(go.value_now)})</span>`:'—'}</td></tr><tr class="sub" id="d-${esc(n.t)}" hidden><td colspan="11"></td></tr>`}
  h+='</table>';$('#names').innerHTML=h;
  document.querySelectorAll('tr.clk').forEach(r=>r.onclick=()=>detail(r.dataset.t));
  $('#sleeves').innerHTML=`<table class="pp-tbl"><tr><th>Bucket</th><th>Names</th><th>Expected value</th><th>Actual (API)</th><th>Unplaced, hypothetical</th><th>Cost of changes</th></tr>${D.sleeves.map(s=>`<tr><td>${esc(s.sleeve)}</td><td>${s.names}</td><td class="${cls(s.projected_ev)}">${s$(s.projected_ev)}</td><td>${s$(s.actual_api)}</td><td class="pp-hyp">${s$(s.missed_hypothetical)}</td><td>${s$(s.cost_of_changes)}</td></tr>`).join('')}
  <tr><th>Total</th><th>${D.names.length}</th><th>${s$(D.totals.projected_ev)}</th><th>${s$(D.totals.actual_api)}</th><th>${s$(D.totals.missed_hypothetical)}</th><th>${s$(D.totals.cost_of_changes)}</th></tr></table>`;
}
function detail(t){
  const row=$('#d-'+CSS.escape(t));if(!row.hidden){row.hidden=true;return}
  const V=D.versions.filter(v=>v.t===t),L=D.levels.filter(r=>r.t===t),go=D.gameout.names[t];
  let h=`<h3>${esc(t)}: plan versions (each change is a new version)</h3><table class="pp-tbl"><tr><th>v</th><th class="l">Set</th><th class="l">Logged</th><th class="l">Retired</th><th>Price then</th><th>Weekly ATR</th><th>Capital</th><th>Expected value</th><th>Best</th><th>Worst</th></tr>`;
  for(const v of V)h+=`<tr><td>v${v.n}</td><td class="l">${esc(v.label).slice(0,60)}</td><td class="l">${esc(v.created)}</td><td class="l">${v.retired?esc(v.retired):'<b>live</b>'}</td><td>${f$(v.proj.price_at_set)}</td><td>${f$(v.proj.watr)}</td><td>${f$(v.proj.capital)}</td><td class="${cls(v.proj.ev)}">${s$(v.proj.ev)}</td><td>${s$(v.proj.best)}</td><td>${s$(v.proj.worst)}</td></tr>`;
  h+=`</table><h3>Live levels</h3><table class="pp-tbl"><tr><th class="l">Level</th><th>Price</th><th>Size</th><th class="l">Status</th><th>Away (weekly ATR)</th><th>Chance of fill</th><th>Chance it works</th><th>Expected value</th><th class="l">Reached?</th></tr>`;
  const R={};V.forEach(v=>v.rungs.forEach(r=>R[r.id]=r));
  for(const r of L.filter(r=>!r.retired)){const q=R[r.id]||{};h+=`<tr><td class="l">${esc(KW[r.kind]||r.kind)}</td><td>${f$(r.price)}</td><td>${r.size_usd?f$(r.size_usd):r.size_units?r.size_units+' units':'—'}</td><td class="l">${pill(r.state)}</td><td>${q.dist_watr??'—'}</td><td>${q.p_fill!=null?Math.round(q.p_fill*100)+'%':'—'}</td><td>${q.p_win!=null?Math.round(q.p_win*100)+'%':'—'}</td><td>${q.ev!=null?s$(q.ev):'—'}</td><td class="l">${r.touched?'yes, '+r.touched+(r.missed&&r.missed.hypothetical_pnl!=null?` <span class="pp-hyp">(${s$(r.missed.hypothetical_pnl)} hypothetical)</span>`:''):r.kill?esc(r.kill.state):'not yet'}</td></tr>`}
  h+='</table>';
  if(go){h+=`<h3>${esc(t)} to the Nov 2028 election (${esc(go.cycle)}), quarter by quarter</h3><table class="pp-tbl"><tr><th class="l">Path</th><th>Odds</th>${D.gameout.labels.map(l=>`<th>${esc(l.replace(/ \(.*\)/,''))}</th>`).join('')}</tr>`;
    for(const s of ['bull','base','bear'])h+=`<tr><td class="l">${esc(go.labels[s])}</td><td>${Math.round(go.probs[s]*100)}%</td>${go.scen[s].rows.map(r=>`<td>${f$(r.price)}<br><span class="muted">${f$(r.value)}</span></td>`).join('')}</tr>`;
    h+=`<tr><td class="l"><b>Weighted position value</b></td><td></td>${go.weighted.map(v=>`<td><b>${f$(v)}</b></td>`).join('')}</tr><tr><td class="l">of which from the levels</td><td></td>${go.weighted_plan_pnl.map(v=>`<td class="${cls(v)}">${s$(v)}</td>`).join('')}</tr></table>`;
    h+=`<p class="pp-sub">Price on top, position value below (held units plus anything the levels bought or sold). How the levels play out on the base path: ${go.scen.base.events.length?go.scen.base.events.map(esc).join('; '):'no level is reached'}.</p>`}
  row.firstElementChild.innerHTML=h;row.hidden=false;
}
function board(){
  const T=D.levels.filter(r=>r.touched&&r.kind!=='kill_line');
  T.sort((a,b)=>((b.missed&&b.missed.hypothetical_pnl)||(b.actual&&b.actual.pnl)||0)-((a.missed&&a.missed.hypothetical_pnl)||(a.actual&&a.actual.pnl)||0));
  let h=`<table class="pp-tbl"><tr><th class="l">Level</th><th>Price</th><th class="l">Logged</th><th class="l">Reached</th><th class="l">Status</th><th>Actual (API)</th><th>If placed (hypothetical)</th></tr>`;
  for(const r of T)h+=`<tr><td class="l"><b>${esc(r.t)}</b> ${esc(KW[r.kind]||r.kind)}</td><td>${f$(r.price)}</td><td class="l">${r.created}${r.retired?' → retired '+r.retired:''}</td><td class="l">${r.touched}</td><td class="l">${pill(r.state)}</td><td>${r.actual?s$(r.actual.pnl):'—'}</td><td class="pp-hyp">${r.missed?(r.missed.hypothetical_pnl!=null?s$(r.missed.hypothetical_pnl):'no size logged'):'—'}</td></tr>`;
  $('#board').innerHTML=T.length?h+'</table>':'<p>No level has been reached yet.</p>';
  const C=D.changes.filter(c=>c.cost_of_change||c.old_ev||c.new_ev);
  $('#changes').innerHTML=`<table class="pp-tbl"><tr><th class="l">Name</th><th class="l">Old version</th><th class="l">Replaced by</th><th class="l">When</th><th>Old expected value</th><th>New expected value</th><th>Old since then (hyp.)</th><th>New since then (hyp.)</th><th>Cost of change</th></tr>${C.map(c=>`<tr><td class="l"><b>${esc(c.t)}</b></td><td class="l">${esc(c.old_label).slice(0,40)}</td><td class="l">${esc(c.new_label).slice(0,40)}</td><td class="l">${esc(c.retired)}</td><td>${s$(c.old_ev)}</td><td>${s$(c.new_ev)}</td><td class="pp-hyp">${s$(c.old_hypo)}</td><td class="pp-hyp">${s$(c.new_hypo)}</td><td class="${cls(c.cost_of_change)}">${s$(c.cost_of_change)}</td></tr>`).join('')}</table>`;
  const K=D.kills.filter(k=>k.state!=='not breached');
  $('#kills').innerHTML=`<p>${D.kills.length} protective sell lines checked against weekly closes. ${K.length?K.map(k=>`<b>${esc(k.t)} $${k.price}</b>: ${esc(k.note)}`).join('<br>'):'None has closed a week below its line while active.'}</p>`;
  $('#method').innerHTML=`<pre style="white-space:pre-wrap;font-size:12px">${esc(D.method)}</pre><p class="pp-sub">Backtest hit rate used: ${Math.round(D.backtest_hit*100)}% (engine out-of-sample). Order feeds: ${Object.entries(D.order_feeds).map(([k,v])=>esc(k)+(v?' ok':' DOWN')).join(' · ')}.</p>`;
}
fetch('plan-pnl.json?'+Date.now()).then(r=>r.json()).then(j=>{D=j;document.querySelector('[data-asof]').textContent='Levels P&L '+j.as_of;top();series();game();names();board();})
 .catch(e=>{$('#top').textContent='Could not load plan-pnl.json: '+e});
})();
