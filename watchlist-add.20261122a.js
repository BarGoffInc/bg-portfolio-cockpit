/* Score-a-ticker "Add to watchlist".
   Official list: watchlist.json (published from journal/cockpit-watchlist.json).
   This is a static GitHub Pages site, so a click cannot write the repo.
   Instant state lives in localStorage (key bg-wl-queue). A pending queue with
   the same shape is also kept there; Conviction's 3-hourly refresh merges
   journal/watchlist-pending.json into the official file via build_watchlist.py.
   See README.md "Watchlist adds". */
(function(){
const KEY='bg-wl-queue';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nowET=()=>new Date().toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})+' ET';

function emptyQ(){return {version:1,adds:{},removes:{}};}
function loadQ(){
  try{
    const q=JSON.parse(localStorage.getItem(KEY)||'');
    if(q&&q.version===1&&q.adds&&typeof q.adds==='object'&&q.removes&&typeof q.removes==='object')return q;
  }catch(e){}
  return emptyQ();
}
function saveQ(q){try{localStorage.setItem(KEY,JSON.stringify(q));}catch(e){}}

let official=new Set();
let excluded=new Set();
let fileAdds=new Set();
let fileRemoves=new Set();
let ready=false;

function norm(t){return String(t||'').trim().toUpperCase().replace(/^\$/,'');}

function isExcluded(tk){return excluded.has(norm(tk));}

function onList(tk){
  tk=norm(tk);
  const q=loadQ();
  if(q.removes[tk])return false;
  if(fileRemoves.has(tk)&&!q.adds[tk])return false;
  return official.has(tk)||fileAdds.has(tk)||!!q.adds[tk];
}

function queueExport(){
  const q=loadQ();
  return {
    updated_et: nowET(),
    adds: Object.keys(q.adds).sort().map(t=>{const x=q.adds[t]||{};return {
      ticker:t, name:x.name||t, added_et:x.added_et||nowET(), source:x.source||'scoring',
      score:x.score==null||x.score===''?null:x.score, cls:x.cls||null
    };}),
    removes: Object.keys(q.removes).sort().map(t=>{const x=q.removes[t]||{};return {
      ticker:t, removed_et:x.removed_et||nowET(), source:x.source||'scoring'
    };})
  };
}

function addToQueue(tk,meta){
  tk=norm(tk); if(!tk||isExcluded(tk))return;
  const q=loadQ();
  delete q.removes[tk];
  if(!official.has(tk)){
    const prev=q.adds[tk]||{};
    q.adds[tk]=Object.assign({ticker:tk,added_et:nowET(),source:'scoring'},prev,meta||{});
    q.adds[tk].ticker=tk;
  }
  saveQ(q);
  // Keep a window-global snapshot so Conviction can read it from a browser
  // session on this device, and so tests can inspect the queue.
  window.BGWatchlistQueue=queueExport();
}

function removeFromQueue(tk){
  tk=norm(tk); if(!tk)return;
  const q=loadQ();
  delete q.adds[tk];
  if(official.has(tk)||fileAdds.has(tk)) q.removes[tk]={ticker:tk,removed_et:nowET(),source:'scoring'};
  saveQ(q);
  window.BGWatchlistQueue=queueExport();
}

function cellHtml(tk,meta){
  tk=norm(tk);
  const name=(meta&&meta.name)||'';
  const score=meta&&meta.score;
  const attr=`data-tk="${esc(tk)}"${name?` data-name="${esc(name)}"`:''}${score!=null&&score!==''?` data-score="${esc(score)}"`:''}`;
  if(isExcluded(tk)&&!onList(tk)) return `<span class="wlex" ${attr}>Excluded</span>`;
  if(onList(tk)) return `<span class="wlon" ${attr}>On watchlist <button type="button" data-wl-remove="${esc(tk)}">Remove</button></span>`;
  return `<button type="button" class="wlbtn" data-wl-add="${esc(tk)}" ${attr}>Add to watchlist</button>`;
}

