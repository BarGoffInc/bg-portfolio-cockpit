/* BG Portfolio — ticker report + "Score any ticker" (2026-11-18).
   Used by v2.20261118a.js on ticker.html. Board names get the full Conviction score from ranking.json;
   anything else gets a live chart-only score. Live market data is fetched in the browser:
   stocks from TradingView's public screener (delayed ~15 min), crypto from Coinbase Exchange + CoinGecko.
   Rule: never invent a number. Anything we can't read shows "n/a". */
(function(){
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const NA='<span class="na">n/a</span>';
const px=v=>v==null||isNaN(v)?NA:v>=1000?'$'+Math.round(v).toLocaleString('en-US'):v>=100?'$'+(+v).toFixed(2):v>=1?'$'+(+v).toFixed(2):'$'+String(+(+v).toPrecision(3));
const k=(v,sign)=>{if(v==null||isNaN(v))return NA;const a=Math.abs(v);const s=a>=1e6?'$'+(a/1e6).toFixed(2)+'M':a>=1e3?'$'+(a/1e3).toFixed(a>=1e5?0:1)+'k':'$'+Math.round(a);return v<0?'−'+s:(sign&&v>0?'+'+s:s)};
const big=v=>{if(v==null||isNaN(v)||v<=0)return NA;return v>=1e12?'$'+(v/1e12).toFixed(2)+'T':v>=1e9?'$'+(v/1e9).toFixed(1)+'B':v>=1e6?'$'+(v/1e6).toFixed(0)+'M':'$'+Math.round(v).toLocaleString('en-US')};
const pc=(v,d)=>v==null||isNaN(v)?NA:(v<0?'−':v>0?'+':'')+Math.abs(+v).toFixed(d==null?1:d)+'%';
const pcc=v=>v==null||isNaN(v)?NA:`<span class="${v<0?'neg':v>0?'pos':''}">${pc(v)}</span>`;
const dist=(from,to)=>from&&to?(to/from-1)*100:null; // % move from `from` to `to`
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const md=d=>{const p=String(d).split('-');return MON[+p[1]-1]+' '+(+p[2])};
const etTime=d=>d.toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET';
const getJ=(u,o)=>fetch(u,o).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();});
const withTimeout=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(()=>r(null),ms))]);
const TV='https://scanner.tradingview.com/america/scan',CB='https://api.exchange.coinbase.com/products/',CG='https://api.coingecko.com/api/v3/';
const TIERS=[[75,'g','Full size (75+)'],[60,'a','Three-quarter size (60–74)'],[50,'n','Half-size starter (50–59)'],[0,'r','No new money (under 50)']];
const tierOf=v=>TIERS.find(t=>v>=t[0])||TIERS[3];
/* buckets: Pablo's target book (Nov 2026). Config only, never holdings. */
const SURV=['TSLA','BTC','SOL'],TORQ=['TAO','VVV','SPCX','SKHY','ALAB'],LOTT=['ZCAT','STONK','WOOD','ZEC','BNKR','SN51+SN4','RENDER'];
const OWNER=/^(SUI|HYPE|UNI|DRIFT|SUPER|NEAR|XRP)$/;

/* ---------- indicators ---------- */
const sma=(c,n)=>{if(c.length<n)return null;let s=0;for(let i=c.length-n;i<c.length;i++)s+=c[i];return s/n;};
function rsiSeries(c,n){const out=[];if(c.length<=n)return out;let g=0,l=0;
  for(let i=1;i<=n;i++){const d=c[i]-c[i-1];if(d>0)g+=d;else l-=d;}g/=n;l/=n;out.push(l===0?100:100-100/(1+g/l));
  for(let i=n+1;i<c.length;i++){const d=c[i]-c[i-1];g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n;out.push(l===0?100:100-100/(1+g/l));}return out;}
function fromSeries(cl,hi,lo){const rs=rsiSeries(cl,14),n=rs.length,H=(hi||cl).slice(-365),L=(lo||cl).slice(-365);
  return {sma50:sma(cl,50),sma200:sma(cl,200),rsi:n?rs[n-1]:null,rsiSig:n>=3?(rs[n-1]+rs[n-2]+rs[n-3])/3:null,hi52:Math.max(...H),lo52:Math.min(...L),days:cl.length,
    perfW:cl.length>7?dist(cl[cl.length-8],cl[cl.length-1]):null,perfM:cl.length>30?dist(cl[cl.length-31],cl[cl.length-1]):null};}

/* ---------- live data ---------- */
function stockLive(q){
  const cols=['name','description','exchange','type','close','change','price_52_week_high','price_52_week_low','market_cap_basic','SMA50','SMA200','RSI','RSI[1]','RSI[2]','sector','earnings_release_next_date','Perf.W','Perf.1M','Perf.YTD','volume','average_volume_30d_calc','price_earnings_ttm'];
  const body=JSON.stringify({filter:[{left:'name',operation:'equal',right:q}],columns:cols,sort:{sortBy:'market_cap_basic',sortOrder:'desc'},range:[0,3]});
  return getJ(TV,{method:'POST',headers:{'Content-Type':'text/plain'},body}).then(j=>{
    const row=(j.data||[]).find(x=>x.d[0]===q&&x.d[4]!=null);if(!row)return null;const d=row.d,R=[d[11],d[12],d[13]].filter(v=>v!=null);
    return {cls:'stock',name:d[1],px:d[4],chg:d[5],hi52:d[6],lo52:d[7],mcap:d[8],sma50:d[9],sma200:d[10],rsi:d[11],rsiSig:R.length===3?(R[0]+R[1]+R[2])/3:null,
      sector:d[14],earn:d[15]?new Date(d[15]*1000):null,perfW:d[16],perfM:d[17],perfY:d[18],vol:d[19]!=null&&d[4]!=null?d[19]*d[4]:null,avgVol:d[20]!=null&&d[4]!=null?d[20]*d[4]:null,pe:d[21],
      src:'TradingView screener ('+row.s+', delayed ~15 min)',chgLabel:'Today'};
  }).catch(()=>null);}
