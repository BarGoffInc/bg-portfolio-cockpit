(function(){
const e=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
fetch('watchlist.json?'+Date.now()).then(r=>r.json()).then(w=>{
 let h=`<h2>${e(w.title)}</h2><p class="muted small">${e(w.guidelines)}</p><div style="overflow-x:auto"><table class="data"><thead><tr><th>Name</th><th>Levels</th><th>Stop</th><th>Funding wallet</th><th>Status / notes</th></tr></thead><tbody>`;
 for(const n of w.names)h+=`<tr><td><b>${e(n.ticker)}</b>${n.priority?' ⭐':''}<br><span class="muted small">${e(n.name)}</span></td><td>${e(n.levels)}</td><td>${e(n.stop)}</td><td class="small">${e(n.funding)}</td><td class="small"><b>${e(n.status)}</b>${n.alarm_status?` <span class="muted">(alarm: ${e(n.alarm_status)})</span>`:''}<br>${e(n.notes)}</td></tr>`;
 h+=`</tbody></table></div><p class="muted small">Not on list: ${w.excluded.map(e).join(' · ')}</p>`;
 let s=document.getElementById('watchlist');if(!s){s=document.createElement('section');s.id='watchlist';s.className='card';(document.querySelector('main')||document.body).appendChild(s)}
 s.innerHTML=h}).catch(x=>console.warn('watchlist',x));
})();
