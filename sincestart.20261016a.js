(function(){
const f=v=>(v<0?'−':'+')+'$'+Math.abs(Math.round(v)).toLocaleString();
const m=v=>'$'+Math.round(v).toLocaleString();
fetch('book.json?'+Date.now()).then(r=>r.json()).then(b=>{
 const s=b.since_start;if(!s)return;
 let el=document.getElementById('since-start-card');
 if(!el){el=document.createElement('section');el.id='since-start-card';el.className='card';
  const a=document.getElementById('nav-series-card');a?a.parentNode.insertBefore(el,a):(document.querySelector('.content')||document.body).appendChild(el)}
 const col=s.pnl_usd>=0?'#1f7a4d':'#b03a3a';
 el.innerHTML=`<div class="card-head"><h3>${s.label||'Since start'}</h3><span class="sub">${s.days} days · start ${s.start_date}</span></div>
 <div style="padding:0 20px 16px">
 <div style="font-size:28px;font-weight:700;color:${col}" class="tabular">${f(s.pnl_usd)} <span style="font-size:16px">(${s.return_pct>=0?'+':''}${s.return_pct}%)</span></div>
 ${s.split?`<div class="muted small tabular" style="margin-top:2px">Adriano-directed ${f(s.split.adriano_directed_pnl_usd)} · Owner direct buys ${f(s.split.owner_direct_pnl_usd)}</div>`:''}
 <div class="muted small">Range ${f(s.pnl_range_usd[0])} to ${f(s.pnl_range_usd[1])} depending on the Aug 15 starting value</div>
 <div class="tabular" style="margin-top:8px;line-height:1.7">
 Book now <b>${m(s.book_usd)}</b> − start (est.) <b>${m(s.start_nav_usd)}</b> − net deposits <b>${m(s.net_flows_usd)}</b><br>
 Booked since start (known) <b>${f(s.realized_known_usd)}</b> · open/mark-to-market <b>${f(s.unrealized_residual_usd)}</b></div>
 <div class="muted small" style="margin-top:6px">Deposits = bank-funded buys/contributions only; moves between your own accounts are internal. Start value is estimated, not a statement. Pre-Aug-15 trades (prior manager) excluded.</div></div>`;
}).catch(e=>console.warn('since-start',e));
})();
