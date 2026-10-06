/* BG Portfolio Cockpit — all-time per-wallet / per-venue P&L view (pnl.html). */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function usd(n, signed) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    const s = Math.abs(v).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2 });
    return (v < 0 ? "−" : signed && v > 0 ? "+" : "") + s;
  }
  function pl(n) {
    if (n == null || isNaN(n)) return '<span class="text-muted">—</span>';
    const cls = Number(n) > 0.004 ? "text-gain" : Number(n) < -0.004 ? "text-loss" : "";
    return '<span class="tabular ' + cls + '">' + usd(n, true) + "</span>";
  }
  function when(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + " ET";
    } catch (e) { return iso; }
  }
  function day(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", year: "numeric" }); } catch (e) { return String(iso).slice(0, 10); }
  }
  const flagColor = { missing_basis: "#e0a84f", fifo_disagree: "#e07a5f", explorer_mismatch: "#8fb3ff", explorer_gap: "#8a99a6",
    venue_gap: "#8a99a6", venue_stale: "#e07a5f", untrackable: "#8a99a6", qty_mismatch: "#e0a84f", basis_disagree: "#e0a84f",
    asset_coverage: "#8fb3ff", venue_disagree: "#e07a5f", chain_no_pnl: "#8a99a6", error: "#e07a5f" };
  function flagList(flags) {
    if (!flags || !flags.length) return '<p class="text-muted" style="margin:6px 0">No flags.</p>';
    return '<ul style="margin:6px 0 0;padding-left:18px;font-size:12.5px;line-height:1.45">' + flags.map((f) =>
      '<li><span style="color:' + (flagColor[f.kind] || "#8a99a6") + ';font-weight:600">' + esc((f.kind || "").replace(/_/g, " ")) + "</span> — " + esc(f.msg) + "</li>").join("") + "</ul>";
  }
  function table(head, rows, opts) {
    return '<div class="table-wrap"' + (opts && opts.max ? ' style="max-height:' + opts.max + 'px;overflow:auto"' : "") + '><table class="data"><thead><tr>' +
      head.map((h) => '<th class="' + (h[1] || "") + '">' + esc(h[0]) + "</th>").join("") + "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>";
  }
  const td = (v, cls) => '<td class="' + (cls || "") + '">' + v + "</td>";

  function summaryCard(b) {
    const a = b.alltime_pnl;
    if (!a || !a.rows) return "";
    const rows = a.rows.map((r) => "<tr>" + td(esc(r.name) + (r.status && r.status !== "ok" ? ' <span class="text-muted" style="font-size:11px">(' + esc(r.status) + ")</span>" : "")) +
      td(pl(r.realized), "right") + td(pl(r.unrealized), "right") + td(r.income ? pl(r.income) : '<span class="text-muted">—</span>', "right") +
      td("<strong>" + pl(r.total) + "</strong>", "right") + td(usd(r.value), "right") +
      td('<span class="text-muted" style="font-size:12px">' + esc(r.source) + (r.alt_realized != null ? "<br>our FIFO " + usd(r.alt_realized, true) + " / " + usd(r.alt_unrealized, true) : "") + "</span>") +
      td(day(r.since)) + td(r.flags ? '<a class="link-teal" href="#pl-' + esc(r.id) + '">' + r.flags + "</a>" : "0", "right") + "</tr>");
    const t = a.totals || {};
    rows.push('<tr style="font-weight:700;border-top:2px solid rgba(255,255,255,.15)">' + td("All accounts") + td(pl(t.realized), "right") + td(pl(t.unrealized), "right") +
      td(pl(t.income), "right") + td(pl(t.total), "right") + td("") + td("") + td("") + td("") + "</tr>");
    const q = (b.wallet_pnl || {}).zerion_quota || {};
    const quota = q.exhausted ? '<div class="banner" style="margin:8px 0;font-size:12.5px">Zerion API key is demo tier (300 calls/day) and today\'s budget is spent — wallet totals shown are the last good Zerion pull (' +
      esc(when(((b.wallet_pnl || {}).wallets || []).map((w) => (w.zerion || {}).as_of).filter(Boolean).sort().pop())) + "); per-chain / per-asset Zerion detail fills in on the first refresh after the reset" + (q.reset_in_h ? " (~" + q.reset_in_h + "h)" : "") + ". Our own FIFO numbers are live every refresh.</div>" : "";
    return '<div class="card" style="margin-bottom:14px"><div class="card-head"><h2 style="margin:0;font-size:16px">All-time P&amp;L by account</h2><span class="sub">realized + unrealized since first transaction · ' + esc(when(a.as_of)) + "</span></div>" + quota +
      table([["Account"], ["Realized", "right"], ["Unrealized", "right"], ["Income", "right"], ["Total", "right"], ["Value", "right"], ["Source"], ["Since"], ["Flags", "right"]], rows) +
      '<p class="text-muted" style="font-size:12px;margin:8px 2px 0">' + esc(a.note || "") + "</p></div>";
  }

  function walletBlock(w) {
    const z = w.zerion || {}, f = w.fifo || {}, h = w.history || {};
    const head = '<summary style="cursor:pointer;padding:10px 4px;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:baseline">' +
      "<strong>" + esc(w.label) + "</strong>" +
      '<span class="text-muted mono" style="font-size:11px">' + esc((w.address || "").slice(0, 6) + "…" + (w.address || "").slice(-4)) + "</span>" +
      "<span>value " + usd(w.value) + "</span>" +
      (w.zerion ? "<span>Zerion R " + pl(z.realized_gain) + " · U " + pl(z.unrealized_gain) + "</span>" : "") +
      (w.fifo && w.fifo.realized_gain != null ? '<span class="text-muted" style="font-size:12px">our FIFO R ' + usd(f.realized_gain, true) + " · U " + usd(f.unrealized_gain, true) + "</span>" : "") +
      '<span class="text-muted" style="font-size:12px">' + (h.count || 0).toLocaleString() + " txs since " + esc(day(h.first_ts)) + (h.trash ? " (" + h.trash.toLocaleString() + " spam)" : "") + "</span>" +
      ((w.flags || []).length ? '<span style="color:#e0a84f;font-size:12px">' + w.flags.length + " flag" + (w.flags.length > 1 ? "s" : "") + "</span>" : "") + "</summary>";
    if (w.status === "untrackable" || (!w.assets || !w.assets.length) && !w.zerion) {
      return '<details id="pl-' + esc(w.id) + '" class="card card-tight" style="margin-bottom:8px">' + head + flagList(w.flags) + "</details>";
    }
    const zline = w.zerion ? '<p style="font-size:12.5px;margin:4px 0 10px">Zerion (as of ' + esc(when(z.as_of)) + "): realized " + pl(z.realized_gain) + ", unrealized " + pl(z.unrealized_gain) +
      ", net invested " + usd(z.net_invested) + ", total invested " + usd(z.total_invested) + ", received from other wallets " + usd(z.received_external) + ", sent " + usd(z.sent_external) + ", fees " + usd(z.total_fee) + ".</p>" : "";
    const chains = Object.entries(w.by_chain || {}).sort((a, b) => (b[1].value || 0) - (a[1].value || 0) || (b[1].txs || 0) - (a[1].txs || 0));
    const chainRows = chains.map(([c, r]) => "<tr>" + td(esc(c)) + td(usd(r.value), "right") + td(pl(r.realized_gain), "right") + td(pl(r.unrealized_gain), "right") +
      td(pl(r.fifo_realized), "right") + td(pl(r.fifo_unrealized), "right") + td(String(r.txs || 0) + (r.spam_txs ? ' <span class="text-muted">(' + r.spam_txs + " spam)</span>" : ""), "right") + td(usd(r.fees), "right") + "</tr>");
    const assetRows = (w.assets || []).map((a) => "<tr" + (a.disagree ? ' style="background:rgba(224,122,95,.08)"' : "") + ">" +
      td("<strong>" + esc(a.sym) + "</strong>" + (a.unpriced ? ' <span class="text-muted" style="font-size:11px">unpriced</span>' : "")) + td(esc(a.chain)) + td(usd(a.value), "right") +
      td(pl(a.z_realized), "right") + td(pl(a.z_unrealized), "right") + td(usd(a.z_net_invested), "right") +
      td(pl(a.f_realized), "right") + td(pl(a.f_unrealized), "right") + td(usd(a.f_basis), "right") +
      td(a.basis_status ? '<span style="font-size:11.5px;color:' + (a.basis_status === "missing" ? "#e0a84f" : "#8a99a6") + '">' + esc(a.basis_status.replace(/_/g, " ")) + "</span>" : "") + "</tr>");
    const ex = (w.explorer_check || {}).chains || {};
    const exRows = Object.entries(ex).map(([c, r]) => "<tr>" + td(esc(c)) + td(String(r.zerion == null ? "—" : r.zerion), "right") + td(r.explorer == null ? '<span class="text-muted">' + esc((r.note || "n/a").slice(0, 70)) + "</span>" : String(r.explorer), r.explorer == null ? "" : "right") +
      td(r.explorer_only == null ? "—" : String(r.explorer_only), "right") + td(r.zerion_only == null ? "—" : String(r.zerion_only), "right") + td('<span class="text-muted">' + esc(r.explorer_source || "") + "</span>") + "</tr>");
    const cmp = (w.sep19_fifo_compare || []).map((c) => "<tr>" + td(esc(c.asset)) + td(esc(c.new_source)) + td(usd(c.new_basis), "right") + td(pl(c.new_realized), "right") +
      td(usd(c.sep19_fifo_basis), "right") + td(pl(c.sep19_fifo_realized), "right") + td(c.agree ? "✓" : '<span style="color:#e07a5f">✗</span>', "right") + "</tr>");
    return '<details id="pl-' + esc(w.id) + '" class="card card-tight" style="margin-bottom:8px">' + head + '<div style="padding:0 4px 10px">' + zline +
      '<h3 style="font-size:13px;margin:10px 0 4px">By chain</h3>' +
      table([["Chain"], ["Value", "right"], ["Zerion realized", "right"], ["Zerion unreal.", "right"], ["FIFO realized", "right"], ["FIFO unreal.", "right"], ["Txs", "right"], ["Gas", "right"]], chainRows) +
      (w.by_chain_as_of ? "" : '<p class="text-muted" style="font-size:11.5px;margin:4px 2px">Zerion per-chain split pending (API budget) — FIFO columns are live.</p>') +
      '<h3 style="font-size:13px;margin:12px 0 4px">By asset <span class="text-muted" style="font-weight:400">(' + (w.assets || []).length + " of " + (w.assets_total || 0) + ")</span></h3>" +
      table([["Asset"], ["Chain"], ["Value", "right"], ["Z realized", "right"], ["Z unreal.", "right"], ["Z net inv.", "right"], ["FIFO realized", "right"], ["FIFO unreal.", "right"], ["FIFO basis", "right"], ["Basis"]], assetRows, { max: 420 }) +
      '<h3 style="font-size:13px;margin:12px 0 4px">Flags</h3>' + flagList(w.flags) +
      (exRows.length ? '<h3 style="font-size:13px;margin:12px 0 4px">Explorer cross-check (tx hashes)</h3>' + table([["Chain"], ["Zerion", "right"], ["Explorer", "right"], ["Explorer-only", "right"], ["Zerion-only", "right"], ["Source"]], exRows) : "") +
      (cmp.length ? '<h3 style="font-size:13px;margin:12px 0 4px">vs Sep-19 on-chain FIFO basis</h3>' + table([["Asset"], ["Now from"], ["Basis now", "right"], ["Realized now", "right"], ["Sep-19 basis", "right"], ["Sep-19 realized", "right"], ["Agree", "right"]], cmp) : "") +
      "</div></details>";
  }

  function venueBlock(v) {
    const t = v.totals || {};
    const head = '<summary style="cursor:pointer;padding:10px 4px;display:flex;flex-wrap:wrap;gap:10px 18px;align-items:baseline"><strong>' + esc(v.venue) + "</strong>" +
      (v.account ? '<span class="text-muted mono" style="font-size:11px">' + esc(v.account.slice(0, 6) + "…" + v.account.slice(-4)) + "</span>" : "") +
      "<span>R " + pl(t.realized_gain) + " · U " + pl(t.unrealized_gain) + "</span>" +
      (t.income ? "<span>income " + pl(t.income) + "</span>" : "") + (t.interest ? "<span>interest " + pl(t.interest) + "</span>" : "") +
      (t.funding != null ? '<span class="text-muted" style="font-size:12px">closed ' + usd(t.closed_pnl, true) + " · fees " + usd(-t.fees, true) + " · funding " + usd(t.funding, true) + "</span>" : "") +
      '<span class="text-muted" style="font-size:12px">since ' + esc(day((v.history || {}).first_ts)) + "</span>" +
      ((v.flags || []).length ? '<span style="color:#e0a84f;font-size:12px">' + v.flags.length + " flag" + (v.flags.length > 1 ? "s" : "") + "</span>" : "") + "</summary>";
    const rows = (v.assets || []).map((a) => "<tr>" + td("<strong>" + esc(a.sym) + "</strong>") + td(pl(a.realized_gain), "right") + td(pl(a.unrealized_gain), "right") +
      td(a.income ? pl(a.income) : a.funding != null ? usd(a.funding, true) : "—", "right") + td(a.value != null ? usd(a.value) : a.volume != null ? usd(a.volume) : "—", "right") +
      td(a.basis_status ? '<span style="font-size:11.5px;color:' + (a.basis_status === "partial" ? "#e0a84f" : "#8a99a6") + '">' + esc(a.basis_status.replace(/_/g, " ")) + "</span>" : a.fills != null ? a.fills + " fills" : "") + "</tr>");
    const cc = v.crosscheck ? '<p style="font-size:12.5px;margin:4px 0">Cross-check: Hyperliquid portfolio all-time PnL ' + usd(v.crosscheck.hl_portfolio_alltime_pnl, true) + " vs fills+funding+uPnL (diff " + usd(v.crosscheck.diff, true) + ").</p>" : "";
    return '<details id="pl-' + esc(v.id) + '" class="card card-tight" style="margin-bottom:8px">' + head + '<div style="padding:0 4px 10px">' + cc +
      (v.method ? '<p class="text-muted" style="font-size:12px;margin:4px 0">' + esc(v.method) + "</p>" : "") +
      (rows.length ? table([["Asset"], ["Realized", "right"], ["Unrealized", "right"], [v.venue === "Hyperliquid" ? "Funding" : "Income", "right"], [v.venue === "Hyperliquid" ? "Volume" : "Value", "right"], [""]], rows, { max: 380 }) : "") +
      '<h3 style="font-size:13px;margin:12px 0 4px">Flags / gaps</h3>' + flagList(v.flags) + "</div></details>";
  }

  async function run() {
    if (document.body.getAttribute("data-page") !== "pnl") return;
    const content = $(".content");
    if (!content) return;
    let book;
    try {
      const res = await fetch("book.json" + (location.search.includes("fresh") ? "?_=" + Date.now() : ""), { cache: "no-store" });
      book = await res.json();
    } catch (e) { return; }
    const host = document.createElement("section");
    host.id = "alltime-pnl";
    let html = summaryCard(book);
    const wp = book.wallet_pnl || {};
    if (wp.wallets && wp.wallets.length) {
      html += '<div class="card" style="margin-bottom:14px"><div class="card-head"><h2 style="margin:0;font-size:16px">Per-wallet P&amp;L</h2><span class="sub">every chain Zerion indexes · tap a wallet for chains, assets, flags</span></div>' +
        '<p class="text-muted" style="font-size:12px;margin:0 2px 10px">' + esc(wp.method || "") + "</p>" + wp.wallets.map(walletBlock).join("") + "</div>";
    }
    const vp = book.venue_pnl || {};
    if (vp.venues && vp.venues.length) {
      html += '<div class="card" style="margin-bottom:14px"><div class="card-head"><h2 style="margin:0;font-size:16px">Venues — full history</h2><span class="sub">' + esc(when(vp.as_of)) + "</span></div>" + vp.venues.map(venueBlock).join("") + "</div>";
    }
    html += '<h2 style="font-size:15px;margin:18px 2px 8px">Open positions — cost basis / unrealized</h2>';
    host.innerHTML = html;
    content.insertBefore(host, content.firstChild);
    if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el && el.tagName === "DETAILS") { el.open = true; el.scrollIntoView(); } }
    document.addEventListener("click", (ev) => {
      const a = ev.target.closest && ev.target.closest('a[href^="#pl-"]');
      if (!a) return;
      const el = document.getElementById(a.getAttribute("href").slice(1));
      if (el) { el.open = true; }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
