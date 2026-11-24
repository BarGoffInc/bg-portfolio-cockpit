/* The plan, in two parts: long-term core + value/oversold sleeve. Data: plan-sleeves.json. Read-only. */
(function(){
  if(document.body.dataset.page!=='plan')return;
  var D=null,esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
  function html(){
    var c=D.core,s=D.sleeve;
    var core='<section class="card wide ps-part" data-ps><h2>'+esc(c.title)+'</h2><p class="muted">'+esc(c.blurb)+'</p>'+
      '<table class="rk ps"><tr><th>Name</th><th>Score</th><th>Target</th><th>Plan</th><th>Exit if a week closes</th></tr>'+
      c.rows.map(function(r){return '<tr><td><a href="charts.html?t='+encodeURIComponent(r.t)+'"><b>'+esc(r.t)+'</b></a></td><td>'+(r.score==null?'—':r.score)+'</td><td>'+esc(r.target)+'</td><td>'+esc(r.plan)+'</td><td>'+esc(r.stop)+'</td></tr>';}).join('')+
      '</table><p class="muted">'+esc(c.foot)+'</p></section>';
    var tag=function(st){return st==='Qualifies'?'go':(st==='Wait'||st==='Waiting for price')?'hold':'';};
    var sl='<section class="card wide ps-part" data-ps><h2>'+esc(s.title)+'</h2><p class="muted">'+esc(s.blurb)+'</p><p class="lead"><b>Budget:</b> '+esc(s.budget)+'</p>'+
      '<table class="rk ps"><tr><th>Name</th><th>Score</th><th>Status</th><th>Why</th></tr>'+
      s.rows.map(function(r){return '<tr><td><a href="charts.html?t='+encodeURIComponent(r.t)+'"><b>'+esc(r.t)+'</b></a></td><td>'+(r.score==null?'not scored':r.score)+'</td><td><span class="tag '+tag(r.status)+'">'+esc(r.status)+'</span></td><td>'+esc(r.why)+'</td></tr>';}).join('')+
      '</table><details><summary>Sleeve rules</summary><ul class="plain">'+s.rules.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></details></section>';
    var top='<section class="card wide market" data-ps><h2>What we\'re doing now</h2><p class="lead">'+esc(D.cta)+'</p><p class="muted">'+esc(D.tsla_clash)+'</p><p class="muted">Plan as of '+esc(D.as_of_et)+'</p></section>';
    return top+core+sl;
  }
  function inject(){
    var m=document.querySelector('main');if(!m||!D)return;
    if(m.querySelector('[data-ps]'))return;
    var head=m.querySelector('.pagehead');if(!head)return;
    var p=head.querySelector('p');if(p)p.textContent='Two parts: a long-term core we only add to at planned support, and a value + oversold sleeve open to anything on sale.';
    head.insertAdjacentHTML('afterend',html());
    m.querySelectorAll('section.card h2').forEach(function(h){if(/^The \d+ seats/.test(h.textContent))h.textContent=h.textContent.replace(/^The (\d+) seats/,'Core seat detail ($1 seats)');});
  }
  var st=document.createElement('style');st.textContent='table.ps td{vertical-align:top}table.ps td:nth-child(4){min-width:220px}@media(max-width:640px){table.ps{font-size:12px}}';document.head.appendChild(st);
  fetch('plan-sleeves.json?b='+Date.now(),{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){D=j;inject();
    var m=document.querySelector('main');if(m)new MutationObserver(function(){inject();}).observe(m,{childList:true});}).catch(function(){});
})();
