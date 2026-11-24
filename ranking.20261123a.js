/* BG Cockpit — Ranking & allocation (v3 + score history, 2026-11-17). Reads book.json + ranking.json + score-history.json. */
(function () {
  'use strict';
  var root = document.getElementById('rk-root');
  var $ = function (h) { var d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstChild; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var usd = function (v, d) { if (v == null || isNaN(v)) return '—'; var a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + 'M'; if (a >= 1e4) return s + '$' + (a / 1e3).toFixed(1) + 'k';
    return s + '$' + a.toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d }); };
  var px = function (v) { if (v == null) return '—'; var t = v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v >= 100 ? String(Number(v.toFixed(2))) : v >= 1 ? v.toFixed(2).replace(/\.00$/, '') : String(Number(v.toPrecision(3))); return '$' + t; };
  var pct = function (v, d) { return (v >= 0 ? '' : '−') + Math.abs(v).toFixed(d == null ? 1 : d) + '%'; };
  var CHIP = { 'Buy': 'g', 'Hold/Ride': 'g', 'Watch': 'a', 'Trim': 'a', 'Cut': 'r' };
  var chip = function (a) { return '<span class="rk-chip ' + (CHIP[a] || '') + '">' + esc(a) + '</span>'; };

  /* ---------- config (edit here; modular) ---------- */
  var SLEEVES = [
    { id: 'Cash', target: 8, band: [5, 15], names: [] },
    { id: 'Survival', target: 35, names: ['BTC', 'SOL', 'TSLA', 'NVDA'] },
    { id: 'Torque', target: 45, names: ['TAO', 'VVV', 'SPCX', 'SKHY', 'ALAB'] },
    { id: 'Lottery', target: 12, names: ['BNKR', 'SN51+SN4', 'RENDER'] }
  ];
  var OWNER = /^(SUI|HYPE|UNI|DRIFT|SUPER|NEAR|XRP)\b/i;
  var STABLE = /^(USDC|USDT|USD|USDG|PYUSD|USDE|DAI)\b/i;
  function sleeveOf(sym) {
    var u = String(sym).toUpperCase();
    if (STABLE.test(u)) return 'Cash';
    if (OWNER.test(u)) return 'Owner';
    if (/^(BTC|TSLA|NVDA|SOL|JUPSOL)\b/.test(u)) return 'Survival';
    if (/^(TAO|VVV|SPCX|SKHY|ALAB)\b/.test(u)) return 'Torque';
    if (/^(BNKR|RENDER|RNDR|SN51|SN4)\b/.test(u)) return 'Lottery';
    return 'Unseated';
  }
  function baseSym(sym) { return String(sym).toUpperCase().split(/[\s(·]/)[0].replace('JUPSOL', 'SOL'); }

  /* ---------- allocation ---------- */
  function allocation(book) {
    var t = book.totals, total = t.book_usd, agg = { Survival: 0, Torque: 0, Lottery: 0, Owner: 0, Unseated: 0 }, lines = {}, bySym = {};
    Object.keys(book.positions).forEach(function (acct) {
      (book.positions[acct] || []).forEach(function (p) {
        var s = sleeveOf(p.symbol), mv = p.mv || 0; if (s === 'Cash') return;
        agg[s] += mv; (lines[s] = lines[s] || []).push({ sym: p.symbol, acct: acct, mv: mv });
        var b = baseSym(p.symbol); bySym[b] = (bySym[b] || 0) + mv;
      });
    });
    var cash = t.cash_net, managed = total - agg.Owner;
    var resid = total - cash - agg.Survival - agg.Torque - agg.Lottery - agg.Owner - agg.Unseated;
    var rows = SLEEVES.map(function (s) {
      var cur = s.id === 'Cash' ? cash : agg[s.id], cp = cur / managed * 100, tg = s.target;
      return { id: s.id, cur: cur, pct: cp, target: tg, band: s.band, gapPct: cp - tg, gapUsd: cur - tg / 100 * managed, names: s.names };
    });
    return { total: total, managed: managed, cash: cash, agg: agg, lines: lines, rows: rows, resid: resid, bySym: bySym, cb: t.cash_breakdown || {} };
  }
  function sizeFor(n, R, A) {
    var tiers = R.sizing.tiers, m = 0; for (var i = 0; i < tiers.length; i++) { if (n.score >= tiers[i][0]) { m = tiers[i][1]; break; } }
    var reg = R.sizing.regime[n.cls === 'crypto' ? 'crypto' : 'stock'];
    var sl = SLEEVES.filter(function (s) { return s.names.indexOf(n.tk) >= 0; })[0];
    if (!sl) return null;
    var seatPct = (R.seat_weights && R.seat_weights[n.tk]) || sl.target / sl.names.length, tgt = seatPct / 100 * A.managed;
    var held = A.bySym[n.tk] || 0;
    return { seatPct: seatPct, tier: m, reg: reg, target: tgt * m, now: tgt * m * reg, held: held, add: Math.max(0, tgt * m * reg - held) };
  }
  function nextActions(R, A) {
    var out = [];
    var under = A.rows.filter(function (r) { return r.id !== 'Cash' && r.gapUsd < 0; }).sort(function (a, b) { return a.gapUsd - b.gapUsd; });
    under.forEach(function (r) {
      var cands = R.board.filter(function (n) { return r.names.indexOf(n.tk) >= 0 && n.action !== 'Cut' && !/^Fail/.test(n.legit || ''); })
        .map(function (n) { return { n: n, s: sizeFor(n, R, A) }; }).filter(function (x) { return x.s && x.s.add > 500; })
        .sort(function (a, b) { return b.n.score - a.n.score; });
      cands.slice(0, 2).forEach(function (x) {
        var gateTxt = x.n.gate || 'its full gate (both trend lines up, a Buy signal, price in the entry zone)';
        out.push({ t: 'Set up ' + x.n.tk + ' for ' + usd(x.s.add) + ' (' + r.id + ' is ' + usd(-r.gapUsd) + ' under)',
          d: ladderLine(x.n) + '. Score ' + x.n.score + ' earns ' + Math.round(x.s.tier * 100) + '% of its ' + x.s.seatPct.toFixed(1) + '% seat, times ' + Math.round(x.s.reg * 100) + '% for the market regime. Buy only on ' + gateTxt + '.', score: x.n.score });
      });
    });
    var blocked = R.board.filter(function (n) { return n.cls === 'crypto' && (R.seat_weights || {})[n.tk] && n.score >= 50 && !/^Fail/.test(n.legit || ''); }).map(function (n) { return n.tk; });
    if (R.sizing.regime.crypto === 0 && blocked.length) out.push({ t: 'Decentralized-AI adds wait for the crypto regime', d: blocked.join(', ') + ' have seats and scores, but crypto is risk-off, so the tested rule sizes new crypto buys at 0% until BTC\'s weekly trend turns back up. Decision: these buys wait for the bottom watch.', score: 1 });
    out.sort(function (a, b) { return b.score - a.score; });
    var hl = A.cb.hyperliquid_perps_margin || 0, debt = (A.cb.etrade < 0 ? A.cb.etrade : 0) + (A.cb.robinhood < 0 ? A.cb.robinhood : 0);
    if (hl > 20000) out.splice(1, 0, { t: 'Move idle cash before the gates open', d: usd(hl) + ' sits as Hyperliquid USDC with no positions; stock buys need it at E*TRADE/Robinhood.' + (debt < 0 ? ' Clear the ' + usd(-debt) + ' margin debit first.' : '') });
    return out;
  }

  /* ---------- score history (score-history.json, written by ranking/snapshot_history.py) ---------- */
  var HIST = {};
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dShort(d) { var p = String(d).split('-'); return MON[+p[1] - 1] + ' ' + (+p[2]); }
  function dDays(a, b) { return (Date.parse(b) - Date.parse(a)) / 864e5; }
  function histOf(tk) { return HIST[tk] || []; }
  function wkChange(tk) {
    var L = histOf(tk); if (!L.length) return null;
    var last = L[L.length - 1], prev = null;
    for (var i = L.length - 2; i >= 0; i--) { if (dDays(L[i].date, last.date) >= 6) { prev = L[i]; break; } }
    if (prev) return { d: last.score - prev.score, txt: 'wk', since: prev.date };
    if (L.length > 1) return { d: last.score - L[0].score, txt: 'since ' + dShort(L[0].date), since: L[0].date };
    return { d: null, txt: 'new · since ' + dShort(last.date), since: last.date };
  }
  function deltaHtml(tk, short) {
    var c = wkChange(tk); if (!c) return '';
    if (c.d == null) return '<span class="sc-delta n" title="' + esc(c.txt) + '">' + (short ? 'new' : esc(c.txt)) + '</span>';
    var cls = c.d > 0 ? 'up' : c.d < 0 ? 'dn' : 'n', sign = c.d > 0 ? '+' : c.d < 0 ? '−' : '±';
    return '<span class="sc-delta ' + cls + '">' + sign + Math.abs(c.d) + ' ' + esc(c.txt) + '</span>';
  }
  function spark(tk) {
    var L = histOf(tk); if (!L.length) return '';
    var W = 54, H = 16, n = L.length, v = L.map(function (x) { return x.score; });
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v); if (hi - lo < 10) { var m = (hi + lo) / 2; lo = m - 5; hi = m + 5; }
    var pt = function (x, i) { return [n === 1 ? W - 3 : 2 + i * (W - 5) / (n - 1), H - 2 - (x - lo) / (hi - lo) * (H - 4)]; };
    var P = v.map(pt), last = P[n - 1];
    var line = n > 1 ? '<polyline points="' + P.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') + '"/>' : '<line class="base" x1="2" x2="' + (W - 3) + '" y1="' + last[1].toFixed(1) + '" y2="' + last[1].toFixed(1) + '"/>';
    return '<svg class="sc-spark" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">' + line + '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.2"/></svg>';
  }
  function histChart(tk) {
    var L = histOf(tk); if (!L.length) return '<p class="rk-sub">No history yet. The weekly rescore adds a point every week.</p>';
    var W = 600, H = 170, l = 34, r = 14, t = 12, b = 26, n = L.length;
    var X = function (i) { return n === 1 ? (l + W - r) / 2 : l + i * (W - l - r) / (n - 1); }, Y = function (v) { return t + (100 - v) / 100 * (H - t - b); };
    var g = '';
    [[75, 'g'], [60, 'a'], [50, 'n']].forEach(function (z) { g += '<line class="tier ' + z[1] + '" x1="' + l + '" x2="' + (W - r) + '" y1="' + Y(z[0]) + '" y2="' + Y(z[0]) + '"/><text class="ax" x="' + (l - 6) + '" y="' + (Y(z[0]) + 4) + '" text-anchor="end">' + z[0] + '</text>'; });
    g += '<text class="ax" x="' + (l - 6) + '" y="' + (Y(100) + 4) + '" text-anchor="end">100</text><text class="ax" x="' + (l - 6) + '" y="' + (Y(0) + 4) + '" text-anchor="end">0</text>';
    var pts = L.map(function (x, i) { return [X(i), Y(x.score)]; });
    if (n > 1) g += '<polyline class="ln" points="' + pts.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') + '"/>';
    var step = Math.max(1, Math.ceil(n / 8));
    L.forEach(function (x, i) {
      g += '<circle class="pt ' + scoreCls(x.score) + '" cx="' + pts[i][0].toFixed(1) + '" cy="' + pts[i][1].toFixed(1) + '" r="4"><title>' + esc(dShort(x.date) + ': ' + x.score + ' · ' + x.action) + '</title></circle>';
      if (i % step === 0 || i === n - 1) g += '<text class="ax" x="' + pts[i][0].toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + (n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '">' + dShort(x.date) + '</text>';
    });
    g += '<text class="lbl" x="' + pts[n - 1][0].toFixed(1) + '" y="' + (pts[n - 1][1] - 9).toFixed(1) + '" text-anchor="' + (n === 1 ? 'middle' : 'end') + '">' + L[n - 1].score + '</text>';
    return '<svg class="sc-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(tk) + ' score over time">' + g + '</svg>';
  }
  function histTable(tk) {
    var L = histOf(tk).slice().reverse(); if (!L.length) return '';
    var f = function (v) { return v == null ? '—' : (+v).toFixed(v % 1 ? 2 : 0).replace(/0$/, '').replace(/\.$/, ''); };
    return '<div class="sc-tbl-wrap"><table class="sc-tbl"><thead><tr><th>Date</th><th>Score</th><th title="Business strength">Business</th><th title="Market size & runway">Market</th><th title="Crowd cycle / catalyst">Crowd</th><th title="Chart (technicals)">Chart</th><th title="Fits today\'s market">Fit</th><th>Action</th><th>Price</th></tr></thead><tbody>' +
      L.map(function (x, i) {
        var nx = L[i + 1], dc = function (k) { return nx && nx[k] != null && x[k] != null && x[k] !== nx[k] ? (x[k] > nx[k] ? ' class="up"' : ' class="dn"') : ''; };
        return '<tr><td>' + dShort(x.date) + '</td><td' + dc('score') + '><b>' + x.score + '</b></td><td' + dc('B') + '>' + f(x.B) + '</td><td' + dc('T') + '>' + f(x.T) + '</td><td' + dc('C') + '>' + f(x.C) + '</td><td' + dc('X') + '>' + f(x.X) + '</td><td' + dc('R') + '>' + f(x.R) + '</td><td>' + esc(x.action) + '</td><td>' + px(x.px) + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="rk-sub">Pillars are 1–5. Green or red marks a change from the previous rescore. Price is the price at scoring time.</p>';
  }
  function trendBlock(tk) {
    var L = histOf(tk), c = wkChange(tk);
    return '<div style="grid-column:1/-1"><h4>Score over time</h4>' +
      (L.length ? '<p class="sc-headline"><b>' + esc(tk) + ' ' + L[L.length - 1].score + '</b> ' + deltaHtml(tk) + '<span class="rk-sub"> · ' + L.length + ' weekly point' + (L.length > 1 ? 's' : '') + ' since ' + dShort(L[0].date) + '</span></p>' : '') +
      histChart(tk) + histTable(tk) + '</div>';
  }

  /* ---------- quick technical score (any ticker not on the board; chart inputs only) ---------- */
  var TV = 'https://scanner.tradingview.com/america/scan', CB = 'https://api.exchange.coinbase.com/products/', CG = 'https://api.coingecko.com/api/v3/';
  function getJ(u, o) { return fetch(u, o).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }
  function smaOf(c, n) { if (c.length < n) return null; var s = 0; for (var i = c.length - n; i < c.length; i++) s += c[i]; return s / n; }
  function rsiSeries(c, n) {
    if (c.length < n + 3) return [];
    var g = 0, l = 0, out = [];
    for (var i = 1; i <= n; i++) { var d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
    g /= n; l /= n; out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l));
    for (i = n + 1; i < c.length; i++) { d = c[i] - c[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l)); }
    return out;
  }
  function fromCloses(closes, highs, src, name) {
    var rs = rsiSeries(closes, 14), k = rs.length;
    var hi = Math.max.apply(null, (highs || closes).slice(-365));
    return { px: closes[closes.length - 1], sma50: smaOf(closes, 50), sma200: smaOf(closes, 200), rsi: k ? rs[k - 1] : null,
      rsiSig: k >= 3 ? (rs[k - 1] + rs[k - 2] + rs[k - 3]) / 3 : null, hi52: hi, days: closes.length, src: src, name: name, cls: 'crypto' };
  }
  function stockData(q) {
    var body = JSON.stringify({ filter: [{ left: 'name', operation: 'equal', right: q }], columns: ['name', 'description', 'exchange', 'type', 'close', 'SMA50', 'SMA200', 'RSI', 'RSI[1]', 'RSI[2]', 'price_52_week_high', 'market_cap_basic'],
      sort: { sortBy: 'market_cap_basic', sortOrder: 'desc' }, range: [0, 3] });
    return getJ(TV, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body }).then(function (j) {
      var row = (j.data || []).filter(function (x) { return x.d[0] === q && x.d[4] != null; })[0]; if (!row) return null;
      var d = row.d, rr = [d[7], d[8], d[9]].filter(function (v) { return v != null; });
      return { px: d[4], sma50: d[5], sma200: d[6], rsi: d[7], rsiSig: rr.length === 3 ? (rr[0] + rr[1] + rr[2]) / 3 : null, hi52: d[10], name: d[1], cls: 'stock',
        src: 'TradingView screener (' + row.s + ', delayed ~15 min)', mcap: d[11] };
    }).catch(function () { return null; });
  }
  function coinbaseData(q) {
    var now = Math.floor(Date.now() / 1000), day = 86400, iso = function (s) { return new Date(s * 1000).toISOString(); };
    var u = function (a, b) { return CB + encodeURIComponent(q) + '-USD/candles?granularity=86400&start=' + iso(a) + '&end=' + iso(b); };
    return Promise.all([getJ(u(now - 299 * day, now)), getJ(u(now - 400 * day, now - 300 * day)).catch(function () { return []; })]).then(function (r) {
      var m = {}; r[0].concat(r[1]).forEach(function (c) { m[c[0]] = c; });
      var rows = Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return a[0] - b[0]; });
      if (rows.length < 20) return null;
      return fromCloses(rows.map(function (c) { return c[4]; }), rows.map(function (c) { return c[2]; }), 'Coinbase Exchange daily candles (' + q + '-USD)', q + ' (Coinbase)');
    }).catch(function () { return null; });
  }
  function geckoData(q) {
    return getJ(CG + 'search?query=' + encodeURIComponent(q)).then(function (j) {
      var c = (j.coins || []).filter(function (x) { return String(x.symbol).toUpperCase() === q; })
        .sort(function (a, b) { return (a.market_cap_rank || 1e9) - (b.market_cap_rank || 1e9); })[0];
      if (!c) return null;
      if (geckoData.needRank && !(c.market_cap_rank && c.market_cap_rank <= 300)) return null;
      return getJ(CG + 'coins/' + encodeURIComponent(c.id) + '/market_chart?vs_currency=usd&days=365&interval=daily').then(function (m) {
        var cl = (m.prices || []).map(function (p) { return p[1]; }); if (cl.length < 20) return null;
        return fromCloses(cl, null, 'CoinGecko daily closes (' + c.id + (c.market_cap_rank ? ', rank #' + c.market_cap_rank : ', unranked') + ')', c.name + ' (CoinGecko match by symbol)');
      });
    }).catch(function () { return null; });
  }
  /* Coinbase listing first; CoinGecko symbol match only as a fallback (top-300 only when a US stock has the same ticker, to avoid copycat tokens). */
  function cryptoData(q, stockP) { return coinbaseData(q).then(function (r) { if (r) return r; return stockP.then(function (st) { geckoData.needRank = !!st; return geckoData(q); }); }); }
  function quickScore(m) {
    var C = [], dd = m.hi52 ? (m.px / m.hi52 - 1) * 100 : null;
    var add = function (label, ok, pts, max, detail) { C.push({ label: label, ok: ok, pts: ok ? pts : 0, max: ok == null ? 0 : max, detail: detail }); };
    add('Price above its 200-day average', m.sma200 == null ? null : m.px > m.sma200, 30, 30, m.sma200 == null ? 'not enough history' : px(m.sma200) + ' (' + pct(dist(m.sma200, m.px)) + ')');
    add('Price above its 50-day average', m.sma50 == null ? null : m.px > m.sma50, 20, 20, m.sma50 == null ? 'not enough history' : px(m.sma50) + ' (' + pct(dist(m.sma50, m.px)) + ')');
    add('50-day above 200-day (uptrend)', m.sma50 == null || m.sma200 == null ? null : m.sma50 > m.sma200, 15, 15, m.sma50 == null || m.sma200 == null ? 'not enough history' : (m.sma50 > m.sma200 ? 'yes' : 'no'));
    add('RSI14 above its 3-day average (momentum turning up)', m.rsi == null || m.rsiSig == null ? null : m.rsi > m.rsiSig, 15, 15, m.rsi == null ? 'not available' : m.rsi.toFixed(1) + ' vs ' + (m.rsiSig == null ? '—' : m.rsiSig.toFixed(1)) + (m.rsi < 30 ? ' · washed out' : m.rsi > 70 ? ' · overheated' : ''));
    var hp = dd == null ? 0 : dd >= -10 ? 20 : dd >= -25 ? 12 : dd >= -50 ? 5 : 0;
    C.push({ label: 'Near its 52-week high', ok: dd == null ? null : hp >= 12, pts: hp, max: dd == null ? 0 : 20, detail: dd == null ? 'not available' : px(m.hi52) + ' (' + pct(dd) + ' from high)' });
    var pts = 0, max = 0; C.forEach(function (c) { pts += c.pts; max += c.max; });
    return { score: max ? Math.round(pts / max * 100) : null, checks: C, avail: C.filter(function (c) { return c.max; }).length };
  }
  function quickCard(q, m) {
    var Q = quickScore(m);
    var pass = Q.checks.filter(function (c) { return c.ok === true; }).length;
    var h = '<div class="rk-card sc-quick"><div class="rk-card-top"><div class="rk-tk">' + esc(q) + '<small>' + esc(m.name || '') + ' · ' + (m.cls === 'crypto' ? 'crypto' : 'stock') + ' · ' + px(m.px) + '</small></div>' +
      '<span class="rk-chip">Chart trend check</span><div><span class="rk-sub">Not a Conviction score</span></div></div>';
    h += '<p class="sc-warn"><b>Not on the board — no Conviction score yet.</b> This is a live chart snapshot only (' + pass + ' of ' + Q.avail + ' checks passing). Business, market size, crowd/catalyst and risk/reward are <b>not scored</b>, and Money Line and Gemini are not read here. This is not a buy signal' + (Q.avail < 5 ? '; only ' + Q.avail + ' of 5 chart checks had enough data' : '') + '.</p>';
    h += '<ul class="sc-checks">' + Q.checks.map(function (c) { return '<li class="' + (c.ok == null ? 'na' : c.ok ? 'ok' : 'no') + '"><span class="sc-mark">' + (c.ok == null ? '–' : c.ok ? '✓' : '✗') + '</span><span>' + esc(c.label) + '<small>' + esc(c.detail) + '</small></span><span class="sc-pts">' + (c.max ? c.pts + '/' + c.max : 'n/a') + '</span></li>'; }).join('') + '</ul>';
    h += '<p class="rk-sub">For a Conviction score, ask Conviction to score it, or add it to the watchlist so the weekly rescore picks it up. Source: ' + esc(m.src) + '.</p></div>';
    return h;
  }

  /* ---------- renderers ---------- */
  var SCORE_TIERS = [[75, 'g', '75+ full size'], [60, 'a', '60–74 three-quarter size'], [50, 'n', '50–59 half-size starter'], [0, 'r', 'under 50 no new money']];
  function scoreCls(v) { for (var i = 0; i < SCORE_TIERS.length; i++) if (v >= SCORE_TIERS[i][0]) return SCORE_TIERS[i][1]; return 'r'; }
  function rrOf(n) {
    var l = n.ladder || {}; if (l.stop == null || l.t1 == null) return null;
    var ref = l.entry ? (l.entry[0] + l.entry[1]) / 2 : n.px, t = l.t2 != null ? (l.t1 + l.t2) / 2 : l.t1;
    return ref > l.stop ? (t - ref) / (ref - l.stop) : null;
  }
  function zone(z) { return px(z[0]) + '–' + px(z[1]).replace('$', ''); }
  function ladderLine(n) {
    var l = n.ladder || {}, p = [];
    if (/^Fail/.test(n.legit || '')) return 'Fails legitimacy · no entry';
    if (l.exit && !l.stop) return 'Exit into ' + zone(l.exit);
    if (l.entry) p.push((l.entryLabel === 'Entry zone' ? 'Entry ' : l.entryLabel + ' ') + zone(l.entry));
    else if (l.exit) p.push('Trim into ' + zone(l.exit)); else p.push(l.entryLabel || 'Held');
    if (l.stop != null) p.push('Stop ' + px(l.stop));
    if (l.t1 != null) p.push('T1 ' + px(l.t1));
    if (l.t2 != null) p.push('T2 ' + px(l.t2));
    var r = rrOf(n); if (r != null) p.push('R/R ' + r.toFixed(1));
    return p.join(' · ');
  }
  function renderGuide() {
    return '<div class="card"><div class="card-head"><div><p class="sub">How to use this</p><h3>Read the moves, check the levels, act only on a Buy</h3></div></div>' +
      '<ol class="rk-guide"><li>Start with <b>Do next</b>: the top moves, in order.</li><li>Check each name\'s <b>level line</b>: where we buy, where we\'re wrong (stop) and where we take profit (T1, T2).</li>' +
      '<li>Only buy when the chip says <b>Buy</b>. That means every gate is open. A high score alone is not a buy.</li><li>Stops act on <b>closing prices</b> only, never intraday. Nothing here places a trade; you sign and place every order.</li></ol>' +
      '<div class="rk-legend"><span>' + chip('Buy') + ' all gates open: buy at the entry zone</span><span>' + chip('Hold/Ride') + ' keep it; the trend is intact or it\'s held by decision</span>' +
      '<span>' + chip('Watch') + ' wanted, waiting for its gate</span><span>' + chip('Trim') + ' sell part into strength</span><span>' + chip('Cut') + ' exit on the rules</span></div>' +
      '<div class="rk-legend">' + SCORE_TIERS.map(function (t) { return '<span><i class="rk-dot ' + t[1] + '"></i>Score ' + t[2] + '</span>'; }).join('') + '</div></div>';
  }
  function renderDo(R, A, acts) {
    var cashRow = A.rows[0];
    var h = '<div class="card"><div class="card-head"><div><p class="sub">Do next</p><h3>Top moves to close the gaps</h3></div></div><p class="rk-explain">The three moves that best close the gaps between what we hold and the plan, ranked by score.</p><ul class="rk-do">';
    acts.slice(0, 3).forEach(function (a, i) { h += '<li><span class="rk-num">' + (i + 1) + '</span><div>' + esc(a.t) + '<small>' + esc(a.d) + '</small></div></li>'; });
    h += '</ul>';
    if (acts.length > 3) h += '<details class="rk-more"><summary>More moves (' + (acts.length - 3) + ')</summary><ul class="rk-do" style="margin-top:8px">' + acts.slice(3).map(function (a, i) { return '<li><span class="rk-num">' + (i + 4) + '</span><div>' + esc(a.t) + '<small>' + esc(a.d) + '</small></div></li>'; }).join('') + '</ul></details>';
    h += '<p class="rk-sub" style="margin-top:10px">Market regime (the overall market mood that sets how big new buys can be): crypto ' + esc(R.regime.crypto.state) + ', stocks ' + esc(R.regime.stock.state) + '. Cash is ' + cashRow.pct.toFixed(1) + '% of the managed book (target 8%, band 5–15%).</p></div>';
    return h;
  }
  function renderAlloc(R, A) {
    var h = '<div class="card"><div class="card-head"><div><p class="sub">Allocation · live book.json</p><h3>Barbell: current vs target</h3></div><span class="rk-sub">Managed book ' + usd(A.managed) + ' (book ' + usd(A.total) + ' less owner block)</span></div><p class="rk-explain">Each bar is how much of the managed book sits in that sleeve; the thin line is the target. Owner names are kept out so they don\'t use seat money.</p><div class="rk-bars">';
    var scale = 60;
    A.rows.forEach(function (r) {
      var w = Math.min(100, r.pct / scale * 100), tg = r.target / scale * 100;
      var band = r.band ? '<span class="rk-band" style="left:' + (r.band[0] / scale * 100) + '%;width:' + ((r.band[1] - r.band[0]) / scale * 100) + '%"></span>' : '';
      h += '<div><div class="rk-bar-head"><span><b>' + r.id + '</b> ' + r.pct.toFixed(1) + '% <span class="rk-gap">vs ' + r.target + '%</span></span><span class="rk-gap">' + (r.gapUsd >= 0 ? '+' : '−') + Math.abs(r.gapPct).toFixed(1) + ' pts · ' + (r.gapUsd >= 0 ? 'over ' : 'under ') + usd(Math.abs(r.gapUsd)) + '</span></div>' +
        '<div class="rk-track">' + band + '<span class="rk-fill" style="width:' + w + '%"></span><span class="rk-tgt" style="left:' + tg + '%"></span></div></div>';
    });
    h += '</div><div class="rk-flags">';
    h += '<span class="rk-flag">Owner block (not in seats): ' + usd(A.agg.Owner) + '</span>';
    h += '<span class="rk-flag">Unseated to clear: ' + usd(A.agg.Unseated) + '</span>';
    var hl = A.cb.hyperliquid_perps_margin || 0; if (hl) h += '<span class="rk-flag">Idle Hyperliquid USDC: ' + usd(hl) + '</span>';
    var debt = (A.cb.etrade < 0 ? A.cb.etrade : 0) + (A.cb.robinhood < 0 ? A.cb.robinhood : 0); if (debt < 0) h += '<span class="rk-flag">Margin debit: ' + usd(debt) + '</span>';
    Object.keys(R.themes || {}).forEach(function (k) {
      var th = R.themes[k], v = 0; th.match.forEach(function (s) { v += A.bySym[s] || 0; });
      h += '<span class="rk-flag">' + esc(k) + ' theme: ' + usd(v) + ' · ' + (v / A.total * 100).toFixed(1) + '% of book' + (th.target ? ' (plan ' + th.target + '%)' : '') + '</span>';
    });
    h += '</div>';
    // details
    h += '<details class="rk-more"><summary>Sleeve detail, owner block and themes</summary><div class="rk-vcfull">';
    ['Survival', 'Torque', 'Lottery', 'Owner', 'Unseated'].forEach(function (s) {
      var L = (A.lines[s] || []).slice().sort(function (a, b) { return b.mv - a.mv; });
      h += '<p><b>' + s + '</b> ' + usd(A.agg[s]) + '</p><div class="rk-pos">' + (L.length ? L.slice(0, 14).map(function (x) { return esc(x.sym) + ' ' + usd(x.mv); }).join(' · ') + (L.length > 14 ? ' · +' + (L.length - 14) + ' more' : '') : 'Nothing held') + '</div>';
    });
    var cb = A.cb; h += '<p><b>Cash</b> ' + usd(A.cash) + ' net</p><div class="rk-pos">' + Object.keys(cb).map(function (k) { return esc(k.replace(/_/g, ' ')) + ' ' + usd(cb[k]); }).join(' · ') + '</div>';
    Object.keys(R.themes || {}).forEach(function (k) {
      var th = R.themes[k], parts = {}; Object.keys(A.lines).forEach(function (s) { A.lines[s].forEach(function (x) { if (th.match.indexOf(baseSym(x.sym)) >= 0) parts[s] = (parts[s] || 0) + x.mv; }); });
      h += '<p><b>' + esc(k) + ' theme by sleeve</b></p><div class="rk-pos">' + Object.keys(parts).map(function (s) { return s + ' ' + usd(parts[s]); }).join(' · ') + '. ' + esc(th.peers) + ' ' + esc(th.note) + '</div>';
    });
    if (Math.abs(A.resid) > 1) h += '<div class="rk-pos">Unreconciled vs book total: ' + usd(A.resid) + '.</div>';
    h += '</div></details></div>';
    return h;
  }
  function pill(v) { return '<span class="rk-pill"><i style="width:' + (v / 5 * 100) + '%"></i></span>'; }
  function dist(a, b) { return (b / a - 1) * 100; }
  function kv(k, v) { return '<div class="rk-kv"><span>' + k + '</span><span>' + v + '</span></div>'; }
  function ladderTable(n) {
    var l = n.ladder || {}, w = l.why || {}, rows = [];
    var d = function (v) { return v == null ? '' : '<span class="rk-gap"> ' + pct(dist(n.px, v)) + '</span>'; };
    if (l.entry) rows.push([l.entryLabel, zone(l.entry) + d((l.entry[0] + l.entry[1]) / 2), w.entry]);
    else if (l.exit) rows.push([l.entryLabel, zone(l.exit) + d((l.exit[0] + l.exit[1]) / 2), w.entry]);
    else rows.push([l.entryLabel || 'Held', 'Now ' + px(n.px), w.entry]);
    if (l.stop != null) rows.push(['Stop (on a close)', px(l.stop) + d(l.stop), w.stop]);
    if (l.t1 != null) rows.push(['T1', px(l.t1) + d(l.t1), w.t1]);
    if (l.t2 != null) rows.push(['T2', px(l.t2) + d(l.t2), w.t2]);
    if (l.stretch != null) rows.push(['Stretch', px(l.stretch) + d(l.stretch), w.st]);
    var r = rrOf(n);
    return '<table class="rk-ladder"><tbody>' + rows.map(function (x) { return '<tr><td>' + esc(x[0]) + '</td><td class="mono">' + x[1] + '</td><td class="rk-why">' + esc(x[2] || '') + '</td></tr>'; }).join('') + '</tbody></table>' +
      (r != null ? '<p class="rk-sub">R/R ' + r.toFixed(1) + ': the reward from the middle of the entry zone to the average of T1 and T2, divided by the risk down to the stop.' + (l.entry ? '' : ' Measured from today\'s price.') + '</p>' : '');
  }
  function profileHref(t) { return 'charts.html?t=' + encodeURIComponent(t); }
  function vcText(n) {
    if (!n || !n.vc) return '<span class="muted">No elite-VC write-up yet</span>';
    return '<b>VC: ' + esc(n.vc.verdict) + '</b>, ' + esc(n.vc.line || '');
  }
  function openProfile(n) { return '<a class="rk-open" href="' + profileHref(n.tk) + '">Open ' + esc(n.tk) + ' profile →</a>'; }
  function detail(n, R, A) {
    var p = n.pillars, t = n.tech, s = sizeFor(n, R, A);
    var ml = function (x) { if (!x || x[0] === 'n/a') return 'not read'; var st = x[0] === 'bull*' ? 'Up (at risk)' : x[0] === 'bull' ? 'Up' : 'Down'; return st + ' · flips at ' + px(x[1]) + ' (' + pct(dist(n.px, x[1])) + ')'; };
    var h = '<div class="rk-detail">' + '<p class="rk-profile-link">' + openProfile(n) + '</p>';
    h += '<div class="rk-note">' + esc(n.note || n.why) + (n.note ? '<br><span class="rk-sub">' + esc(n.why) + '</span>' : '') + (n.legit ? '<br><span class="rk-sub">Legitimacy gate: ' + esc(n.legit) + '</span>' : '') + '</div>';
    h += trendBlock(n.tk);
    h += '<div style="grid-column:1/-1"><h4>Levels: why each one</h4>' + ladderTable(n) + '</div>';
    h += '<div><h4>Score pillars (1–5)</h4>' +
      kv('Business strength · ' + R.weights.business + '%', p.business + pill(p.business)) + kv('Market size & runway · ' + R.weights.tam + '%', p.tam + pill(p.tam)) +
      kv('Crowd cycle (early beats crowded) · ' + R.weights.crowd + '%', p.crowd + pill(p.crowd)) + kv('Chart (technicals) · ' + R.weights.tech + '%', p.tech.toFixed(1) + pill(p.tech)) + kv('Fits today\'s market · ' + R.weights.regime + '%', p.regime + pill(p.regime)) + '</div>';
    h += '<div><h4>Chart signals · ' + esc(t.src) + '</h4>' + kv('Gemini daily (buy/sell signal)', esc(t.gD)) + kv('Gemini weekly', esc(t.gW)) + (t.gWhist ? kv('Last weekly Buy / Max Buy (26 wks)', esc(t.gWhist)) : '') + kv('Money Line daily (trend)', ml(t.mlD)) + kv('Money Line weekly', ml(t.mlW)) +
      kv('RSI18 vs its signal line', t.rsi == null ? 'not read' : t.rsi.toFixed(1) + ' vs ' + t.sig.toFixed(1) + (t.rsi > t.sig ? ' (momentum turning up)' : ' (momentum still down)')) + '</div>';
    h += '<div><h4>Size</h4>' + kv('Price', px(n.px)) + (n.gate ? kv('Buy gate', esc(n.gate)) : '') +
      (s ? kv('Size from score', Math.round(s.tier * 100) + '% of a ' + s.seatPct.toFixed(1) + '% seat = ' + usd(s.target)) + kv('After market regime', usd(s.now) + ' · held ' + usd(s.held)) : kv('Size from score', 'Not a barbell seat')) +
      kv('Market cap · daily volume', esc(n.mcap) + ' · ' + esc(n.vol)) + '</div>';
    h += '<div style="grid-column:1/-1"><h4>Elite VC lens · Conviction view</h4>' + (n.vc ? ('<div><b>' + esc(n.vc.verdict) + '</b>: ' + esc(n.vc.line || '') + '</div>') : '<div class="muted">No elite-VC write-up yet.</div>');
    if (n.vc && n.vc.full) { h += '<details class="rk-more"><summary>Full VC analysis</summary><div class="rk-vcfull">' + n.vc.full.map(function (x) { return '<p><b>' + esc(x[0]) + '.</b> ' + esc(x[1]) + '</p>'; }).join('') + '</div></details>'; }
    h += '</div></div>';
    return h;
  }
  function heldTag(n) { return n.held === 'Held' ? 'held' : n.held === 'Wanted' ? 'wanted' : n.held; }
  function rowHtml(n, R, A) {
    return '<details class="rk-row"><summary><span class="rk-tk">' + esc(n.tk) + '<small>' + esc(n.name) + ' · ' + esc(heldTag(n)) + '</small></span>' + chip(n.action) +
      '<span class="rk-score"><span><i class="rk-dot ' + scoreCls(n.score) + '"></i>' + n.score + '</span><span class="sc-mini">' + spark(n.tk) + deltaHtml(n.tk, true) + '</span></span><span class="rk-lad">' + esc(ladderLine(n)) + '</span><span class="rk-caret">›</span>' +
      '<span class="rk-vc">' + vcText(n) + '</span></summary>' + detail(n, R, A) + '</details>';
  }
  function renderBoard(R, A) {
    return '<div class="card"><div class="card-head"><div><p class="sub">Ranked board · ' + R.board.length + ' names</p><h3>What to do with each name</h3></div></div>' +
      '<p class="rk-explain">Every name we hold or want, best score first, with its action and its level line. Tap a row for the reasons behind each level.</p>' +
      '<div class="rk-tools"><div class="rk-seg" id="rk-filter"><button class="on" data-f="all">All</button><button data-f="held">Held</button><button data-f="wanted">Wanted</button><button data-f="ai">Decentralized AI</button></div>' +
      '<div class="rk-seg" id="rk-sort"><button class="on" data-s="score">Score</button><button data-s="action">Action</button></div></div>' +
      '<div class="rk-head"><span>Name</span><span>Action</span><span>Score</span><span class="h-lad">Levels</span><span></span></div><div id="rk-rows"></div>' +
      '<p class="rk-sub" style="margin-top:10px">' + esc(R.prices_note) + '</p></div>';
  }
  function fillRows(R, A, f, s) {
    var order = { 'Buy': 0, 'Cut': 1, 'Trim': 2, 'Hold/Ride': 3, 'Watch': 4 };
    var L = R.board.filter(function (n) { return f === 'all' || (f === 'ai' ? (n.themes || []).indexOf('Decentralized AI') >= 0 : f === 'held' ? n.held === 'Held' : n.held !== 'Held'); })
      .sort(function (a, b) { return s === 'action' ? (order[a.action] - order[b.action]) || (b.score - a.score) : b.score - a.score; });
    document.getElementById('rk-rows').innerHTML = L.map(function (n) { return rowHtml(n, R, A); }).join('');
  }
  function renderEngine() {
    return '<div class="card"><div class="card-head"><div><p class="sub">Ranking engine · v3</p><h3>Score any ticker</h3></div></div>' +
      '<p class="rk-explain">Type any stock or crypto ticker. Names on the board show their Conviction score, pillars and score history. Anything else gets a clearly labeled chart trend check from live prices — not a Conviction score.</p>' +
      '<div class="rk-engine"><input id="rk-q" placeholder="Ticker, e.g. VVV" autocomplete="off"/><button class="btn btn-teal" id="rk-go" style="height:38px;padding:0 16px;font-size:12px">Score</button></div><div id="rk-out"></div></div>';
  }
  function runEngine(R, A, q) {
    q = String(q || '').trim().toUpperCase(); var out = document.getElementById('rk-out'); if (!q) { out.innerHTML = ''; return; }
    var n = R.board.filter(function (x) { return x.tk === q || x.tk.split('+').indexOf(q) >= 0 || (q === 'LIUM' || q === 'TARGON') && x.tk === 'SN51+SN4'; })[0];
    if (n) {
      var p = n.pillars || {};
      var pillars = 'Business ' + (p.business != null ? p.business : 'n/a') +
        ' · Market ' + (p.tam != null ? p.tam : 'n/a') +
        ' · Crowd ' + (p.crowd != null ? p.crowd : 'n/a') +
        ' · Chart ' + (p.tech != null ? (+p.tech).toFixed(2).replace(/\.00$/, '') : 'n/a') +
        ' · Fit ' + (p.regime != null ? p.regime : 'n/a');
      out.innerHTML = '<div class="rk-card"><div class="rk-card-top"><div class="rk-tk">' + esc(n.tk) + '<small>' + esc(n.name) + ' · ' + esc(n.seat) + '</small></div>' + chip(n.action) +
        '<div><div class="big"><i class="rk-dot ' + scoreCls(n.score) + '"></i>' + n.score + '</div><span class="rk-sub">Conviction score</span></div><div class="sc-mini lg">' + spark(n.tk) + deltaHtml(n.tk) + '</div></div>' +
        '<p class="rk-pillars">Pillars (1–5): ' + pillars + '</p>' +
        '<p class="rk-lad" style="margin:12px 0 0">' + esc(ladderLine(n)) + '</p><p style="margin:8px 0 0">' + vcText(n) + '</p><p style="margin:8px 0 0">' + openProfile(n) + '</p><details class="rk-more"><summary>Full breakdown</summary>' + detail(n, R, A) + '</details></div>';
      return;
    }
    q = q.replace(/[^A-Z0-9.\-]/g, '').slice(0, 15); if (!q) { out.innerHTML = ''; return; }
    var oos = new RegExp('\\b' + q.replace(/[^A-Z0-9]/g, '') + '\\b').test(R.out_of_scope.toUpperCase());
    var note = oos ? '<p class="sc-warn"><b>' + esc(q) + ' is out of scope for the barbell</b> (fails eligibility or legitimacy). Memes and micro-caps run on their own simple stop rules.</p>' : '';
    var token = (runEngine.tok = (runEngine.tok || 0) + 1);
    out.innerHTML = '<div class="rk-card"><span class="rk-sub">Not on the board. Pulling live prices for ' + esc(q) + '…</span></div>';
    var sp = stockData(q);
    Promise.all([sp, cryptoData(q, sp)]).then(function (r) {
      if (token !== runEngine.tok) return;
      if (r[1] && /^Coinbase/.test(r[1].src)) r = [r[1], r[0]];
      var cards = r.filter(Boolean).map(function (m) { return quickCard(q, m); });
      if (cards.length > 1) cards.unshift('<p class="rk-sub" style="margin:12px 0 0">' + esc(q) + ' matches both a stock and a crypto. Both are shown; use the one you meant.</p>');
      out.innerHTML = note + (cards.length ? cards.join('') : '<div class="rk-card"><b>' + esc(q) + ': not scored yet.</b><p class="rk-sub">No live prices found for it as a US stock (TradingView screener) or as a crypto (Coinbase, CoinGecko). Ask Conviction to score it, or add it to the watchlist so the weekly rescore picks it up.</p></div>');
    });
  }
  function fold(title, body, open) { return '<details class="rk-fold"' + (open ? ' open' : '') + '><summary>' + title + '</summary><div>' + body + '</div></details>'; }
  function table(cols, rows) { return '<table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; }
  function renderFolds(R) {
    var w = R.weights, E = R.evidence, h = '<p class="rk-explain" style="margin:8px 0 10px">Deeper detail. Open a section only if you need it.</p>';
    h += fold('Plain-English glossary', '<ul><li><b>Money Line</b>: the trend line from the Bullmania/Opulence chart. Price above it means the trend is up; a close through it is a "flip".</li><li><b>Gemini</b>: the buy and sell signal on the same chart (Buy, Max Buy, Trim, Top Exit).</li>' +
      '<li><b>Gate</b>: the checklist before any buy. Stocks (v3, tested on real prints): a weekly Gemini Max Buy or Buy, confirmed at the weekly close, then the weekly Money Line turning up, with price inside the entry zone. Crypto: Money Line up on daily and weekly, a fresh Gemini Buy, and price inside the entry zone.</li><li><b>Stop (on a close)</b>: the price where we\'re wrong. It counts only on a daily or weekly closing price, never an intraday wick.</li>' +
      '<li><b>T1 / T2</b>: first and second profit targets, each at a real past high, low or Money Line flip.</li><li><b>R/R</b>: reward divided by risk. 3.0 means we stand to make three dollars for every dollar we could lose.</li>' +
      '<li><b>Regime</b>: the overall market mood (risk-on, neutral, risk-off). It scales how big new buys can be.</li><li><b>RSI18</b>: a momentum gauge. Crossing above its signal line means momentum is turning up.</li></ul>');
    h += fold('Regime read', '<p><b>Crypto: ' + esc(R.regime.crypto.state) + '.</b> ' + esc(R.regime.crypto.detail) + ' ' + esc(R.regime.crypto.size) + '</p><p><b>Stocks: ' + esc(R.regime.stock.state) + '.</b> ' + esc(R.regime.stock.detail) + ' ' + esc(R.regime.stock.size) + '</p>');
    h += fold('How the score works', '<ul><li>Five parts, each scored 1–5: business strength ' + w.business + '%, market size & runway ' + w.tam + '%, crowd cycle ' + w.crowd + '%, chart ' + w.tech + '%, fit with today\'s market ' + w.regime + '%. Shown out of 100.</li>' +
      '<li>The chart part is computed from the Money Line, Gemini, RSI18 and price vs the weekly flip. v3: for stocks, a weekly Max Buy in the last 26 weeks adds 1 point and a weekly Buy in the last 13 weeks adds half a point (capped at 5). The other parts are judgment calls.</li>' +
      '<li>Size follows the score: 75+ gets a full seat, 60–74 three-quarters, 50–59 a half starter, under 50 no new money. Then the regime scales it: crypto risk-off 0%, stocks neutral 75%.</li>' +
      '<li>Seats: Survival 35% (BTC, SOL, TSLA, NVDA). Torque 45% (TAO 12%, VVV 7%, SPCX, SKHY and ALAB about 8.7% each). Lottery 12% (BNKR 7%, subnet basket 3%, RENDER 2%). Owner names sit outside the seats.</li>' +
      '<li>Eligibility. Crypto: ' + esc(R.eligibility.crypto) + ' Stocks: ' + esc(R.eligibility.stock) + '</li><li>AI exception: ' + esc(R.eligibility.ai) + '</li></ul>');
    h += fold('Loser and winner rules', '<p><b>Staying away from losers</b></p><ul><li>A close under the stop flags Cut, whatever the score. A manager override is allowed and logged.</li><li>A weekly trend flip down on a held name means Trim, or Cut if the score is under 50.</li><li>A broken story, heavy dilution or drying-up liquidity means Cut or Watch.</li><li>Crypto: new money only while BTC\'s weekly trend is up. That rule is tested.</li></ul>' +
      '<p><b>Catching winners and letting them run</b></p><ul><li>Stocks: the primary trigger is a weekly Gemini Max Buy (then wait for the weekly Money Line to turn up); a weekly Buy is the second tier. Crypto: an ignored name plus its first daily trend flip inside a weekly uptrend, or a Buy in the entry zone.</li><li>At a gain equal to the risk, the stop moves to breakeven.</li><li>Crypto: two-thirds of the position exits on a daily flip and one-third rides the weekly. Stocks: one-third daily, two-thirds ride.</li><li>No trims while the weekly trend holds. Add on confirmed strength, and trim at T2 or on a weekly break.</li></ul>');
    if (E.gemini) { var G = E.gemini; h += fold('Evidence: real Gemini signals (v3)', '<p>' + esc(G.source) + '</p><p>' + esc(G.real) + '</p><p><b>Stocks (26 names)</b></p>' + table(G.cols, G.stock) + '<p><b>Crypto (13 names)</b></p>' + table(G.cols, G.crypto) +
      '<p><b>Daily signals (18 names)</b></p>' + table(['Signal (daily)', 'Trades', 'Win rate', 'Avg win / loss', 'Basket worst drop'], G.daily) + '<ul>' + G.findings.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p><b>Caveats</b></p><ul>' + G.caveats.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'); }
    h += fold('Evidence: 5-year backtest (stand-in signals)', '<p>' + esc(E.window) + '</p><p><b>Crypto basket</b></p>' + table(['Rules', 'Total', 'Worst drop', 'Win rate', 'Avg win / loss'], E.rows.crypto) +
      '<p><b>Stock basket</b></p>' + table(['Rules', 'Total', 'Worst drop', 'Win rate', 'Avg win / loss'], E.rows.stock) +
      '<p><b>By market type (average quarter)</b></p>' + table(['Crypto', 'Buy and hold', 'Rules'], E.markets.crypto) + table(['Stocks', 'Buy and hold', 'Rules'], E.markets.stock) +
      '<ul>' + E.findings.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p><b>Stand-ins used</b> ' + esc(E.proxy) + '</p><p><b>Untested or rejected</b></p><ul>' + E.untested.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>');
    h += fold('Engine spec (for go-live)', '<ul><li>Prices: Coinbase and Kraken candles for crypto, Yahoo for stocks, CoinGecko for market cap, FDV and volume. Automated.</li>' +
      '<li>Money Line and Gemini: read from the TradingView Opulence chart at the existing desks. Semi-automated; unreadable labels stay "unreadable" and are never guessed.</li>' +
      '<li>Levels (past weekly highs and lows, Money Line flips), RSI18, R/R and size: computed. Each level keeps a written reason.</li>' +
      '<li>Business, market size, crowd cycle, the legitimacy gate and the VC lens: manual, dated, refreshed weekly or on news.</li>' +
      '<li>The 3-hour book refresh rebuilds ranking.json after the desk reads. The journal adds a line on every score or action change.</li></ul>');
    h += fold('Out of scope', '<p>' + esc(R.out_of_scope) + '</p>');
    h += fold('Journal', '<ul>' + R.journal.slice().reverse().map(function (j) { return '<li><b>' + esc(j.date) + '</b> ' + esc(j.entry) + '</li>'; }).join('') + '</ul>');
    return h;
  }

  /* ---------- boot ---------- */
  var bust = '?t=' + Date.now();
  Promise.all([fetch('book.json' + bust).then(function (r) { return r.json(); }), fetch('ranking.json' + bust).then(function (r) { return r.json(); }),
    fetch('score-history.json' + bust).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })]).then(function (res) {
    var book = res[0], R = res[1]; HIST = res[2] || {}; var A = allocation(book), acts = nextActions(R, A);
    document.getElementById('rk-asof').textContent = 'Book ' + (book.as_of_et || '') + ' · scores ' + R.as_of + (function () { var d = null; Object.keys(HIST).forEach(function (k) { var L = HIST[k]; if (L.length && (!d || L[L.length - 1].date > d)) d = L[L.length - 1].date; }); return d ? ' · history ' + dShort(d) : ''; })();
    document.querySelectorAll('[data-asof]').forEach(function (e) { e.textContent = book.as_of_et || ''; });
    root.innerHTML = renderGuide() + renderDo(R, A, acts) + renderAlloc(R, A) + renderEngine() + renderBoard(R, A) + renderFolds(R);
    var f = 'all', s = 'score'; fillRows(R, A, f, s);
    root.querySelectorAll('#rk-filter button').forEach(function (b) { b.onclick = function () { root.querySelectorAll('#rk-filter button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); f = b.dataset.f; fillRows(R, A, f, s); }; });
    root.querySelectorAll('#rk-sort button').forEach(function (b) { b.onclick = function () { root.querySelectorAll('#rk-sort button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); s = b.dataset.s; fillRows(R, A, f, s); }; });
    var q = document.getElementById('rk-q'); document.getElementById('rk-go').onclick = function () { runEngine(R, A, q.value); };
    q.onkeydown = function (e) { if (e.key === 'Enter') runEngine(R, A, q.value); };
    var pre = (location.hash.match(/t=([A-Za-z0-9]+)/) || [])[1]; if (pre) { q.value = pre; runEngine(R, A, pre); }
  }).catch(function (e) { root.innerHTML = '<div class="card">Could not load data: ' + esc(e.message) + '</div>'; });
})();