function decorate(){
  if(!ready)return;
  const main=document.querySelector('main'); if(!main)return;

  const table=main.querySelector('table.rk.lb');
  if(table){
    const head=table.querySelector('tr');
    if(head&&!head.querySelector('.wlth')){
      const th=document.createElement('th');
      th.className='wlth'; th.textContent='Watchlist';
      head.appendChild(th);
    }
    table.querySelectorAll('tr').forEach(tr=>{
      if(tr.querySelector('th'))return;
      if(tr.querySelector('.wlcell'))return;
      const a=tr.querySelector('a[href*="tk="]');
      if(!a)return;
      let tk='';
      try{tk=norm(new URL(a.getAttribute('href'),location.href).searchParams.get('tk'));}catch(e){tk=norm(a.textContent);}
      if(!tk)return;
      const name=(tr.querySelector('.muted')||{}).textContent||'';
      let score='';
      const tds=tr.querySelectorAll('td');
      if(tds[2]){const b=tds[2].querySelector('b'); if(b)score=b.textContent.trim();}
      const td=document.createElement('td');
      td.className='wlcell';
      td.innerHTML=cellHtml(tk,{name:name.trim(),score:score});
      tr.appendChild(td);
    });
    if(!main.querySelector('p.wlhint')&&table.parentElement){
      const p=document.createElement('p');
      p.className='note wlhint';
      p.textContent='Adds are saved on this device right away. Conviction copies them onto the official watchlist on the next book refresh once they are in the pending queue.';
      table.insertAdjacentElement('afterend',p);
    }
  }

  const tkhead=main.querySelector('.tkhead');
  if(tkhead&&!tkhead.querySelector('.wlwrap')){
    const h=tkhead.querySelector('h1');
    const tk=h?norm(h.textContent):'';
    if(tk){
      const nameP=tkhead.querySelector('p.muted');
      const name=nameP?nameP.textContent.split('·')[0].trim():'';
      let score='';
      const kv=main.querySelector('.kv');
      if(kv){const m=kv.textContent.match(/Score\s+(\d+)/); if(m)score=m[1];}
      const wrap=document.createElement('div');
      wrap.className='wlwrap';
      wrap.innerHTML=cellHtml(tk,{name,score});
      tkhead.appendChild(wrap);
    }
  }
}

function refreshCells(){
  document.querySelectorAll('.wlcell, .wlwrap').forEach(el=>{
    const node=el.querySelector('[data-tk], [data-wl-add], [data-wl-remove]');
    const tk=norm(node&&(node.getAttribute('data-tk')||node.getAttribute('data-wl-add')||node.getAttribute('data-wl-remove')));
    if(!tk)return;
    const name=node&&node.getAttribute('data-name')||'';
    const score=node&&node.getAttribute('data-score')||'';
    el.innerHTML=cellHtml(tk,{name,score});
  });
}

document.addEventListener('click',e=>{
  const addBtn=e.target.closest('[data-wl-add]');
  const remBtn=e.target.closest('[data-wl-remove]');
  if(!addBtn&&!remBtn)return;
  e.preventDefault();
  e.stopPropagation();
  if(addBtn){
    const tk=norm(addBtn.getAttribute('data-wl-add')||addBtn.getAttribute('data-tk'));
    addToQueue(tk,{
      name:addBtn.getAttribute('data-name')||'',
      score:addBtn.getAttribute('data-score')||''
    });
  }else{
    const tk=norm(remBtn.getAttribute('data-wl-remove')||remBtn.getAttribute('data-tk'));
    removeFromQueue(tk);
  }
  refreshCells();
  decorate();
});

function parseExcluded(list){
  const s=new Set();
  (list||[]).forEach(line=>{
    const m=String(line||'').trim().match(/^([A-Z0-9.+-]+)/i);
    if(m)s.add(m[1].toUpperCase());
  });
  return s;
}

function loadLists(){
  const bust='?_='+Date.now();
  const get=u=>fetch(u+bust).then(r=>r.ok?r.json():null).catch(()=>null);
  return Promise.all([get('watchlist.json'), get('watchlist-pending.json')]).then(([w,p])=>{
    official=new Set();
    if(w&&Array.isArray(w.names)) w.names.forEach(n=>{if(n&&n.ticker)official.add(norm(n.ticker));});
    excluded=parseExcluded(w&&w.excluded);
    fileAdds=new Set(); fileRemoves=new Set();
    if(p){
      (p.adds||[]).forEach(x=>{if(x&&x.ticker)fileAdds.add(norm(x.ticker));});
      (p.removes||[]).forEach(x=>{if(x&&x.ticker)fileRemoves.add(norm(x.ticker));});
    }
    ready=true;
    window.BGWatchlistQueue=queueExport();
    decorate();
  });
}

const main=document.querySelector('main');
if(main&&typeof MutationObserver!=='undefined'){
  let t=null;
  new MutationObserver(()=>{
    if(t)clearTimeout(t);
    t=setTimeout(decorate,30);
  }).observe(main,{childList:true,subtree:false});
}
loadLists();
window.BGWatchlist={onList,add:addToQueue,remove:removeFromQueue,decorate,queue:queueExport};
})();