function coinbaseLive(q){
  const now=Math.floor(Date.now()/1000),day=86400,iso=s=>new Date(s*1000).toISOString(),P=encodeURIComponent(q)+'-USD';
  const u=(a,b)=>CB+P+'/candles?granularity=86400&start='+iso(a)+'&end='+iso(b);
  return Promise.all([getJ(u(now-299*day,now)),getJ(u(now-400*day,now-300*day)).catch(()=>[]),getJ(CB+P+'/stats').catch(()=>null)]).then(([a,b2,st])=>{
    const m={};a.concat(b2).forEach(c=>m[c[0]]=c);const rows=Object.values(m).sort((x,y)=>x[0]-y[0]);if(rows.length<20)return null;
    const cl=rows.map(c=>c[4]),f=fromSeries(cl,rows.map(c=>c[2]),rows.map(c=>c[1]));
    const last=st&&st.last?+st.last:cl[cl.length-1],open=st&&st.open?+st.open:null;
    return Object.assign(f,{cls:'crypto',px:last,chg:open?dist(open,last):null,chgLabel:'24h',vol:st&&st.volume?+st.volume*last:null,src:'Coinbase Exchange ('+q+'-USD)'});
  }).catch(()=>null);}
function geckoMarket(q){
  return getJ(CG+'coins/markets?vs_currency=usd&symbols='+encodeURIComponent(q.toLowerCase())+'&include_tokens=top').then(L=>{
    const c=(L||[]).filter(x=>String(x.symbol).toUpperCase()===q).sort((a,b)=>(a.market_cap_rank||1e9)-(b.market_cap_rank||1e9))[0];if(!c)return null;
    return {id:c.id,name:c.name,rank:c.market_cap_rank,mcap:c.market_cap,fdv:c.fully_diluted_valuation,px:c.current_price,chg:c.price_change_percentage_24h,vol:c.total_volume,ath:c.ath,athChg:c.ath_change_percentage};
  }).catch(()=>null);}
function geckoChart(id){return getJ(CG+'coins/'+encodeURIComponent(id)+'/market_chart?vs_currency=usd&days=365&interval=daily').then(m=>{const cl=(m.prices||[]).map(p=>p[1]);return cl.length<20?null:fromSeries(cl);}).catch(()=>null);}
function cryptoLive(q,strict){
  return Promise.all([coinbaseLive(q),geckoMarket(q)]).then(([cb,g])=>{
    if(g&&strict&&!(g.rank&&g.rank<=300))g=null; // avoid copycat tokens when a stock shares the ticker
    if(cb){if(g){cb.mcap=g.mcap;cb.fdv=g.fdv;cb.rank=g.rank;cb.ath=g.ath;cb.athChg=g.athChg;cb.name=g.name;cb.src+=' · market cap from CoinGecko ('+g.id+')';}return cb;}
    if(!g)return null;
    return geckoChart(g.id).then(f=>Object.assign(f||{},{cls:'crypto',name:g.name,px:g.px,chg:g.chg,chgLabel:'24h',mcap:g.mcap,fdv:g.fdv,rank:g.rank,vol:g.vol,ath:g.ath,athChg:g.athChg,src:'CoinGecko ('+g.id+(g.rank?', rank #'+g.rank:'')+')'}));
  });}
function liveFor(q,cls){
  if(/[^A-Z0-9.\-]/.test(q))return Promise.resolve(null);
  if(cls==='stock'||cls==='etf')return stockLive(q);
  if(cls==='crypto')return cryptoLive(q,false);
  return stockLive(q).then(s=>s?s:cryptoLive(q,false)); // unknown: US stock first, then crypto
}

