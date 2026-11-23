(function(){
const e=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=t=>String(t||'').trim().toUpperCase().replace(/^\$/,'');
function localQ(){
  try{const q=JSON.parse(localStorage.getItem('bg-wl-queue')||'');if(q&&q.adds&&q.removes)return q;}catch(x){}
  return {adds:{},removes:{}};
}
function row(n,extra){
  const pend=extra?' <span class="muted small">(pending)</span>':'';
  return `<tr><td><b>${e(n.ticker)}</b>${n.priority?' ⭐':''}${pend}<br><span class="muted small">${e(n.name||'')}</span></td><td>${e(n.levels||'Not set yet')}</td><td>${e(n.stop||'Not set yet')}</td><td class="small">${e(n.funding||'')}</td><td class="small"><b>${e(n.status||'Added from Scoring')}</b>${n.alarm_status?` <span class="muted">(alarm: ${e(n.alarm_status)})</span>`:''}<br>${e(n.notes||'')}</td></tr>`;
}
const bust='?'+Date.now();
Promise.all([
  fetch('watchlist.json'+bust).then(r=>r.json()),
  fetch('watchlist-pending.json'+bust).then(r=>r.ok?r.json():{adds:[],removes:[]}).catch(()=>({adds:[],removes:[]}))
]).then(([w,p])=>{
  const q=localQ();
  const skip=new Set(Object.keys(q.removes||{}).map(norm));
  (p.removes||[]).forEach(x=>skip.add(norm(x.ticker)));
  const have=new Set();
  let h=`<h2>${e(w.title)}</h2><p class="muted small">${e(w.guidelines)}</p><div style="overflow-x:auto"><table class="data"><thead><tr><th>Name</th><th>Levels</th><th>Stop</th><th>Funding wallet</th><th>Status / notes</th></tr></thead><tbody>`;
  for(const n of (w.names||[])){
    const tk=norm(n.ticker); if(!tk||skip.has(tk))continue;
    have.add(tk); h+=row(n,false);
  }
  const extras=[];
  (p.adds||[]).forEach(x=>{const tk=norm(x.ticker); if(tk&&!have.has(tk)&&!skip.has(tk))extras.push(x);});
  Object.keys(q.adds||{}).forEach(tk=>{tk=norm(tk); if(tk&&!have.has(tk)&&!skip.has(tk)&&!extras.some(x=>norm(x.ticker)===tk))extras.push(q.adds[tk]);});
  for(const n of extras){ have.add(norm(n.ticker)); h+=row(Object.assign({levels:'Not set yet',stop:'Not set yet',status:'Added from Scoring'},n),true); }
  h+=`</tbody></table></div><p class="muted small">Not on list: ${(w.excluded||[]).map(e).join(' · ')}</p>`;
  let s=document.getElementById('watchlist');if(!s){s=document.createElement('section');s.id='watchlist';s.className='card';(document.querySelector('main')||document.body).appendChild(s)}
  s.innerHTML=h;
}).catch(x=>console.warn('watchlist',x));
})();
