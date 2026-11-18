/* BG Portfolio v2 (2026-11-18: home 'Score any ticker' box, Score nav, full ticker report in report.20261118a.js) — renders Home / What I own / The plan / Returns from live data at runtime.
   Data: book.json (3-hourly refresh), daily/nav-series.json (EOD), ranking.json, v2data.json (rule cards + bottom watch). */
(function(){
const PAGE=document.body.dataset.page, $=s=>document.querySelector(s);
const bust=u=>u+(u.includes('?')?'&':'?')+'_='+Date.now();
const get=u=>fetch(bust(u),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const m=(v,sign)=>{const s='$'+Math.abs(Math.round(v)).toLocaleString('en-US');return v<0?'−'+s:(sign?'+'+s:s)};
const k=(v,sign)=>{const a=Math.abs(v);const s=a>=1e6?'$'+(a/1e6).toFixed(2)+'M':a>=1e3?'$'+Math.round(a/1e3)+'k':'$'+Math.round(a);return v<0?'−'+s:(sign?'+'+s:s)};
const pc=v=>(v<0?'−':v>0?'+':'')+Math.abs(+v).toFixed(1)+'%';
const px=v=>v==null?'—':v>=100?'$'+Math.round(v).toLocaleString('en-US'):v>=1?'$'+v.toFixed(2):'$'+String(+v.toPrecision(3));
const VEN={coinbase:'Coinbase',etrade:'E*TRADE',robinhood:'Robinhood',hyperliquid:'Hyperliquid',hl_conviction:'Hyperliquid'};
const venOf=id=>VEN[id]||'Crypto wallets';
function norm(s){const u=s.toUpperCase();
  if(['USDC','USD','USDT','USDG','PYUSD','DAI'].includes(u))return 'Cash';
  if(u.includes('SOL')&&(u.includes('JUP')||u.startsWith('SOL')))return 'SOL';
  if(u==='WETH'||u.startsWith('ETH'))return 'ETH';
  if(u.startsWith('SUI'))return 'SUI';
  if(/^[A-Z]+ \d{6}[CP]\d+/.test(u))return u.split(' ')[0]+' option';
  if(u.startsWith('U.S OIL'))return 'US Oil Reserve';
  return s;}
const STATUS={active_ladder:'Core · buying dips',exit_only:'Hold, no adds',watch:'Watching',retired:'Selling out',lottery_hold:'Lottery ticket'};

Promise.all([get('book.json'),get('ranking.json'),get('v2data.json'),get('daily/nav-series.json')]).then(([b,rk,v2,nav])=>{
  if(!b){$('main').innerHTML='<section class="card wide">Could not load the book. Try Refresh.</section>';return;}
  rk=rk||{board:[],seat_weights:{}};v2=v2||{cards:{},progress:[]};
  const cards=v2.cards||{}, board={}; (rk.board||[]).forEach(x=>board[x.tk]=x);
  const tr=b.true_returns||{}, g=tr.goal||{}, book=b.totals.book_usd, cashNet=b.totals.cash_net;
  document.querySelectorAll('[data-asof]').forEach(e=>e.textContent=b.as_of_et);
  // group holdings
  const grp={};
  Object.entries(b.positions||{}).forEach(([acc,lst])=>(lst||[]).forEach(x=>{
    const n=norm(x.symbol), mv=x.mv||0, G=grp[n]=grp[n]||{mv:0,up:0,known:0,ven:new Set()};
    G.mv+=mv; G.ven.add(venOf(acc)); if(x.uPnL!=null){G.up+=x.uPnL;G.known+=1;}}));
  const names=Object.entries(grp).filter(([n])=>n!=='Cash').sort((a,c)=>c[1].mv-a[1].mv);
  const real=names.filter(([,G])=>G.mv>=0.01*book), small=names.filter(([,G])=>G.mv<0.01*book);
  const smallVal=small.reduce((s,[,G])=>s+G.mv,0);
  const PRIME=v2.prime||[], isPrime=n=>PRIME.includes(n);
  const primeRows=PRIME.map(t=>[t,grp[t]||{mv:0,up:0,known:0,ven:new Set()}]);
  const primeVal=primeRows.reduce((s,[,G])=>s+G.mv,0);
  const side=names.filter(([n])=>!isPrime(n)), sideBig=side.filter(([,G])=>G.mv>=0.01*book), sideSmall=side.filter(([,G])=>G.mv<0.01*book);
  const sideVal=side.reduce((s,[,G])=>s+G.mv,0);
  const tlink=t=>'ticker.html?tk='+encodeURIComponent(t);
  const ven={}; (b.accounts||[]).forEach(a=>{const v=venOf(a.id);ven[v]=(ven[v]||0)+(a.value||0)});
  const venues=Object.entries(ven).filter(([,v])=>v>1).sort((a,c)=>c[1]-a[1]);
  const cardFor=n=>cards[n]||cards[n.split(' ')[0]]||{};
  const tagFor=n=>{const c=cardFor(n);return c.plan_tag||STATUS[c.status]||'No plan yet'};
  // true P&L series = value − money in
  let ser=[];
  if(nav&&nav.points){const fl={};(nav.external_flows||[]).forEach(f=>fl[f.day]=(fl[f.day]||0)+f.amount_usd);
    let cum=tr.starting_capital_usd||451000;const today=(tr.as_of_et||'');
    nav.points.forEach(p=>{if(p.day<'2026-08-15')return;if(p.day>'2026-08-15')cum+=fl[p.day]||0;ser.push([p.day,p.nav_usd-cum,p.day>=nav.trusted_from])});
    ser=ser.filter(s=>s[0]>='2026-09-19');
    const lastDay=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});
    ser=ser.filter(s=>s[0]<lastDay); ser.push([lastDay,tr.true_pnl_usd,true]);}
  const ver=ser.filter(s=>s[2]); const peak=ver.length?ver.reduce((a,c)=>c[1]>a[1]?c:a):null;
  const wkAgo=ser.length>7?ser[ser.length-8][1]:null, last7=wkAgo==null?null:ser[ser.length-1][1]-wkAgo;
  const md=d=>{const [y,mo,da]=d.split('-');return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+mo-1]+' '+(+da)};
  function spark(w,h){if(ser.length<2)return '<p class="note">Chart data not available.</p>';
    const ys=ser.map(s=>s[1]),lo=Math.min(0,...ys),hi=Math.max(0,...ys),rg=(hi-lo)||1;
    const X=i=>10+i*(w-20)/(ser.length-1),Y=v=>12+(hi-v)*(h-34)/rg;
    const pts=ser.map((s,i)=>X(i).toFixed(1)+','+Y(s[1]).toFixed(1)).join(' ');
    const pi=peak?ser.indexOf(peak):0,li=ser.length-1;
    return `<svg viewBox="0 0 ${w} ${h}" class="spark" role="img" aria-label="Profit since start"><line x1="10" x2="${w-10}" y1="${Y(0)}" y2="${Y(0)}" class="zero"/><text x="${w-12}" y="${Y(0)-5}" class="ax" text-anchor="end">break-even</text><polyline points="${pts}" class="ln"/>${peak?`<circle cx="${X(pi)}" cy="${Y(peak[1])}" r="4" class="pk"/><text x="${X(pi)+7}" y="${Y(peak[1])+4}" class="ax">best ${k(peak[1],true)}</text>`:''}<circle cx="${X(li)}" cy="${Y(ser[li][1])}" r="4" class="nw"/><text x="${X(li)-6}" y="${Y(ser[li][1])-8}" class="ax" text-anchor="end">now ${k(ser[li][1],true)}</text><text x="10" y="${h-3}" class="ax">${md(ser[0][0])}</text><text x="${w-10}" y="${h-3}" class="ax" text-anchor="end">today</text></svg>`;}
  // seats
  const flags=rk.seat_flags||{};
  const seats=Object.entries(rk.seat_weights||{}).filter(([t])=>((cards[t]||{}).status)!=='retired').sort((a,c)=>c[1]-a[1]).map(([t,wt])=>{
    const c=cards[t]||{},bd=board[t]||{},G=grp[t];
    return {t,wt,name:c.name||bd.name||t,tgt:book*wt/100,held:G?G.mv:0,px:bd.px,lad:c.ladder||[],so:(c.scale_out||[]).filter(s=>s.price),stop:(c.disaster_stop||{}).price,status:c.status,hold:!!((flags[t]||{}).on_hold||c.on_hold),holdNote:(flags[t]||{}).note,thesis:c.thesis||'',alt:c.alt_entry,tag:c.plan_tag};});
  function act(r){
    if(r.hold)return ['On hold','Not buying: '+(r.holdNote||'on hold')];
    if(r.status==='exit_only')return ['Hold, no adds',r.so[0]?'Take profit near '+px(r.so[0].price):''];
    if(!r.lad.length)return ['Waiting',''];
    const top=r.lad[0].price,bot=r.lad[r.lad.length-1].price;
    if(r.px&&r.px<=top*1.02)return ['In buy zone',`Buy ${px(bot)}–${px(top)} when the buy signal prints`];
    return ['Waiting for a dip',`Buy zone ${px(bot)}–${px(top)} (${r.px?Math.round((r.px/top-1)*100)+'% above':'above'} it now)`];}
  const seatFilled=seats.reduce((s,r)=>s+Math.min(r.held,r.tgt),0), seatTotal=seats.reduce((s,r)=>s+r.tgt,0);
  const seated=seats.filter(r=>r.held>=0.25*r.tgt).length;
  // sells: held names whose card is selling
  const sells=[];
  Object.entries(board).forEach(([t,x])=>{if(x.held!=='Held')return;const c=cards[t]||{};
    if(c.exit_band){sells.push(`<b>${t}</b>: sell into ${px(c.exit_band[0])}–${px(c.exit_band[1])}${c.keep_qty?`, keep ${c.keep_qty}`:''} (${k(grp[t]?grp[t].mv:0)} held)`);}
    else if(x.action==='Cut')sells.push(`<b>${t}</b>: sell all (${k(grp[t]?grp[t].mv:0)} held)`);
    else if(x.action==='Trim')sells.push(`<b>${t}</b>: sell part into strength (${k(grp[t]?grp[t].mv:0)} held)`);});
  const buys=seats.filter(r=>act(r)[0]==='In buy zone');
  const bw=v2.bottom_watch, bwe=(bw&&bw.evidence)||{}, wc=bwe.weekly_closes||{};
  const bwState={still_falling:'still falling',basing:'trying to bottom',turning:'turning up'}[bw&&bw.state]||(bw&&bw.state)||'unknown';
  const bar=(label,val,cls)=>`<div class="vrow"><span>${esc(label)}</span><span class="bar ${cls||''}"><i style="width:${Math.max(0,val/book*100).toFixed(1)}%"></i></span><b>${k(val)}</b></div>`;
  const prog=v2.progress||[], done=prog.filter(p=>p[1]).length;
  const since=tr.true_pnl_usd, pct=tr.simple_return_pct;
  let H='';
  if(PAGE==='home'){
    H=`<section class="hero"><div class="hl">Your money today</div><div class="big">${m(book)}</div>
<div class="sub">You've put in ${m(tr.net_contributed_usd)}. That's <b class="${since<0?'neg':'pos'}">${m(since,true)} (${pc(pct)})</b> since Aug 15.${peak&&peak[1]>0&&since<peak[1]?` We were up ${k(peak[1],true)} on ${md(peak[0])}; the crypto sell-off since then wiped that out.`:''}</div>
<div class="chips">${last7!=null?`<span class="chip ${last7<0?'neg':'pos'}">Last 7 days ${k(last7,true)}</span>`:''}<span class="chip">Goal ${k(g.target_value_usd)} by May 2028</span><span class="chip warn">Crypto ${bwState} · ${bw&&bw.state==='still_falling'?'waiting to buy':'watching'}</span></div></section>
<section class="card wide scorebox"><div class="sbx"><div><h2>Score any ticker</h2><p class="muted">Stock or crypto. Get the score, verdict, levels and full report.</p></div>
<form class="tks tkbig" role="search" autocomplete="off"><input name="q" placeholder="Type a ticker, e.g. TSLA or ZEC" aria-label="Score a ticker" autocapitalize="characters" spellcheck="false" enterkeyhint="search"/><button type="submit">Score it</button><ul class="sug" hidden></ul></form></div>
<p class="topsc"><span class="muted">Top scores:</span> ${Object.values(board).sort((a,c)=>c.score-a.score).slice(0,6).map(x=>`<a class="chip" href="${tlink(x.tk)}"><b>${esc(x.tk)}</b> ${x.score}</a>`).join('')}<a class="go" href="ticker.html">All ${Object.keys(board).length} scores →</a></p></section>
<div class="grid3">
<section class="card"><h2><span class="n">1</span>Where your money is</h2>
<p class="lead">${k(primeVal)} sits in the Prime 8, ${k(sideVal)} in ${side.length} side bets and exits, ${k(cashNet)} in cash.</p>
<h3>Prime 8</h3>${primeRows.filter(([,G])=>G.mv>0).map(([n,G])=>bar(n,G.mv)).join('')}${primeRows.some(([,G])=>!G.mv)?`<p class="note">Not bought yet: ${primeRows.filter(([,G])=>!G.mv).map(([n])=>n).join(', ')}</p>`:''}
<h3>Everything else</h3>${bar('Side bets & exits ('+side.length+')',sideVal,'c')}${bar('Cash (ready to buy dips)',cashNet,'c')}
<details><summary>By account</summary>${venues.map(([v,val])=>bar(v,val)).join('')}</details>
<a class="go" href="holdings.html">See everything you own →</a></section>
<section class="card"><h2><span class="n">2</span>What it's done</h2>
<p class="lead"><b class="${since<0?'neg':'pos'}">${m(since,true)}</b> since you handed it over, ${tr.days} days ago.</p>${spark(420,220)}
<p class="note">Line = what the account is worth minus every dollar you put in. Above break-even = profit.</p>
<details><summary>How we count it</summary><p>Value now ${m(book)} minus starting money ${m(tr.starting_capital_usd)} and ${m(tr.deposits_usd)} added since. Deposits never count as gains. The starting figure is our rebuild (±$10k) until the Aug 14–15 statements arrive. Daily values before Oct 7 are estimates.</p></details>
<a class="go" href="returns.html">Full returns →</a></section>
<section class="card"><h2><span class="n">3</span>Where it's going</h2>
<p class="lead">Goal: 5× to ${k(g.target_value_usd)} by May 2028. We are <b class="${g.vs_path_usd<0?'neg':'pos'}">${k(Math.abs(g.vs_path_usd))} ${g.vs_path_usd<0?'behind':'ahead of'} pace</b>.</p>
<div class="pace"><div><small>Should be today</small><b>${k(g.on_path_value_today_usd)}</b></div><div><small>Are</small><b>${k(book)}</b></div><div><small>Needed per month</small><b>${Math.round(g.required_monthly_pct)}%</b></div></div>
<h3>The turnaround plan</h3><ol class="plain"><li>Cut from ${names.length} names to about ${v2.target_positions||'8–10'} strong ones.</li><li>Buy those in steps as prices fall, bigger lower down.</li><li>Sell in steps into strength.</li></ol>
<h3>Next moves</h3><ul class="plain">${buys.slice(0,3).map(r=>`<li><b>Buy ${r.t}</b>: ${esc(act(r)[1])}. Target ${k(r.tgt)}, own ${k(r.held)}.</li>`).join('')}${sells.slice(0,2).map(s=>`<li>${s}</li>`).join('')||''}${!buys.length&&!sells.length?'<li>Nothing to do today. Waiting for buy signals.</li>':''}</ul>
<details><summary>Progress on the plan (${done} of ${prog.length} done)</summary><ul class="steps">${prog.map(p=>`<li class="${p[1]?'ok':'todo'}">${esc(p[0])}</li>`).join('')}</ul><p>Positions: ${names.length} now → target ${v2.target_positions||'8–10'}. Big seats filled: ${seated} of ${seats.length}.</p></details>
<a class="go" href="plan.html">See the plan →</a></section></div>`;}
  if(PAGE==='holdings'){
    const row=([n,G])=>{const c=cardFor(n),up=G.known?G.up:null,cls=up>0?'pos':up<0?'neg':'',seat=(rk.seat_weights||{})[n]!=null,stop=(c.disaster_stop||{}).price;
      return `<details class="hrow"><summary><span class="sym"><a href="${tlink(n.split(' ')[0])}">${esc(n)}</a>${seat?' <em class="seat">seat</em>':''}</span><span>${G.mv?k(G.mv):'<span class="muted">not owned</span>'}</span><span>${(G.mv/book*100).toFixed(1)}%</span><span>${!G.mv?'<span class="muted">—</span>':up!=null?`<span class="${cls}">${k(up,true)}</span>`:'<span class="muted">cost unknown</span>'}</span><span class="st">${esc(tagFor(n))}</span></summary><div class="det"><p>${esc(c.thesis||'No rule card yet.')}</p><p>Held at: ${esc([...G.ven].sort().join(', '))}${stop?' · Exit if a week closes under '+px(stop):''}</p>${(c.notes||[]).slice(-1).map(x=>`<p class="muted">${esc(x)}</p>`).join('')}<p><a class="go" href="${tlink(n.split(' ')[0])}">Full report →</a></p></div></details>`;};
    H=`<section class="pagehead"><h1>What you own</h1><p>${names.length} names worth ${m(book-cashNet)} plus ${k(cashNet)} cash. <b>Goal: about ${v2.target_positions||'8–10'} real positions.</b> The Prime 8 come first; side bets and small leftovers get cleaned up over time.</p></section>
<section class="card wide"><h2>Prime 8 · ${k(primeVal)}</h2><p class="muted">Our best ideas. This is where the size goes.</p><div class="hhead"><span>Name</span><span>Value</span><span>Share</span><span>Gain/loss</span><span>Plan</span></div>${primeRows.map(row).join('')}</section>
<section class="card wide"><h2>Side bets & exits · ${k(sideVal)}</h2><p class="muted">Everything else. Most of these get sold or shrunk over time.</p><div class="hhead"><span>Name</span><span>Value</span><span>Share</span><span>Gain/loss</span><span>Plan</span></div>${sideBig.map(row).join('')}
<details class="group"><summary>${sideSmall.length} small positions · ${k(sideSmall.reduce((s,[,G])=>s+G.mv,0))} total (tap to see)</summary>${sideSmall.map(row).join('')}</details></section>
<section class="card wide"><h2>By account</h2>${venues.map(([v,val])=>bar(v,val)).join('')}<details><summary>Account details</summary><p>Margin owed: E*TRADE ${m(b.totals.cash_breakdown.etrade)}, Robinhood ${m(b.totals.cash_breakdown.robinhood)}. Hyperliquid ${k(b.hl_perps_account_value||0)} is idle cash${(b.positions.hyperliquid||[]).length?'':' with no open trades'}.</p></details></section>`;}
  if(PAGE==='plan'){
    const sc=r=>{const [a,det]=act(r),fill=r.tgt?Math.min(r.held/r.tgt,1)*100:0;
      return `<details class="seatc"><summary><span class="sym">${esc(r.t)}</span><span class="muted">${esc(r.name)}</span><span class="fill"><i style="width:${fill.toFixed(0)}%"></i></span><span>${k(r.held)} of ${k(r.tgt)}</span><span class="tag ${a==='In buy zone'?'go':a==='On hold'?'hold':''}">${a}</span></summary>
<div class="det"><p>${esc(r.thesis)}</p><p><b>Now ${px(r.px)}.</b> ${esc(det)}</p><div class="cols"><div><h4>Buy plan</h4><ul>${r.hold?'<li>On hold</li>':r.lad.map(l=>`<li>Buy ${l.weight_pct}% at ${px(l.price)}</li>`).join('')||'<li>No adds</li>'}${r.alt?`<li>${esc(r.alt.note)}</li>`:''}</ul></div><div><h4>Sell plan</h4><ul>${r.so.map(s=>`<li>Sell ${esc(s.fraction||'part')} at ${px(s.price)}</li>`).join('')||'<li>—</li>'}</ul></div><div><h4>Safety exit</h4><p>${r.stop?'Weekly close under '+px(r.stop):'—'}</p></div></div></div></details>`;};
    H=`<section class="pagehead"><h1>The plan</h1><p>Own about 8 great names. Buy them in steps when the market panics, sell in steps when it gets greedy.</p></section>
<section class="card wide market"><h2>Market right now</h2><p class="lead"><b class="warn">Crypto: ${bwState}.</b> ${bw&&bw.state==='still_falling'?'No buy signals yet.':''} ${(rk.regime&&rk.regime.stock)?'Stocks: '+esc(rk.regime.stock.state.toLowerCase())+'.':''}</p>
${wc.BTC_wflip?`<p>We start buying crypto when Bitcoin closes a week back above ${px(wc.BTC_wflip)} (last week ${px(wc.BTC)}) or a buy signal prints on Bitcoin, Solana or TAO.</p>`:''}
<details><summary>Why (the details)</summary><p>${esc(bwe.note||'')}</p><p class="muted">Checked ${esc(bw?bw.as_of:'')}</p></details></section>
<section class="card wide"><h2>The ${seats.length} seats · ${k(seatFilled)} of ${k(seatTotal)} filled</h2><p class="muted">Tap a name for its buy, sell and exit levels.</p>${seats.map(sc).join('')}</section>
<section class="card wide"><h2>Selling / trimming</h2><ul class="plain">${sells.map(s=>`<li>${s}</li>`).join('')}<li><b>${small.length} small positions</b>: clean up (${k(smallVal)})</li></ul></section>
<section class="card wide"><h2>How we decide</h2><details><summary>The house rule in plain English</summary><p>Only good long-term names. When they sell off hard, a TradingView "buy" signal tells us to start buying. The further price falls below support, the bigger each buy. When they run up and the "trim" signal prints, we sell in steps.</p></details>
<details><summary>Ranking board (all ${Object.keys(board).length} names scored)</summary><table class="rk"><tr><th>Name</th><th>Score</th><th>Status</th><th>Owned</th></tr>${Object.values(board).sort((a,c)=>c.score-a.score).map(x=>`<tr><td>${esc(x.tk)}</td><td>${x.score}</td><td>${esc(x.action)}</td><td>${esc(x.held)}</td></tr>`).join('')}</table><p><a href="ranking.html">Full ranking page (archive)</a></p></details>
<details><summary>Glossary</summary><p><b>Seat</b>: a planned spot in the portfolio with a target size. <b>Buy signal</b>: TradingView Gemini Buy alert. <b>Money Line</b>: the trend line; above it means up-trend. <b>RSI</b>: how stretched price is; low means oversold. <b>Safety exit</b>: if a week closes below this, we sell.</p></details></section>`;}
  if(PAGE==='returns'){
    const wk=ser.filter((s,i)=>i===ser.length-1||(new Date(s[0]+'T12:00').getDay()===0)).slice(-6);
    H=`<section class="pagehead"><h1>Returns</h1><p>Honest count since you handed it over on Aug 15, 2026.</p></section>
<section class="card wide"><div class="three"><div><small>You put in</small><b>${m(tr.net_contributed_usd)}</b></div><div><small>Worth now</small><b>${m(book)}</b></div><div><small>Result</small><b class="${since<0?'neg':'pos'}">${m(since,true)} (${pc(pct)})</b></div></div>${spark(900,220)}
<p class="note">${peak?`Best point ${k(peak[1],true)} on ${md(peak[0])}. `:''}Week by week: ${wk.map(s=>md(s[0])+' '+k(s[1],true)).join(' → ')}.</p></section>
<section class="card wide"><h2>The 5× goal</h2><p class="lead">From ${m(g.start_value_usd)} (Nov 1) to ${k(g.target_value_usd)} by May 2028. Now ${(+g.multiple_now).toFixed(2)}×, ${k(Math.abs(g.vs_path_usd))} ${g.vs_path_usd<0?'behind':'ahead of'} pace. Needs about ${Math.round(g.required_monthly_pct)}% a month from here.</p></section>
<section class="card wide"><details><summary>Manager vs owner, and investment-only returns</summary><p>Time-weighted (manager skill, ignores when money came in): ${pc(tr.twr_pct)}. Money-weighted (what your dollars actually earned): ${pc(tr.mwr_period_pct)}.</p><ul>${(tr.twr_legs||[]).map(l=>`<li>${l.from} → ${l.to}: ${pc(l.return_pct)}</li>`).join('')}</ul></details>
<details><summary>By account</summary><table class="rk"><tr><th>Account</th><th>Worth</th><th>Money in</th></tr>${(tr.venues||[]).map(v=>`<tr><td>${esc(v.name)}</td><td>${k(v.value_usd)}</td><td>${k(v.net_usd)}</td></tr>`).join('')}</table></details>
<details><summary>What we still need (${(tr.data_needed||[]).length})</summary><ul>${(tr.data_needed||[]).map(x=>`<li>${esc(typeof x==='string'?x:(x.what||x.item||JSON.stringify(x)))}</li>`).join('')}</ul></details>
<p class="muted"><a href="returns-classic.html">Detailed returns (archive)</a></p></section>`;}
  if(PAGE==='ticker'){H=null;}
  const all={};Object.entries(cards).forEach(([t,c])=>all[t]=c.name||'');Object.values(board).forEach(x=>{if(!(x.tk in all))all[x.tk]=x.name||'';});
  const TK=Object.keys(all).sort();
  const go=t=>location.href='ticker.html?tk='+encodeURIComponent(t);
  function bindSearch(){document.querySelectorAll('form.tks').forEach(f=>{
    const inp=f.querySelector('input'),sug=f.querySelector('ul.sug');if(!inp||!sug||f.dataset.bound)return;f.dataset.bound='1';
    const show=()=>{const q=inp.value.trim().toUpperCase();if(!q){sug.hidden=true;return;}
      const pre=TK.filter(t=>t.toUpperCase().startsWith(q)), inName=TK.filter(t=>!t.toUpperCase().startsWith(q)&&(all[t]||'').toUpperCase().includes(q));
      const hits=pre.concat(inName).slice(0,8);
      sug.innerHTML=(hits.length?hits.map(t=>`<li data-tk="${esc(t)}"><b>${esc(t)}</b><span>${esc(all[t])}${board[t]?' · score '+board[t].score:''}</span></li>`).join(''):'')+(pre[0]&&pre[0].toUpperCase()===q?'':`<li data-tk="${esc(q)}" class="any"><b>${esc(q)}</b><span>Score it live (any stock or crypto)</span></li>`);
      sug.hidden=false;};
    inp.addEventListener('input',show);inp.addEventListener('focus',()=>{if(inp.value)show();});
    sug.addEventListener('mousedown',e=>{const li=e.target.closest('li[data-tk]');if(li){e.preventDefault();go(li.dataset.tk);}});});}
  document.addEventListener('click',e=>{if(!e.target.closest('form.tks'))document.querySelectorAll('form.tks ul.sug').forEach(u=>u.hidden=true);});
  if(H!=null){$('main').innerHTML=H;bindSearch();}
  else if(window.BGReport)window.BGReport({b,rk,v2,cards,board,grp,book,norm,venOf,main:$('main'),bindSearch});
  else $('main').innerHTML='<section class="card wide">Report module did not load. Try Refresh.</section>';
});
document.addEventListener('click',e=>{if(e.target.closest('[data-refresh]'))location.reload();});
document.addEventListener('submit',e=>{const f=e.target.closest('form.tks');if(!f)return;e.preventDefault();const v=(f.q.value||'').trim().split(/\s/)[0];if(v)location.href='ticker.html?tk='+encodeURIComponent(v.toUpperCase());});
})();