/* ---------- live chart check (same 5 checks as the Ranking page quick score) ---------- */
function quick(m){
  const C=[],dd=m.hi52&&m.px?dist(m.hi52,m.px):null,add=(l,ok,p,mx,d)=>C.push({l,ok,pts:ok?p:0,max:ok==null?0:mx,d});
  add('Above its 200-day average',m.sma200==null?null:m.px>m.sma200,30,30,m.sma200==null?'not enough history':'200-day '+px(m.sma200)+' · price '+pc(dist(m.sma200,m.px))+' vs it');
  add('Above its 50-day average',m.sma50==null?null:m.px>m.sma50,20,20,m.sma50==null?'not enough history':'50-day '+px(m.sma50)+' · price '+pc(dist(m.sma50,m.px))+' vs it');
  add('50-day above 200-day (uptrend)',m.sma50==null||m.sma200==null?null:m.sma50>m.sma200,15,15,m.sma50==null||m.sma200==null?'not enough history':m.sma50>m.sma200?'yes':'no');
  add('Momentum turning up (RSI14 over its 3-day avg)',m.rsi==null||m.rsiSig==null?null:m.rsi>m.rsiSig,15,15,m.rsi==null?'n/a':m.rsi.toFixed(1)+' vs '+(m.rsiSig==null?'n/a':m.rsiSig.toFixed(1))+(m.rsi<30?' · washed out':m.rsi>70?' · overheated':''));
  const hp=dd==null?0:dd>=-10?20:dd>=-25?12:dd>=-50?5:0;
  C.push({l:'Near its 52-week high',ok:dd==null?null:hp>=12,pts:hp,max:dd==null?0:20,d:dd==null?'n/a':'high '+px(m.hi52)+' · '+pc(dd)+' from it'});
  let p=0,mx=0;C.forEach(c=>{p+=c.pts;mx+=c.max;});return {score:mx?Math.round(p/mx*100):null,checks:C,avail:C.filter(c=>c.max).length};}

/* ---------- score history ---------- */
function histChart(L){
  if(!L||!L.length)return '<p class="note">No score history yet. The weekly rescore adds a point every week.</p>';
  const W=600,H=150,l=30,r=12,t=10,b=24,n=L.length,X=i=>n===1?(l+W-r)/2:l+i*(W-l-r)/(n-1),Y=v=>t+(100-v)/100*(H-t-b);
  let g='';[[75,'g'],[60,'a'],[50,'n']].forEach(z=>{g+=`<line class="tier ${z[1]}" x1="${l}" x2="${W-r}" y1="${Y(z[0])}" y2="${Y(z[0])}"/><text class="ax" x="${l-5}" y="${Y(z[0])+4}" text-anchor="end">${z[0]}</text>`;});
  const P=L.map((x,i)=>[X(i),Y(x.score)]);if(n>1)g+=`<polyline class="ln" points="${P.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ')}"/>`;
  L.forEach((x,i)=>{g+=`<circle class="pt ${tierOf(x.score)[1]}" cx="${P[i][0].toFixed(1)}" cy="${P[i][1].toFixed(1)}" r="4"><title>${esc(md(x.date)+': '+x.score+' · '+x.action)}</title></circle><text class="ax" x="${P[i][0].toFixed(1)}" y="${H-6}" text-anchor="middle">${md(x.date)}</text>`;});
  return `<svg class="hist" viewBox="0 0 ${W} ${H}" role="img" aria-label="Score over time">${g}</svg>`;}
function histTable(L){
  if(!L||!L.length)return '';const f=v=>v==null?'n/a':String(+(+v).toFixed(2));
  return `<table class="rk"><tr><th>Week of</th><th>Score</th><th>Business</th><th>Market</th><th>Crowd</th><th>Chart</th><th>Mood</th><th>Call</th><th>Price</th></tr>${L.slice().reverse().map(x=>`<tr><td>${md(x.date)}</td><td><b>${x.score}</b></td><td>${f(x.B)}</td><td>${f(x.T)}</td><td>${f(x.C)}</td><td>${f(x.X)}</td><td>${f(x.R)}</td><td>${esc(x.action||'')}</td><td>${px(x.px)}</td></tr>`).join('')}</table>`;}
function wkDelta(L){if(!L||!L.length)return null;const last=L[L.length-1];for(let i=L.length-2;i>=0;i--){if((Date.parse(last.date)-Date.parse(L[i].date))/864e5>=6)return {d:last.score-L[i].score,since:L[i].date};}
  return L.length>1?{d:last.score-L[0].score,since:L[0].date}:{d:null,since:last.date};}

/* ---------- pillars ---------- */
const PIL=[['business','Business strength','Revenue, growth, margins and how real the product is.'],['tam','Market size & runway','How big the market is and how far it can grow from here.'],
  ['crowd','Crowd cycle','Early beats crowded: 5 = few people own it yet, 1 = everyone already does.'],['tech','Chart','Money Line trend (daily and weekly), Gemini signals and momentum.'],
  ['regime','Fits today\'s market','Whether the current stock or crypto market mood supports buying it now.']];
const rate=v=>v>=4.5?'very strong':v>=3.5?'strong':v>=2.5?'average':v>=1.5?'weak':'very weak';

