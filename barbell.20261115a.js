/* 2026-11-15: Overview mini "Barbell: current vs target" (replaces the Oct 13 Now-vs-target bars).
   Same sleeve rules as ranking.20261115a.js (keep SLEEVES / sleeveOf in sync). Full view: ranking.html. */
(function () {
  var SLEEVES = [
    { id: 'Cash', target: 8, band: [5, 15], names: [] },
    { id: 'Survival', target: 35, names: ['BTC', 'SOL', 'TSLA', 'NVDA'] },
    { id: 'Torque', target: 45, names: ['TAO', 'VVV', 'SPCX', 'SKHY', 'ALAB'] },
    { id: 'Lottery', target: 12, names: ['BNKR', 'SN51+SN4', 'RENDER'] }
  ];
  var OWNER = /^(SUI|HYPE|UNI|DRIFT|SUPER|NEAR|XRP)\b/i, STABLE = /^(USDC|USDT|USD|USDG|PYUSD|USDE|DAI)\b/i;
  function sleeveOf(sym) {
    var u = String(sym).toUpperCase();
    if (STABLE.test(u)) return 'Cash'; if (OWNER.test(u)) return 'Owner';
    if (/^(BTC|TSLA|NVDA|SOL|JUPSOL)\b/.test(u)) return 'Survival';
    if (/^(TAO|VVV|SPCX|SKHY|ALAB)\b/.test(u)) return 'Torque';
    if (/^(BNKR|RENDER|RNDR|SN51|SN4)\b/.test(u)) return 'Lottery';
    return 'Unseated';
  }
  var usd = function (v) { var a = Math.abs(v), s = v < 0 ? '−' : ''; return s + '$' + (a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'k' : Math.round(a)); };
  function render(book) {
    var t = book.totals, total = t.book_usd, agg = { Survival: 0, Torque: 0, Lottery: 0, Owner: 0, Unseated: 0 };
    Object.keys(book.positions).forEach(function (acct) { (book.positions[acct] || []).forEach(function (p) { var s = sleeveOf(p.symbol); if (s !== 'Cash') agg[s] += p.mv || 0; }); });
    var cash = t.cash_net, managed = total - agg.Owner, scale = 60;
    var rows = SLEEVES.map(function (s) { var cur = s.id === 'Cash' ? cash : agg[s.id], cp = cur / managed * 100; return { s: s, cur: cur, pct: cp, gap: cur - s.target / 100 * managed }; });
    var el = document.getElementById('barbell-mini');
    if (!el) {
      el = document.createElement('section'); el.id = 'barbell-mini'; el.className = 'card';
      var c = document.querySelector('.content'); if (!c) return;
      var nav = document.getElementById('nav-series-card'); if (nav) c.insertBefore(el, nav); else c.appendChild(el);
    }
    var h = '<div class="card-head"><div><p class="sub">Allocation · live book</p><h3>Barbell: current vs target</h3></div><a class="link-teal" href="ranking.html">Ranking &amp; allocation →</a></div><div style="padding:0 20px 16px">';
    rows.forEach(function (r) {
      var w = Math.min(100, r.pct / scale * 100), tg = r.s.target / scale * 100, over = r.pct > r.s.target + 3;
      var band = r.s.band ? '<em style="left:' + (r.s.band[0] / scale * 100) + '%;width:' + ((r.s.band[1] - r.s.band[0]) / scale * 100) + '%"></em>' : '';
      h += '<div class="bb-row"><div><b>' + r.s.id + '</b></div><div class="bb-bar">' + band + '<i class="' + (over ? 'over' : '') + '" style="width:' + w.toFixed(1) + '%"></i><b style="left:' + tg.toFixed(1) + '%" title="target ' + r.s.target + '%"></b></div>' +
        '<div class="bb-gap">' + r.pct.toFixed(1) + '% <span class="text-muted">/ ' + r.s.target + '%</span><br><small class="text-muted">' + (r.gap < 0 ? 'under ' : 'over ') + usd(Math.abs(r.gap)) + '</small></div></div>';
    });
    h += '<details class="fold"><summary>Outside the barbell</summary><p style="font-size:13px;margin:6px 0">Owner names (kept out of seat money) ' + usd(agg.Owner) + ' · Unseated holdings ' + usd(agg.Unseated) + '. Percentages are of the managed book ' + usd(managed) + ' (book ' + usd(total) + ' less the owner block). The thin line is the target; the shaded band is the cash range.</p></details></div>';
    el.innerHTML = h;
  }
  fetch('book.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(render).catch(function () {});
})();
