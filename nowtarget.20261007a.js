(function(){
const fmt=v=>{const a=Math.abs(v);return '$'+(a>=1000?(a/1000).toFixed(a>=1e5?0:1)+'k':a.toFixed(0))};
const pct=v=>(v*100).toFixed(1)+'%';
const STABLE=new Set(['USDC','USD','USDT','DAI','PYUSD','USDE','CASH']);
function base(sym,al){let s=String(sym||'').split(/[ ·(]/)[0].toUpperCase().replace(/^XYZ:/,'');for(const k in al)if(al[k].includes(s))return k;return s}
Promise.all([fetch('book.json?'+Date.now()).then(r=>r.json()),fetch('targets.json?'+Date.now()).then(r=>r.json())]).then(([b,t])=>{
 const pos=b.positions||{},by={};let cash=0,lane=0;
 for(const acct in pos)for(const p of (pos[acct]||[])){
  const mv=+p.mv||0,s=base(p.symbol,t.aliases||{});
  if(p.kind==='option'){const m=String(p.symbol).match(/([CP])(\d{8})$/);if(m)lane+=Math.abs(+p.qty||0)*100*(+m[2]/1000);continue}
  if(p.kind==='perp'||p.position_type==='perp'){lane+=Math.abs((+p.qty||0)*(+p.mark||0))||Math.abs(mv);continue}
  if(p.kind==='cash'||STABLE.has(s)){cash+=mv;continue}
  by[s]=(by[s]||0)+mv}
 const book=(b.totals||{}).book_usd||1;
 const row=(name,cur,tgt,extra)=>{const cp=cur/book,gap=cur-tgt*book,w=Math.min(100,cp/Math.max(tgt*2,cp,0.0001)*100),m=tgt/Math.max(tgt*2,cp,0.0001)*100;
  return `<div class="nt-row"><div class="nt-lab"><b>${name}</b><span>${pct(cp)} → ${pct(tgt)}</span></div><div class="nt-bar"><i style="width:${w}%" class="${gap>0?'over':'under'}"></i><u style="left:${m}%"></u></div><div class="nt-gap ${gap>0?'over':'under'}">${name} ${fmt(gap)} ${gap>0?'over':'under'}${extra||''}</div></div>`};
 let h='<h2>Now vs target</h2><p class="muted small">Live weights from book.json · targets: '+t.source+'. Bar = current, tick = target.</p>';
 for(const c of t.core)h+=row(c.symbol,by[c.symbol]||0,c.target_pct);
 const cg=cash-t.cash_target_pct*book, lb=t.trading_lane_budget_pct*book;
 h+=`<div class="nt-line"><b>Cash / dry powder</b> ${fmt(cash)} (${pct(cash/book)}) vs target ${pct(t.cash_target_pct)} (${t.cash_band}) · ${fmt(cg)} ${cg>0?'above':'below'}</div>`;
 h+=`<div class="nt-line"><b>Trading lane</b> ${fmt(lane)} open leveraged/option exposure vs ${fmt(lb)} budget (${pct(t.trading_lane_budget_pct)}) · ${lane>lb?'OVER':'within'}</div>`;
 h+=`<div class="nt-line"><b>Watchlist</b> ${t.watchlist_ladders.length} names with armed ladders <span class="muted small">(${t.watchlist_ladders.join(', ')})</span></div>`;
 let s=document.getElementById('now-vs-target');if(!s){s=document.createElement('section');s.id='now-vs-target';s.className='card';(document.querySelector('main')||document.body).appendChild(s)}
 s.innerHTML=h}).catch(e=>console.warn('now-vs-target',e));
})();