/* ---------- main ---------- */
window.BGReport=function(ctx){
  const {b,rk,v2,cards,board,grp,book,norm,venOf,main}=ctx;
  const q=(new URLSearchParams(location.search).get('tk')||'').trim().toUpperCase().replace(/^\$/,'');
  const forceCls=(new URLSearchParams(location.search).get('type')||'').toLowerCase();
  const ranked=Object.values(board).sort((a,c)=>c.score-a.score);
  const scorer=(big)=>`<form class="tks tkbig${big?' xl':''}" role="search" autocomplete="off"><input name="q" placeholder="Type any stock or crypto ticker, e.g. TSLA, NVDA, ZEC" aria-label="Score a ticker" autocapitalize="characters" spellcheck="false" enterkeyhint="search" value="${esc(q)}"/><button type="submit">Score it</button><ul class="sug" hidden></ul></form>`;
  getJ('score-history.json?_='+Date.now()).catch(()=>({})).then(HIST=>{HIST=HIST||{};
  if(!q){
    main.innerHTML=`<section class="card wide scorehero"><h1>Score any ticker</h1><p class="lead">Type a stock or crypto symbol. Names on our board get the full Conviction score and report; anything else gets a live chart score.</p>${scorer(true)}</section>
<section class="card wide"><h2>The board · ${ranked.length} names scored</h2><p class="muted">Rescored weekly. Last full score ${esc(rk.as_of||'n/a')}. Tap a name for its report.</p>
<table class="rk lb"><tr><th>#</th><th>Name</th><th>Score</th><th>Week</th><th>Call</th><th>Bucket</th><th>Owned</th></tr>${ranked.map((x,i)=>{const w=wkDelta(HIST[x.tk]);return `<tr><td>${i+1}</td><td><a href="ticker.html?tk=${encodeURIComponent(x.tk)}"><b>${esc(x.tk)}</b></a> <span class="muted">${esc(x.name||'')}</span></td><td><i class="dot2 ${tierOf(x.score)[1]}"></i><b>${x.score}</b></td><td>${w&&w.d!=null?pcN(w.d):'<span class="muted">new</span>'}</td><td>${esc(x.action)}</td><td>${esc(bucketOf(x.tk,cards[x.tk]||{},x))}</td><td>${esc(x.held)}</td></tr>`}).join('')}</table></section>`;
    ctx.bindSearch();return;}
  main.innerHTML=`<section class="card wide">${scorer(false)}<p class="muted" style="margin-top:12px">Building the ${esc(q)} report: reading the board and fetching live prices…</p></section>`;
  const t=Object.keys(cards).find(x=>x.toUpperCase()===q)||Object.keys(board).find(x=>x.toUpperCase()===q)||null;
  const c=t?cards[t]||{}:{},bd=t?board[t]||{}:{},key=t||q;
  const clsKnown=forceCls||bd.cls||(c.asset_type==='crypto_subnet'?'subnet':c.asset_type)||null;
  const p0=clsKnown==='subnet'?Promise.resolve(null):liveFor(key,clsKnown);
  withTimeout(p0,9000).then(L=>render(t,c,bd,key,L,HIST[key]||null)).catch(()=>render(t,c,bd,key,null,HIST[key]||null));
  });

  function pcN(d){return `<span class="${d>0?'pos':d<0?'neg':''}">${d>0?'+':d<0?'−':'±'}${Math.abs(d)}</span>`;}
  function bucketOf(T,c,bd){
    if(SURV.includes(T))return 'Survival';if(TORQ.includes(T))return 'Torque';
    if(LOTT.includes(T)||c.status==='lottery_hold'||/lottery|meme/i.test(c.sleeve||'')||/^Lottery/.test(bd.seat||''))return 'Lottery';
    if(OWNER.test(T)||/^Owner/.test(c.sleeve||bd.seat||''))return 'Adriano\'s own';
    if(c.status==='retired')return 'Retired';
    if(c.status==='exit_only'||/exit/i.test(bd.seat||''))return 'Outside seats · exit/hold';
    if(c.ticker||bd.tk)return 'Watch';return 'Not on our board';}

  function render(t,c,bd,key,L,H){
    const onBoard=!!(bd&&bd.tk), hasCard=!!(c&&c.ticker);
    // holdings: every position whose normalized symbol (or option underlying) matches
    const rows=[];Object.entries(b.positions||{}).forEach(([acc,lst])=>(lst||[]).forEach(x=>{const n=norm(x.symbol);if(n===key||n===key+' option')rows.push([acc,x]);}));
    const mvSum=rows.reduce((s,[,x])=>s+(x.mv||0),0),upKnown=rows.filter(([,x])=>x.uPnL!=null),upSum=upKnown.reduce((s,[,x])=>s+x.uPnL,0);
    const costSum=upKnown.reduce((s,[,x])=>s+(x.cost_total!=null?x.cost_total:(x.mv||0)-x.uPnL),0);
    const held=rows.length>0&&Math.abs(mvSum)>0.5;
    const price=L&&L.px!=null?L.px:(bd.px!=null?bd.px:(rows.find(([,x])=>x.kind!=='option'&&x.mark)||[])[1]?.mark??null);
    const priceSrc=L&&L.px!=null?'live':bd.px!=null?'board':'book';
    const name=(c.name||bd.name||(L&&L.name)||'');
    const cls=(L&&L.cls)||bd.cls||c.asset_type||'n/a';
    const bucket=bucketOf(key,c,bd);
    const te=bd.tech||{}, lad=c.ladder||[], so=(c.scale_out||[]).filter(s=>s.price), stop=c.disaster_stop||{}, bl=bd.ladder||{};
    const Q=L?quick(L):null;
    const regime=(rk.regime||{})[cls==='crypto'||cls==='subnet'?'crypto':'stock']||null;
    const wk=wkDelta(H), rank=onBoard?ranked.findIndex(x=>x.tk===key)+1:0;
    const flags=(rk.seat_flags||{})[key]||{};

    /* verdict */
    let V,vc='',why=[];
    const top=lad.length?lad[0].price:null,bot=lad.length?lad[lad.length-1].price:null;
    const ez=bl.entry||null;
    const inZone=price!=null&&((top&&price<=top*1.02)||(ez&&price<=ez[1]*1.02));
    const zoneTxt=top?px(bot)+'–'+px(top):ez?px(ez[0])+'–'+px(ez[1]):null, zoneTop=top||(ez&&ez[1]);
    if(!onBoard&&!hasCard){V='Not scored yet';vc='mut';why.push(Q&&Q.score!=null?`Live chart score ${Q.score}/100 (chart only, ${Q.avail} of 5 checks had data). That is not a buy signal.`:'No live data found for this symbol.');why.push('Ask Conviction for a full score, or add it to the watchlist so the weekly rescore picks it up.');}
    else if(c.on_hold||flags.on_hold){V='Wait · on hold';vc='hold';why.push('On hold: '+(flags.note||'no buys for now')+'.');}
    else if(c.status==='retired'){V='Avoid';vc='neg';why.push('Retired from the plan: no new money.');}
    else if(/^Fail/.test(bd.legit||'')){V='Avoid';vc='neg';why.push('Fails our legitimacy gate: '+bd.legit.replace(/^Fail:\s*/,'')+'.');}
    else if(c.exit_band){V='Sell into strength';vc='neg';why.push(`Sell into ${px(c.exit_band[0])}–${px(c.exit_band[1])}${c.keep_qty?', keep '+esc(c.keep_qty):''}.`+(price?` Now ${px(price)} (${pc(dist(price,c.exit_band[0]))} to the band).`:''));}
    else if(bd.action==='Cut'){V='Sell';vc='neg';why.push('The board says cut it.');}
    else if(bd.action==='Trim'){V='Sell part';vc='neg';why.push('The board says trim into strength.');}
    else if(c.status==='lottery_hold'||(bucket==='Lottery'&&held&&!lad.length)){V='Hold · lottery ticket';vc='hold';why.push('No adds and no sell prompts. We only flag a big upside move.');}
    else if(c.status==='exit_only'){V='Hold · no adds';vc='';why.push('On the no-add list: ride what we own.'+(so[0]?' First trim near '+px(so[0].price)+'.':''));}
    else if(onBoard&&bd.score<50){V='Avoid for now';vc='neg';why.push(`Score ${bd.score} is under 50: no new money.`);}
    else if(zoneTxt&&inZone&&c.status&&c.status!=='active_ladder'){V='Watch · in its zone';vc='';why.push(`Price ${px(price)} is inside the ${zoneTxt} watch zone, but this is a watch name, not a buying seat: it needs a full score and its gate${bd.gate?' ('+esc(bd.gate)+')':' (a Gemini Buy)'} before any money goes in.`);}
    else if(zoneTxt&&inZone){V='Buy zone';vc='go';why.push(`Price ${px(price)} is in the ${zoneTxt} buy zone. Buy in steps only when the gate is met${bd.gate?': '+esc(bd.gate):' (a Gemini Buy)'}.`);}
    else if(zoneTxt){V='Wait for the dip';vc='';why.push(`Buy zone ${zoneTxt}; price ${px(price)} is ${pc(dist(zoneTop,price))} above the top of it.`+(bd.gate?' Gate: '+esc(bd.gate)+'.':''));}
    else {V='Wait · watching';vc='';why.push('On the watch list with no buy levels set yet.'+(bd.gate?' Gate: '+esc(bd.gate)+'.':''));}
    if(priceSrc!=='live'&&zoneTxt)why.push(`Live price n/a: the zone check uses the ${priceSrc==='board'?'board price from '+esc(rk.as_of||'the last rescore'):'book mark from '+esc(b.as_of_et||'the last refresh')}, so confirm the price before acting.`);
    if(onBoard)why.push(`Score ${bd.score}/100 → ${tierOf(bd.score)[2].toLowerCase()}.`);
    if(regime&&(onBoard||hasCard)&&!/^Avoid|^Sell/.test(V))why.push(`${cls==='crypto'||cls==='subnet'?'Crypto':'Stock'} market: ${esc(regime.state)}. ${esc(regime.size||'')}`);

    /* market data */
    const range=(L&&L.lo52!=null&&L.hi52!=null&&price!=null)?`<div class="rng"><span>${px(L.lo52)}</span><span class="bar"><i style="left:${Math.max(0,Math.min(100,(price-L.lo52)/((L.hi52-L.lo52)||1)*100)).toFixed(0)}%"></i></span><span>${px(L.hi52)}</span></div>`:NA;
    const mcap=L&&L.mcap?big(L.mcap):(bd.mcap?esc(bd.mcap)+' <small>(board, '+esc(rk.as_of||'')+')</small>':NA);
    const cell=(l,v,s)=>`<div><small>${l}</small><b>${v}</b>${s?`<small>${s}</small>`:''}</div>`;
    const mkt=`<div class="kv kv6">${cell('Price',px(price),priceSrc==='live'?'live':priceSrc==='board'?'board price, '+esc(rk.as_of||''):'book mark, '+esc(b.as_of_et||''))}${cell((L&&L.chgLabel)||'Change',L?pcc(L.chg):NA)}${cell('Market cap',mcap,L&&L.rank?'rank #'+L.rank:'')}
${cell('From 52-week high',L&&L.hi52&&price?pcc(dist(L.hi52,price)):NA)}${cell('1 week',L?pcc(L.perfW):NA)}${cell('1 month',L?pcc(L.perfM):NA)}</div>
<div class="mrow"><div><small>52-week range</small>${range}</div><div><small>Volume today</small><b>${L&&L.vol?big(L.vol):(bd.vol?esc(bd.vol)+' <small>(board)</small>':NA)}</b></div>
${L&&L.cls==='stock'?`<div><small>P/E (trailing)</small><b>${L.pe?(+L.pe).toFixed(0)+'×':NA}</b></div><div><small>Year to date</small><b>${pcc(L.perfY)}</b></div><div><small>Next earnings</small><b>${L.earn?L.earn.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):NA}</b></div><div><small>Sector</small><b>${L.sector?esc(L.sector):NA}</b></div>`:''}
${L&&L.cls==='crypto'?`<div><small>All-time high</small><b>${L.ath?px(L.ath):NA}</b>${L.athChg!=null?`<small>${pc(L.athChg)} from it</small>`:''}</div><div><small>Fully diluted value</small><b>${L&&L.fdv?big(L.fdv):NA}</b></div>`:''}</div>
<p class="note">Source: ${L?esc(L.src)+' · fetched '+etTime(new Date()):'live data not available for this symbol'}.</p>`;

    /* trend & signals */
    const mlTxt=x=>{if(!x||x[0]==='n/a')return NA;const st=x[0]==='bull*'?'Up (at risk)':x[0]==='bull'?'Up':'Down';return `<b class="${x[0]==='bear'?'neg':'pos'}">${st}</b> · flips at ${px(x[1])}${price?` <small>(price ${pc(dist(x[1],price))} vs it)</small>`:''}`;};
    const gem=s=>!s?NA:s==='unreadable'?'<span class="na">n/a (label not readable)</span>':esc(s);
    const sig=`<table class="kvt">
<tr><td>Money Line · daily</td><td>${mlTxt(te.mlD)}</td></tr><tr><td>Money Line · weekly</td><td>${mlTxt(te.mlW)}</td></tr>
<tr><td>Gemini · daily</td><td>${gem(te.gD)}</td></tr><tr><td>Gemini · weekly</td><td>${gem(te.gW)}</td></tr>${te.gWhist?`<tr><td>Last weekly Buy</td><td>${gem(te.gWhist)}</td></tr>`:''}
<tr><td>RSI18 vs signal (desk)</td><td>${te.rsi!=null?(+te.rsi).toFixed(1)+' vs '+(te.sig!=null?(+te.sig).toFixed(1):'n/a')+(te.sig!=null?(te.rsi>te.sig?' · momentum turning up':' · momentum still down'):''):NA}</td></tr>
<tr><td>RSI14 (live)</td><td>${L&&L.rsi!=null?L.rsi.toFixed(1)+(L.rsi<30?' · oversold':L.rsi>70?' · overbought':''):NA}</td></tr>
<tr><td>50-day / 200-day avg (live)</td><td>${L&&(L.sma50||L.sma200)?(L.sma50?px(L.sma50):NA)+' / '+(L.sma200?px(L.sma200):NA):NA}</td></tr></table>
<p class="note">Money Line and Gemini come from the desk's TradingView read${te.src?' ('+esc(te.src)+')':''}${onBoard?'':' — none on file for this symbol'}. Live averages and RSI14 come from the price feed.</p>`;
    const qk=Q?`<ul class="checks">${Q.checks.map(x=>`<li class="${x.ok==null?'na':x.ok?'ok':'no'}"><span class="mk">${x.ok==null?'–':x.ok?'✓':'✗'}</span><span>${esc(x.l)}<small>${esc(x.d)}</small></span><span class="pts">${x.max?x.pts+'/'+x.max:'n/a'}</span></li>`).join('')}</ul>`:'<p class="note">No live price history, so no chart check.</p>';

    /* score breakdown */
    let scoreSec='';
    if(onBoard){const w=rk.weights||{},P=bd.pillars||{};
      scoreSec=`<section class="card wide"><h2>Why it scores ${bd.score}</h2><p class="lead">${bd.score}/100 · #${rank} of ${ranked.length} on the board · ${tierOf(bd.score)[2]}${wk&&wk.d!=null?` · ${pcN(wk.d)} since ${md(wk.since)}`:''}.</p>
<table class="rk fac"><tr><th>Factor</th><th>Weight</th><th>Rating</th><th>Points</th><th>What it measures</th></tr>${PIL.map(([kk,l,d])=>{const v=P[kk];return `<tr><td><b>${l}</b></td><td>${w[kk]!=null?w[kk]+'%':'n/a'}</td><td>${v==null?NA:`<span class="bar sm"><i style="width:${v/5*100}%"></i></span> ${+(+v).toFixed(2)}/5 <small>${rate(v)}</small>`}</td><td>${v!=null&&w[kk]!=null?(v/5*w[kk]).toFixed(1):NA}</td><td class="muted">${d}</td></tr>`}).join('')}
<tr><td colspan="3"><b>Total</b></td><td><b>${bd.score}</b></td><td></td></tr></table>
${bd.vc?`<p><b>Investor lens: ${esc(bd.vc.verdict)}.</b> ${esc(bd.vc.line)}</p>`:''}
${bd.vc&&bd.vc.full?`<details><summary>Full investor-lens analysis</summary>${bd.vc.full.map(x=>`<p><b>${esc(x[0])}.</b> ${esc(x[1])}</p>`).join('')}</details>`:''}
<h3>Score over time</h3>${histChart(H)}<details><summary>Score history table (${H?H.length:0} week${H&&H.length===1?'':'s'})</summary>${histTable(H)||'<p class="note">No history yet.</p>'}</details>
<p class="note">Full score as of ${esc(rk.as_of||'n/a')}. Rescored weekly.</p></section>`;}
    else scoreSec=`<section class="card wide"><h2>Live chart score: ${Q&&Q.score!=null?Q.score+'/100':'n/a'}</h2><p class="lead">Chart only. Business, market size, crowd and market fit are <b>not scored</b>, and Money Line / Gemini are not read. This is not the full Conviction score and not a buy signal.</p>${qk}</section>`;

    /* thesis / catalysts / risks */
    const thesis=[c.thesis,bd.why&&bd.why!==c.thesis?bd.why:null].filter(Boolean);
    const cats=[];
    if(bd.gate)cats.push('<b>What turns it into a buy:</b> '+esc(bd.gate));
    if(L&&L.earn&&L.earn>new Date())cats.push('<b>Next earnings:</b> '+L.earn.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}));
    ((rk.hunt||{}).paths||[]).filter(p=>String(p[0]).split(/,\s*/).includes(key)).forEach(p=>cats.push(`<b>Path to a higher score:</b> ${esc(p[1])} (${esc(p[2])})`));
    (bd.themes||c.themes||[]).forEach(th=>cats.push('<b>Theme:</b> '+esc(th)));
    Object.entries(rk.themes||{}).forEach(([n,T])=>{if((T.members||[]).includes(key))cats.push(`<b>${esc(n)} theme:</b> ${esc(T.note||T.peers||'')}`);});
    const risks=[];
    if(bd.vc&&bd.vc.full){const r=bd.vc.full.find(x=>/risk|timing/i.test(x[0]+x[1]));if(r&&/risk/i.test(r[1]))risks.push(esc(r[1]));}
    if(bd.legit)risks.push('Legitimacy gate: '+esc(bd.legit));
    const P=bd.pillars||{};
    if(P.crowd!=null&&P.crowd<=2)risks.push(`Crowded trade: crowd cycle ${P.crowd}/5, so a lot of good news is already owned.`);
    if(P.business!=null&&P.business<=2)risks.push(`Weak business: ${P.business}/5 on revenue, growth and margins.`);
    if(P.regime!=null&&P.regime<=2&&regime)risks.push(`Market mood is against it (${P.regime}/5): ${esc(regime.detail||regime.state)}`);
    if(te.mlW&&te.mlW[0]==='bear')risks.push('Weekly Money Line is down: the bigger trend is still falling.');
    if(te.mlD&&te.mlD[0]==='bear')risks.push('Daily Money Line is down.');
    if(L&&L.hi52&&price&&dist(L.hi52,price)<=-50)risks.push(`${pc(dist(L.hi52,price))} from its 52-week high: deep drawdown.`);
    if(stop.price&&price)risks.push(`Safety exit ${px(stop.price)} is ${pc(dist(price,stop.price))} away${stop.note?': '+esc(stop.note.replace(/\.$/,'')):''}.`);
    if(cls==='stock'&&L&&L.pe>100)risks.push(`Rich valuation: about ${(+L.pe).toFixed(0)}× trailing earnings.`);

    /* levels */
    const dd=v=>price&&v?` <small>(${pc(dist(price,v))})</small>`:'';
    const lv=[];
    if(lad.length)lad.forEach(l=>lv.push(['Buy '+l.weight_pct+'%',px(l.price)+dd(l.price),l.note||'']));
    else if(bl.entry)lv.push([bl.entryLabel||'Entry zone',px(bl.entry[0])+'–'+px(bl.entry[1])+dd(bl.entry[1]),(bl.why||{}).entry||'']);
    else if(bl.entryLabel)lv.push([bl.entryLabel,'—',(bl.why||{}).entry||'']);
    if(c.alt_entry)lv.push(['Alternate entry','',c.alt_entry.note||'']);
    if(c.exit_band)lv.push(['Sell band',px(c.exit_band[0])+'–'+px(c.exit_band[1])+dd(c.exit_band[0]),c.keep_qty?'Keep '+c.keep_qty:'']);
    if(so.length)so.forEach(s=>lv.push(['Take profit '+(s.fraction||''),px(s.price)+dd(s.price),s.note||'']));
    else{if(bl.t1!=null)lv.push(['Target 1',px(bl.t1)+dd(bl.t1),(bl.why||{}).t1||'']);if(bl.t2!=null)lv.push(['Target 2',px(bl.t2)+dd(bl.t2),(bl.why||{}).t2||'']);if(bl.stretch!=null)lv.push(['Stretch',px(bl.stretch)+dd(bl.stretch),(bl.why||{}).st||'']);}
    if(stop.price)lv.push(['Safety exit',px(stop.price)+dd(stop.price),(stop.type==='weekly_close_below'?'Weekly close below. ':stop.type==='daily_close_below'?'Daily close below. ':'')+(stop.note||'')]);
    else if(bl.stop!=null)lv.push(['Stop (on a close)',px(bl.stop)+dd(bl.stop),(bl.why||{}).stop||'']);
    const levels=lv.length?`<table class="rk lv"><tr><th>Level</th><th>Price <small>(from now)</small></th><th>Why</th></tr>${lv.map(r=>`<tr><td><b>${esc(r[0])}</b></td><td class="mono">${r[1]||NA}</td><td class="muted">${esc(r[2])}</td></tr>`).join('')}</table>${bd.rr&&bd.rr!=='—'?`<p class="note">Reward-to-risk ${esc(bd.rr)} from the entry zone to targets vs the stop.</p>`:''}`:'<p class="note">No levels on file (n/a).</p>';

    /* position */
    const pos=held?`<p class="lead">We own <b>${k(mvSum)}</b> (${pc(mvSum/book*100).replace(/^\+/,'')} of the book)${upKnown.length?`, <b class="${upSum<0?'neg':'pos'}">${k(upSum,true)}</b>${costSum>0?' ('+pc(upSum/costSum*100)+')':''}`:''}.</p>
<table class="rk"><tr><th>Account</th><th>Holding</th><th>Qty</th><th>Avg cost</th><th>Mark</th><th>Value</th><th>Gain/loss</th></tr>${rows.map(([a,x])=>`<tr><td>${esc(venOf(a))}</td><td>${esc(x.symbol)}${x.buyer==='A'?' <small>(Adriano)</small>':''}</td><td>${x.qty!=null?(+x.qty).toLocaleString('en-US',{maximumFractionDigits:4}):NA}</td><td>${x.cost_basis!=null?px(x.cost_basis):NA}</td><td>${px(x.mark)}</td><td>${k(x.mv)}</td><td>${x.uPnL!=null?`<span class="${x.uPnL<0?'neg':'pos'}">${k(x.uPnL,true)}</span>`:'<span class="na">cost unknown</span>'}</td></tr>`).join('')}</table>
<p class="note">From the account APIs, ${esc(b.as_of_et||'')}.</p>`:'<p class="lead">Not held.</p>';

    const notes=[bd.note,c.rnote&&c.rnote!==bd.note?c.rnote:null].concat(c.notes||[]).filter(Boolean);
    document.title=key+' report · BG Portfolio';
    main.innerHTML=`<section class="card wide">${scorer(false)}</section>
<section class="card wide tk"><div class="tkhead"><div><h1>${esc(key)}</h1><p class="muted">${esc(name)}${name?' · ':''}${esc(cls)} · <span class="bk">${esc(bucket)}</span>${c.plan_tag?' · '+esc(c.plan_tag):''}</p></div><span class="call ${vc}">${esc(V)}</span></div>
<div class="verdict ${vc}"><b>Verdict: ${esc(V)}.</b><ul>${why.map(x=>`<li>${x}</li>`).join('')}</ul></div>
<div class="kv">${cell('Price',px(price),L?(L.chgLabel||'')+' '+(L.chg!=null?pc(L.chg):''):'live n/a')}${cell('Score',onBoard?bd.score+'/100':Q&&Q.score!=null?Q.score+'/100':NA,onBoard?'#'+rank+' of '+ranked.length+(wk&&wk.d!=null?' · '+(wk.d>=0?'+':'−')+Math.abs(wk.d)+' wk':''):'chart only')}${cell('We own',held?k(mvSum):'None',held?pc(mvSum/book*100).replace(/^\+/,'')+' of book':'')}${cell('Gain/loss',held&&upKnown.length?`<span class="${upSum<0?'neg':'pos'}">${k(upSum,true)}</span>`:held?'<span class="na">cost unknown</span>':'—')}</div></section>
<section class="card wide"><h2>Market data</h2>${mkt}</section>
${onBoard?`<div class="grid2"><section class="card"><h2>Trend & signals</h2>${sig}</section><section class="card"><h2>Live chart check${Q&&Q.score!=null?' · '+Q.score+'/100':''}</h2>${qk}<p class="note">Five quick checks on the live price series, separate from the full score.</p></section></div>`:`<section class="card wide"><h2>Trend & signals</h2>${sig}</section>`}
${scoreSec}
<div class="grid2"><section class="card"><h2>Thesis & catalysts</h2>${thesis.length?thesis.map(x=>`<p class="lead">${esc(x)}</p>`).join(''):`<p>${NA}</p>`}${cats.length?`<ul class="plain">${cats.map(x=>`<li>${x}</li>`).join('')}</ul>`:'<p class="note">Catalysts: n/a</p>'}</section>
<section class="card"><h2>Key risks</h2>${risks.length?`<ul class="plain">${risks.map(x=>`<li>${x}</li>`).join('')}</ul>`:`<p>${NA}</p>`}</section></div>
<section class="card wide"><h2>Levels: entry, targets, exit</h2>${levels}</section>
<section class="card wide"><h2>Our position</h2>${pos}</section>
<section class="card wide"><details><summary>Desk notes and sources</summary>${notes.length?notes.map(x=>`<p>${esc(x)}</p>`).join(''):'<p class="note">No desk notes.</p>'}
<p class="note">Board score ${esc(rk.as_of||'n/a')} · rule cards ${esc(v2.generated_at||'n/a')} · holdings ${esc(b.as_of_et||'n/a')} · live: ${L?esc(L.src):'n/a'}. Nothing here places trades.</p></details></section>`;
    ctx.bindSearch();
  }
};
})();
