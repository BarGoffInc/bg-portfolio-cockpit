/* BG Portfolio Cockpit — home-page "On-chain wallets" card.
   Headline = our own FIFO count only (book.wallet_pnl.totals.fifo_*). Zerion lives on pnl.html as a second opinion. */
(function () {
  "use strict";
  if (document.body.getAttribute("data-page") !== "overview") return;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function usd(n, signed) {
    if (n == null || isNaN(n)) return "—";
    const v = Number(n);
    const s = Math.abs(v).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    return (v < 0 ? "−" : signed && v > 0 ? "+" : "") + s;
  }
  function pl(n) {
    if (n == null || isNaN(n)) return '<span class="text-muted">—</span>';
    const cls = Number(n) >= 0.5 ? "text-gain" : Number(n) <= -0.5 ? "text-loss" : "";
    return '<span class="tabular ' + cls + '">' + usd(n, true) + "</span>";
  }
  function when(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET";
    } catch (e) { return String(iso); }
  }
  const CHAIN = { "binance-smart-chain": "BNB", xdai: "Gnosis", robinhood: "Robinhood chain", ethereum: "Ethereum", base: "Base",
    polygon: "Polygon", optimism: "Optimism", arbitrum: "Arbitrum", avalanche: "Avalanche", celo: "Celo", solana: "Solana",
    monad: "Monad", blast: "Blast", "zksync-era": "zkSync" };
  const cname = (c) => CHAIN[c] || c;

  function shortName(w) {
    if (w.family === "solana") return (String(w.label || "").match(/^Solana\s*\d+/) || [w.label || "Solana"])[0];
    const a = String(w.address || "");
    let n = a ? a.slice(0, 6) : w.label || w.id;
    if (/WOOD/i.test(w.label || "")) n += " · WOOD wallet";
    return n;
  }

  function assess(w) {
    if (w.status === "untrackable") {
      return { chip: "unreadable", short: "Can't be read — no indexer or explorer data for this address",
        full: ((w.flags || [])[0] || {}).msg || "Address not trackable." };
    }
    if (w.status === "error") {
      const m = ((w.flags || [])[0] || {}).msg || "build error";
      return { chip: "gaps", short: "Count failed this refresh", full: m };
    }
    const shortBits = [], fullBits = [];
    // 1) assets with no cost basis
    const miss = (w.flags || []).filter((f) => f.kind === "missing_basis").map((f) => {
      const a = (w.assets || []).find((x) => x.sym === f.asset && (!f.chain || x.chain === f.chain));
      const m = String(f.msg || "").match(/\(\$([\d,.]+)\)/);
      const v = a && a.value != null ? a.value : m ? Number(m[1].replace(/,/g, "")) : null;
      return { sym: f.asset, v: v };
    });
    if (miss.length) {
      const t = miss.map((m) => m.sym + (m.v != null ? " " + usd(m.v) : "")).join(", ");
      shortBits.push("no basis: " + t);
      fullBits.push("No cost basis (received/airdropped, no priced buy): " + t + ".");
    }
    // 2) explorer cross-check
    const ex = (w.explorer_check || {}).chains;
    if (!ex) {
      shortBits.push("not explorer-checked yet");
      fullBits.push("Explorer cross-check hasn't run for this wallet yet.");
    } else {
      const unchecked = [], extra = [];
      let exOnly = 0, zOnly = 0;
      Object.entries(ex).forEach(([c, r]) => {
        if (r.explorer == null) { unchecked.push(cname(c)); return; }
        const eo = r.explorer_only || 0, zo = r.zerion_only || 0;
        if (eo || zo) { exOnly += eo; zOnly += zo; extra.push(cname(c) + " " + (eo ? "+" + eo + " explorer-only" : "") + (eo && zo ? " / " : "") + (zo ? zo + " indexer-only" : "")); }
      });
      if (unchecked.length) {
        shortBits.push(unchecked.length === 1 ? unchecked[0] + " unchecked" : unchecked.length + " chains unchecked");
        fullBits.push("No explorer cross-check on: " + unchecked.join(", ") + " (no free explorer, or explorer errored).");
      }
      if (exOnly || zOnly) {
        shortBits.push((exOnly ? exOnly.toLocaleString() + " explorer-only" : "") + (exOnly && zOnly ? " / " : "") + (zOnly ? zOnly.toLocaleString() + " indexer-only" : "") + " txs");
        fullBits.push("Tx hashes that don't match between the block explorer and the wallet indexer (Zerion) (mostly spam airdrops; not yet confirmed none are real trades): " + extra.join("; ") + ".");
      }
    }
    if (!shortBits.length) return { chip: "checked", short: "Explorer cross-check matches; every holding has a basis", full: "Explorer cross-check matches on every chain and no holding is missing a cost basis." };
    const s = shortBits.join(" · ");
    return { chip: "gaps", short: s.charAt(0).toUpperCase() + s.slice(1), full: fullBits.join(" ") };
  }

  function render(book) {
    const host = document.getElementById("onchain-card");
    if (!host) return;
    const wp = book && book.wallet_pnl;
    if (!wp || !wp.totals || !wp.wallets) { host.hidden = true; return; }
    const t = wp.totals;
    const r = t.fifo_realized_gain, u = t.fifo_unrealized_gain;
    const total = r == null && u == null ? null : (r || 0) + (u || 0);
    const accts = {};
    (book.accounts || []).forEach((a) => { accts[a.id] = a; });

    let hidden = 0;
    const rows = [];
    const list = wp.wallets.slice().filter((w) => {
      const empty = w.status !== "untrackable" && !(w.value > 0.5) && !((w.history || {}).count > 0);
      if (empty) hidden++;
      return !empty;
    }).sort((a, b) => (a.status === "untrackable") - (b.status === "untrackable") || (b.value || 0) - (a.value || 0));
    let stale = 0;
    list.forEach((w) => {
      const f = w.fifo || {};
      const as = assess(w);
      const acc = accts[w.id] || {};
      const isStale = w.status !== "untrackable" && acc.status === "partial" && w.family === "evm";
      if (isStale) stale++;
      const muted = w.status === "untrackable" || !(w.value > 0.5);
      rows.push(
        '<div class="oc-row' + (muted ? " oc-muted" : "") + '" title="' + esc(as.full) + '">' +
          '<div class="oc-name"><strong>' + esc(shortName(w)) + '</strong> <span class="oc-chip oc-' + as.chip + '">' + as.chip + "</span></div>" +
          '<div class="oc-num"><span class="oc-k">Value</span><span class="tabular">' + (w.value == null ? "—" : usd(w.value)) + (isStale ? '<sup class="oc-star" title="last-known balance">*</sup>' : "") + "</span></div>" +
          '<div class="oc-num"><span class="oc-k">Realized</span>' + pl(f.realized_gain) + "</div>" +
          '<div class="oc-num"><span class="oc-k">Unrealized</span>' + pl(f.unrealized_gain) + "</div>" +
          '<div class="oc-why">' + esc(as.short) + "</div>" +
        "</div>");
    });

    const q = wp.zerion_quota || {};
    const notes = [];
    if (stale || q.exhausted) {
      notes.push((stale ? "* " : "") + "EVM balances are last-known — the wallet indexer's daily API budget is spent" + (q.reset_in_h ? " (resets in ~" + Math.round(q.reset_in_h) + "h)" : "") + ". Solana is live. Our count runs on cached history either way.");
    }
    if (wp.error) notes.push("Last refresh couldn't rebuild this count — showing the previous one.");
    if (hidden) notes.push(hidden + " empty wallet" + (hidden > 1 ? "s" : "") + " hidden (HL trading address — its money sits in the Hyperliquid account).");

    host.hidden = false;
    host.innerHTML =
      '<a class="oc-link" href="pnl.html" aria-label="On-chain wallets — open the full all-time P&amp;L breakdown">' +
        '<div class="card-head"><div><p class="sub">All-time · our own count (FIFO)</p><h3>On-chain wallets</h3></div><span class="link-teal">Details →</span></div>' +
        '<div class="oc-kpis">' +
          '<div class="oc-kpi"><span class="oc-k">On-chain value</span><span class="oc-v tabular">' + usd(t.value) + "</span></div>" +
          '<div class="oc-kpi"><span class="oc-k">Realized</span><span class="oc-v">' + pl(r) + "</span></div>" +
          '<div class="oc-kpi"><span class="oc-k">Unrealized</span><span class="oc-v">' + pl(u) + "</span></div>" +
          '<div class="oc-kpi oc-total"><span class="oc-k">Total P/L</span><span class="oc-v">' + pl(total) + "</span></div>" +
        "</div>" +
        '<div class="oc-rows"><div class="oc-row oc-head" aria-hidden="true"><div>Wallet</div><div class="oc-num">Value</div><div class="oc-num">Realized</div><div class="oc-num">Unrealized</div></div>' + rows.join("") + "</div>" +
        '<p class="oc-foot text-muted">Counted ' + esc(when(wp.as_of)) + " from each wallet's full buy/sell/swap history, first-in first-out. Chips: <b>checked</b> = explorer tx list matches; <b>gaps</b> = something still to verify (tap for detail)." +
        (notes.length ? "<br>" + notes.map(esc).join("<br>") : "") + "</p>" +
      "</a>";
  }

  async function load(bust) {
    try {
      const res = await fetch("book.json" + (bust ? "?_=" + Date.now() : ""), { cache: bust ? "no-store" : "default" });
      if (!res.ok) return;
      render(await res.json());
    } catch (e) { console.warn("onchain card", e); }
  }
  window.__renderOnchainCard = render;
  document.addEventListener("click", (ev) => {
    if (ev.target && ev.target.closest && ev.target.closest("[data-refresh]")) setTimeout(() => load(true), 1500);
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => load(false)); else load(false);
})();
