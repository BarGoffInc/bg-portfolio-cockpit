(function(){
// Manager vs Owner returns card (2026-10-27 rebuild). Data: book.json -> since_start.people (cockpit/owner_returns.py).
const esc=t=>String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const f=v=>(v<0?'\u2212':'+')+'$'+Math.abs(Math.round(v)).toLocaleString();
const m=v=>'$'+Math.round(v).toLocaleString();
const p=v=>v==null?'\u2014':(v<0?'\u2212':'+')+Math.abs(v*100).toFixed(1)+'%';
const col=v=>v>=0?'#1f7a4d':'#b03a3a';
const st={cash:true,oil:false,nav:null};
let BOOK=null;
function key(P){return (st.cash?'cash_owner':'cash_manager')+'|'+(st.oil?'oil_zero':'oil_marked');}
function row(label,o,tag){
  return `<tr><td>${label}${tag?`<div class="muted small">${tag}</div>`:''}</td>
  <td class="tabular" style="text-align:right;color:${col(o.pnl)};font-weight:600">${f(o.pnl)}</td>
  <td class="tabular" style="text-align:right;color:${col(o.twr)}"><b>${p(o.twr)}</b></td>
  <td class="tabular" style="text-align:right;color:${col(o.mwr)}">${p(o.mwr)}</td></tr>`;
}
function tbl(title,sub,s,L){
  return `<div style="margin-top:10px"><div style="font-weight:600">${title}</div><div class="muted small">${sub}</div>
  <table style="width:100%;border-collapse:collapse;margin-top:4px"><thead><tr class="muted small">
  <th style="text-align:left">&nbsp;</th><th style="text-align:right">P/L</th><th style="text-align:right" title="Time-weighted return: strips out the timing of new money. Headline % per person.">Return (TWR)</th><th style="text-align:right" title="Money-weighted (Modified Dietz): P/L divided by capital in play, weighted by days invested.">Money-wtd</th></tr></thead><tbody>
  ${row(L.manager,s.manager,'')}${row(L.owner,s.owner,'')}${row('Combined',s.total,'')}</tbody></table></div>`;
}
function render(){
  const b=BOOK,s=b.since_start,P=s.people;
  let el=document.getElementById('since-start-card');
  if(!el){el=document.createElement('section');el.id='since-start-card';el.className='card';
    const a=document.getElementById('nav-series-card');a?a.parentNode.insertBefore(el,a):(document.querySelector('.content')||document.body).appendChild(el)}
  if(!P){ // fallback: legacy single-number card
    el.innerHTML=`<div class="card-head"><h3>${esc(s.label||'Since start')}</h3></div><div style="padding:0 20px 16px"><b>${f(s.pnl_usd)}</b> (${s.return_pct}%) <div class="muted small">People split unavailable${s.people_error?': '+esc(s.people_error):''}.</div></div>`;return;}
  const C=P.cases[key()], nav=String(st.nav||P.default_start_nav), S=C[nav], V=C.verified, L=P.labels;
  const sens=P.sensitivity_start_navs.map(n=>{const x=C[String(n)];
    return `<tr><td class="tabular">${m(n)}${n===P.default_start_nav?' (default)':''}</td><td class="tabular" style="text-align:right;color:${col(x.total.pnl)}">${f(x.total.pnl)}</td><td class="tabular" style="text-align:right;color:${col(x.manager.pnl)}">${f(x.manager.pnl)} · ${p(x.manager.twr)}</td><td class="tabular" style="text-align:right;color:${col(x.owner.pnl)}">${f(x.owner.pnl)} · ${p(x.owner.twr)}</td></tr>`}).join('');
  const fl=s.flows_by_source||{};
  const flTxt=Object.keys(fl).map(k=>`${esc(k)} ${m(fl[k])}`).join(' · ');
  el.innerHTML=`<div class="card-head"><h3>Manager vs Owner</h3><span class="sub">${s.days} days \u00b7 start ${esc(s.start_date)} (ESTIMATED) \u00b7 as of ${esc(b.as_of_et||'')}</span></div>
  <div style="padding:0 20px 16px">
  <div style="font-size:26px;font-weight:700;color:${col(S.total.pnl)}" class="tabular">${f(S.total.pnl)} <span style="font-size:15px">combined \u00b7 ${p(S.total.twr)} TWR \u00b7 ${p(S.total.mwr)} money-wtd</span></div>
  <div class="muted small">New money in (${m(s.net_flows_usd)}) is excluded from P/L. Includes all realized + unrealized P/L. Not statement-based \u2014 see start value below.</div>
  ${tbl('Since '+esc(s.start_date)+' \u2014 estimated start value','Start value '+m(S.start_value.total)+' is an estimate; range $414k\u2013$455k (table below). Owner % uses a very small early base: read $ and money-weighted % together.',S,L)}
  ${tbl('Verified window since '+esc((s.split&&s.split.verified_since)||'Oct 7')+' (first complete daily book)','Both sleeves start from a complete end-of-day book; no start-value estimate. This is the most reliable view.',V,L)}
  <div style="margin-top:12px;font-weight:600">If the Aug 15 start value is different</div>
  <table style="width:100%;border-collapse:collapse" class="small"><thead><tr class="muted"><th style="text-align:left">Start value</th><th style="text-align:right">Combined</th><th style="text-align:right">${esc(L.manager)}</th><th style="text-align:right">${esc(L.owner)}</th></tr></thead><tbody>${sens}</tbody></table>
  <div style="margin-top:10px" class="small">
   <label style="margin-right:14px"><input type="checkbox" id="ss-cash" ${st.cash?'checked':''}> Owner positions bought from the shared cash pool count as Owner money (UNI Sep 3, DRIFT Sep 22, SUPER Sep 28, OIL)</label><br>
   <label><input type="checkbox" id="ss-oil" ${st.oil?'checked':''}> Show OIL at $0 (written off by the Manager; otherwise at its book mark)</label></div>
  <div class="muted small" style="margin-top:8px;line-height:1.5">
   <b>How it is counted.</b> Flows in: ${flTxt||'\u2014'} (bank-funded buys, the Oct 6 $80k deployed by the Manager, PONS transferred in at its Oct 12 value \u2014 not a gain). Moves between own accounts (Coinbase\u2192Hyperliquid, wallets, DEX) are internal.<br>
   ${(P.notes||[]).map(x=>'\u2022 '+esc(x)).join('<br>')}<br>
   Method: ${esc(P.method)}</div></div>`;
  el.querySelector('#ss-cash').onchange=e=>{st.cash=e.target.checked;render()};
  el.querySelector('#ss-oil').onchange=e=>{st.oil=e.target.checked;render()};
}
fetch('book.json?'+Date.now()).then(r=>r.json()).then(b=>{ if(!b.since_start)return; BOOK=b; render(); }).catch(e=>console.warn('since-start',e));
})();
