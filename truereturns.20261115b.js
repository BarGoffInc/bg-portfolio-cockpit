/* 2026-11-15b: True returns since inception live on returns.html.
   Overview no longer injects this card; it only folds Manager vs Owner and Watchlist. */
(function () {
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var m = function (v) { if (v == null || isNaN(v)) return '—'; var a = Math.abs(v); var s = a >= 1e6 ? '$' + (a / 1e6).toFixed(2) + 'M' : '$' + Math.round(a).toLocaleString('en-US'); return (v < 0 ? '−' : '') + s; };
  var sm = function (v) { return (v < 0 ? '−' : '+') + m(Math.abs(v)); };
  var p = function (v, d) { if (v == null || isNaN(v)) return '—'; return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d == null ? 1 : d) + '%'; };
  var cls = function (v) { return v >= 0 ? 'pos' : 'neg'; };
  var fmtDay = function (s) { var d = new Date(s + 'T12:00:00'); return isNaN(d) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };

  function render(b) {
    var t = b.true_returns; if (!t) return;
    document.querySelectorAll('[data-asof]').forEach(function (el) { el.textContent = t.as_of_et || b.as_of_et || el.textContent; });
    var el = document.getElementById('true-returns-card');
    if (!el) return; // never inject onto Overview
    var g = t.goal || {};
    var high = (t.gaps || []).filter(function (x) { return x.severity === 'high'; });
    var capNote = t.starting_capital_note || 'bottom-up rebuild estimate, ±$10k, pending Aug 14–15 venue statements';
    var prog = Math.max(0, Math.min(100, (g.value_now_usd - g.start_value_usd) / (g.target_value_usd - g.start_value_usd) * 100));
    var pathPos = Math.max(0, Math.min(100, (g.on_path_value_today_usd - g.start_value_usd) / (g.target_value_usd - g.start_value_usd) * 100));
    var h = '<div style="padding:16px 20px">' +
      '<div class="tr-head"><div><p class="eyebrow" style="margin:0">True returns since inception · ' + esc(fmtDay(t.inception)) + ' · ' + t.days + ' days</p>' +
      '<div class="tr-big ' + cls(t.true_pnl_usd) + '">' + sm(t.true_pnl_usd) + ' <span style="font-size:16px;font-weight:600">true P&amp;L · ' + p(t.simple_return_pct) + ' on money in</span></div>' +
      '<div class="tr-sub">Value now minus every dollar put in (starting capital + deposits − withdrawals). Buys, sells and swaps are inside the value. As of ' + esc(t.as_of_et || '') + '.</div>' +
      '<div class="tr-sub">Starting capital ' + m(t.starting_capital_usd) + ' — ' + esc(capNote) + '.</div></div></div>' +
      '<div class="tr-tiles">' +
      '<div class="tr-tile"><span>Net contributed</span><strong>' + m(t.net_contributed_usd) + '</strong><small>' + m(t.starting_capital_usd) + ' start + ' + m(t.deposits_usd) + ' in − ' + m(t.withdrawals_usd) + ' out</small></div>' +
      '<div class="tr-tile"><span>Value now</span><strong>' + m(t.value_usd) + '</strong><small>All venues, no retirement</small></div>' +
      '<div class="tr-tile"><span>True P&amp;L</span><strong class="' + cls(t.true_pnl_usd) + '">' + sm(t.true_pnl_usd) + '</strong><small>Realized + unrealized</small></div>' +
      '<div class="tr-tile" title="Money-weighted: XIRR on the dated contributions. Reflects when money arrived."><span>Money-weighted (XIRR)</span><strong class="' + cls(t.mwr_period_pct) + '">' + p(t.mwr_period_pct) + '</strong><small>' + p(t.mwr_xirr_annualized_pct) + ' annualized</small></div>' +
      '<div class="tr-tile" title="Time-weighted: removes the timing of deposits; measures the decisions."><span>Time-weighted</span><strong class="' + cls(t.twr_pct) + '">' + p(t.twr_pct) + '</strong><small>Since ' + esc(fmtDay(t.inception)) + '</small></div>' +
      '</div>' +
      '<div class="tr-goal"><div style="font-size:13px;font-weight:700;margin-bottom:6px">5× goal: ' + m(g.start_value_usd) + ' (Nov 1, 2026) → ' + m(g.target_value_usd) + ' by May 2028 · now ' + (g.multiple_now || 0).toFixed(2) + '× (' + (g.multiple_ex_deposits || 0).toFixed(2) + '× without new money)</div>' +
      '<div class="bar"><i style="width:' + prog.toFixed(1) + '%"></i><b style="left:' + pathPos.toFixed(1) + '%" title="Where steady compounding would be today"></b></div>' +
      '<div class="lbl"><span>Progress ' + p(g.progress_pct) + ' of the way</span><span>On-pace value today ' + m(g.on_path_value_today_usd) + ' · ' + (g.vs_path_usd < 0 ? 'behind by ' : 'ahead by ') + m(Math.abs(g.vs_path_usd)) + '</span><span>Needs ≈' + (g.required_monthly_pct || 0).toFixed(1) + '%/month from here</span></div></div>' +
      (high.length ? '<div class="tr-flag"><b>Provisional:</b> ' + high.length + ' open data gap' + (high.length > 1 ? 's' : '') + ' (' + high.map(function (x) { return esc(x.id === 'start_capital' ? 'starting capital not statement-verified' : x.id === 'etrade_feed' ? 'E*TRADE feed frozen' : x.id); }).join(', ') + '). See "Data gaps" below.</div>' : '');

    h += '<details class="fold"><summary>Breakdown by venue</summary><table class="tr-table"><thead><tr><th>Venue</th><th>Value now</th><th>Deposits</th><th>Withdrawals</th><th>What is covered</th></tr></thead><tbody>';
    (t.venues || []).forEach(function (v) {
      h += '<tr><td><b>' + esc(v.name) + '</b>' + (v.stale ? '<span class="tr-tag high">STALE</span>' : '') + '</td><td class="tabular">' + m(v.value_usd) + '</td><td class="tabular">' + m(v.deposits_usd) + (v.flow_count ? ' <span class="text-muted">(' + v.flow_count + ')</span>' : '') + '</td><td class="tabular">' + m(v.withdrawals_usd) + '</td><td class="note">' + esc(v.coverage || '') + (v.stale ? ' <b>' + esc(v.stale) + '.</b>' : '') + '</td></tr>';
    });
    h += '<tr><td><b>Starting capital</b></td><td></td><td class="tabular">' + m(t.starting_capital_usd) + '</td><td></td><td class="note">Aug 15, 2026 · ' + esc(capNote) + '. The split by venue is not known.</td></tr>';
    h += '<tr><td><b>Total</b></td><td class="tabular"><b>' + m(t.value_usd) + '</b></td><td class="tabular"><b>' + m(t.starting_capital_usd + t.deposits_usd) + '</b></td><td class="tabular"><b>' + m(t.withdrawals_usd) + '</b></td><td class="note">Net contributed ' + m(t.net_contributed_usd) + '</td></tr></tbody></table>';
    var allFlows = []; (t.venues || []).forEach(function (v) { (v.flows || []).forEach(function (f) { allFlows.push(Object.assign({ venue: v.name }, f)); }); });
    allFlows.sort(function (a, b) { return a.day < b.day ? 1 : -1; });
    h += '<details class="fold"><summary>Every contribution (' + allFlows.length + ')</summary><table class="tr-table"><thead><tr><th>Day</th><th>Venue</th><th>Amount</th><th>Source</th></tr></thead><tbody>' +
      allFlows.map(function (f) { return '<tr><td>' + esc(f.day) + '</td><td style="text-align:left">' + esc(f.venue) + '</td><td class="tabular ' + cls(f.usd) + '">' + sm(f.usd) + '</td><td class="note">' + esc(f.src) + (f.memo ? ' · ' + esc(f.memo) : '') + '</td></tr>'; }).join('') +
      '</tbody></table></details></details>';

    h += '<details class="fold"><summary>Data gaps &amp; what we need (' + (t.gaps || []).length + ')</summary><ul class="tr-list">' +
      (t.gaps || []).map(function (x) { return '<li>' + (x.severity === 'high' ? '<span class="tr-tag high">HIGH</span> ' : x.severity === 'medium' ? '<span class="tr-tag">MED</span> ' : '<span class="tr-tag" style="background:#eef3f4;color:#5b6b73">LOW</span> ') + esc(x.text) + ' <i class="text-muted">Amount: ' + esc(x.amount) + '</i></li>'; }).join('') +
      '</ul><p style="font-size:13px;font-weight:700;margin:10px 0 2px">To close the gaps, please send:</p><ol class="tr-list">' + (t.data_needed || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></details>';

    h += '<details class="fold"><summary>How it is measured</summary><p style="font-size:13px;margin:6px 0">' + esc(t.method) + '</p><table class="tr-table"><thead><tr><th>Time-weighted leg</th><th>Return</th><th>Method</th></tr></thead><tbody>' +
      (t.twr_legs || []).map(function (l) { return '<tr><td>' + esc(l.from) + ' → ' + esc(l.to) + '</td><td class="tabular ' + cls(l.return_pct) + '">' + p(l.return_pct, 2) + '</td><td class="note">' + esc(l.method) + '</td></tr>'; }).join('') +
      '</tbody></table><p class="text-muted" style="font-size:12px">' + esc(g.note || '') + '</p></details>';
    h += '</div>';
    el.innerHTML = h;
  }

  // Overview only: fold the long Manager vs Owner card and the watchlist into drop-downs.
  function foldCard(id, title, sub) {
    var el = document.getElementById(id); if (!el || el.closest('.card-fold')) return !!el;
    var d = document.createElement('details'); d.className = 'card card-fold'; d.id = id + '-fold';
    d.innerHTML = '<summary><span>' + title + ' <small>' + sub + '</small></span></summary>';
    el.parentNode.insertBefore(d, el); d.appendChild(el); el.classList.remove('card'); el.style.margin = '0';
    return true;
  }
  if (document.body.getAttribute('data-page') === 'overview') {
    var tries = 0;
    (function waitFold() {
      var a = foldCard('since-start-card', 'Manager vs Owner split', 'P/L by sleeve, TWR and money-weighted, verified window');
      var w = foldCard('watchlist', 'Watchlist', 'approved names and levels');
      if ((!a || !w) && tries++ < 40) setTimeout(waitFold, 250);
    })();
  }

  fetch('book.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(render).catch(function () {});
})();
