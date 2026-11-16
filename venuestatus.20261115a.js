/* 2026-11-15: venue freshness on every page. A venue is STALE when its connection is disabled
   or its last sync is older than 24h (book.json accounts[].stale / last_sync, written by refresh_book.py). */
(function () {
  function staleList(b) {
    var out = [];
    (b.accounts || []).forEach(function (a) {
      var ls = a.last_sync ? new Date(a.last_sync) : null;
      var old = ls && !isNaN(ls) && (Date.now() - ls.getTime()) > 24 * 3600e3;
      if (a.stale || String(a.status || '').toLowerCase() === 'stale' || a.connection_disabled || old) {
        out.push({ name: a.name, when: a.last_sync_et || (ls ? ls.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }) : 'unknown'),
          short: ls ? ls.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }) : '?', reason: a.stale_reason || '' });
      }
    });
    return out;
  }
  function apply(b) {
    var L = staleList(b);
    var foot = document.querySelector('.sidebar-foot');
    var old = document.getElementById('stale-note'); if (old) old.remove();
    var oldB = document.getElementById('stale-banner'); if (oldB) oldB.remove();
    if (!L.length) return;
    var txt = L.map(function (x) { return x.name + ' STALE · last sync ' + x.short; }).join(' · ');
    if (foot) {
      var s = document.createElement('small'); s.id = 'stale-note'; s.className = 'stale-note'; s.textContent = txt; foot.appendChild(s);
      var d = foot.querySelector('.dot'); if (d) { d.classList.remove('ok'); d.classList.add('warn'); }
    }
    document.querySelectorAll('.status-pill').forEach(function (p) {
      var d = p.querySelector('.dot'); if (d && p.querySelector('[data-asof]')) { d.classList.remove('ok'); d.classList.add('warn'); p.title = txt; }
    });
    var c = document.querySelector('.content');
    if (c) {
      var bn = document.createElement('div'); bn.id = 'stale-banner'; bn.className = 'stale-banner';
      bn.innerHTML = L.map(function (x) {
        return '<b>' + x.name + ' data is stale</b>: ' + (x.reason ? x.reason.replace(/</g, '&lt;') : 'last sync ' + x.when) + '. Its holdings and value are frozen at that point, not live.';
      }).join('<br>') + ' Re-link the connection to resume.';
      c.insertBefore(bn, c.firstChild);
    }
  }
  fetch('book.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (b) {
    apply(b);
    // the app re-renders on Refresh / autorefresh; re-apply after it settles
    document.addEventListener('click', function (e) { if (e.target && e.target.closest && e.target.closest('[data-refresh]')) setTimeout(function () { fetch('book.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(apply); }, 4000); });
  }).catch(function () {});
})();
