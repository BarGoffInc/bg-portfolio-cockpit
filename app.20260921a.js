/* BG Portfolio Cockpit — interim static renderer */
(function () {
  "use strict";

  const SWATCHES = [
    "#147b83", "#375f95", "#6ca87b", "#a6678b",
    "#8d7250", "#4d9b9a", "#c85e52", "#e09b38",
    "#5b7c99", "#2a9d8f",
  ];

  const PAGE = document.body.dataset.page || "overview";
  const IS_OWNER = document.body.dataset.role === "owner";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function fmtUSD(n, opts) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    const x = Number(n);
    const abs = Math.abs(x);
    let digits;
    if (opts && opts.cents === false) {
      digits = abs >= 1000 ? 0 : 2;
    } else if (abs > 0 && abs < 0.01) {
      digits = abs < 0.0001 ? 6 : 4; // micro-priced tokens (WOOD etc.)
    } else if (abs >= 10000) {
      digits = 0;
    } else {
      digits = 2;
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(x);
  }

  function fmtNum(n, digits) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: digits != null ? digits : 4,
    }).format(Number(n));
  }

  function fmtPct(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    const sign = n > 0 ? "+" : "";
    return sign + Number(n).toFixed(1) + "%";
  }

  function pnlClass(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "";
    if (n > 0) return "text-gain";
    if (n < 0) return "text-loss";
    return "";
  }

  function formatTs(ts) {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return String(ts).slice(0, 16);
      return d.toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }) + " ET";
    } catch (_) {
      return String(ts);
    }
  }

  function initials(name) {
    if (!name) return "??";
    const parts = String(name).replace(/\*/g, "").split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function statusLabel(a) {
    const s = (a.status || a.completeness || "").toLowerCase();
    if (s.includes("partial") || s === "pending") return { text: "—", cls: "" };
    if (s.includes("live")) return { text: "LIVE", cls: "" };
    return { text: (a.status || "—").toUpperCase().slice(0, 10), cls: "" };
  }

  // Bust cache only when the user hits Refresh (normal loads use CDN / browser cache).
  let FORCE_BUST = false;

  function dataUrl(name) {
    if (!FORCE_BUST) return name;
    return name + (name.includes("?") ? "&" : "?") + "_=" + Date.now();
  }

  async function loadBook() {
    const res = await fetch(dataUrl("book.json"), {
      cache: FORCE_BUST ? "no-store" : "default",
    });
    if (!res.ok) throw new Error("Could not load book.json (" + res.status + ")");
    return res.json();
  }

  function toast(msg, ms) {
    let el = document.getElementById("cockpit-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "cockpit-toast";
      el.setAttribute("role", "status");
      el.style.cssText = "position:fixed;bottom:72px;left:50%;transform:translateX(-50%);z-index:9999;background:#102832;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:90vw;text-align:center";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, ms || 4500);
  }

  function setRefreshingUI(on) {
    document.body.classList.toggle("is-refreshing", !!on);
    let banner = document.getElementById("refresh-banner");
    if (on) {
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "refresh-banner";
        banner.setAttribute("role", "status");
        banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:10000;background:#3db8c5;color:#102832;font-weight:700;font-size:14px;padding:10px 16px;text-align:center";
        document.body.appendChild(banner);
      }
      banner.textContent = "Refreshing…";
      banner.hidden = false;
    } else if (banner) {
      banner.hidden = true;
    }
    document.querySelectorAll("[data-refresh]").forEach((b) => {
      if (on) {
        if (!b.dataset.prevLabel) b.dataset.prevLabel = b.textContent || "Refresh";
        b.disabled = true;
        b.textContent = "Refreshing…";
      } else {
        b.disabled = false;
        b.textContent = b.dataset.prevLabel || "Refresh";
        delete b.dataset.prevLabel;
      }
    });
  }



  function baseSymbol(sym) {
    if (!sym) return null;
    const s = String(sym).trim();
    if (s === "Other (dust)") return null;
    if (/\s/.test(s) && /\d/.test(s)) return null; // options
    if (/-PERP$/i.test(s)) return null; // never live-reprice perps
    if (s.indexOf("JupSOL") === 0 || s === "SOL-STAKE") return "JUPSOL"; // special
    if (s === "WETH" || s === "wETH") return "ETH";
    if (s === "WBTC" || s === "cbBTC") return "BTC";
    return s.split(/[·\s]/)[0].toUpperCase();
  }

  async function fetchCoinbasePrice(product) {
    const res = await fetch(
      "https://api.exchange.coinbase.com/products/" + encodeURIComponent(product) + "/ticker",
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const j = await res.json();
    const px = Number(j.price);
    return Number.isFinite(px) ? px : null;
  }

  async function fetchLiveCryptoPrices(symbols) {
    const out = {};
    const uniq = [...new Set(symbols.filter(Boolean))];
    await Promise.all(
      uniq.map(async (sym) => {
        if (sym === "USDC" || sym === "USD" || sym === "USDT") {
          out[sym] = 1;
          return;
        }
        if (sym === "JUPSOL") return; // priced via SOL ratio below
        try {
          const px = await fetchCoinbasePrice(sym + "-USD");
          if (px != null) out[sym] = px;
        } catch (_) {}
      })
    );
    return out;
  }

  function applyLiveCryptoMarks(book, prices) {
    if (!book || !prices) return { book, priced: 0 };
    const positions = book.positions || {};
    let priced = 0;
    const solPx = prices.SOL;

    (book.accounts || []).forEach((a) => {
      const plist = positions[a.id] || [];
      const priorValue = a.value;
      // Never rewrite HL equity from leg notionals
      if (a.id === "hyperliquid") return;
      // Stocks closed / SnapTrade RTH — leave broker stock accounts alone
      if (a.id === "etrade" || a.id === "robinhood") return;

      let sum = 0;
      let any = false;
      plist.forEach((p) => {
        const sym = String(p.symbol || "");
        if (/-PERP$/i.test(sym)) {
          if (p.mv != null) sum += Number(p.mv) || 0;
          return;
        }
        const base = baseSymbol(sym);
        if (!base) {
          if (p.mv != null) sum += Number(p.mv) || 0;
          return;
        }
        let px = prices[base];
        // JupSOL: scale prior mark by SOL move if we have both
        if (base === "JUPSOL") {
          if (solPx != null && p.mark != null && Number(p.mark) > 0 && p.qty != null) {
            // Prefer keeping LST premium: new = oldMark * (newSOL / impliedOldSOL) — if old mark ~ SOL, use solPx * (oldMark/oldSolApprox)
            // Simple safe approach: newMark = solPx * (Number(p.mark) / (Number(p.mark) > 50 ? Number(p.mark) : solPx))
            // Better: assume JupSOL/SOL ratio stable from book: ratio = mark/sol was unknown; use mark * 0.99.. 
            // Use: if we stored nothing, scale by 1:1 only when mark was within 20% of a typical SOL — else skip
            const oldMark = Number(p.mark);
            // Keep LST premium: new = solPx * (oldMark / referenceSol). referenceSol ~= oldMark / 1.2 if LST was ~1.2x? 
            // From book JupSOL mark 133 vs SOL 110 → ratio 1.21. Preserve ratio:
            // We don't have old SOL in book easily — use ratio from mark if mark > sol-ish
            px = solPx * (oldMark / Math.max(oldMark * 0.85, solPx * 0.85)); // weak
            // Cleaner preserve: newMv = oldMv * (solPx / oldSol). Without oldSol, skip JupSOL updates.
            px = null; // skip JupSOL — avoids bogus jumps
          } else {
            px = null;
          }
        }
        if (px != null && p.qty != null && Number.isFinite(Number(p.qty))) {
          p.mark = px;
          p.mv = Math.round(Number(p.qty) * px * 100) / 100;
          if (p.cost_basis != null && Number.isFinite(Number(p.cost_basis))) {
            const costTotal =
              p.cost_total != null ? Number(p.cost_total) : Number(p.cost_basis) * Number(p.qty);
            p.uPnL = Math.round((p.mv - costTotal) * 100) / 100;
          }
          priced += 1;
          any = true;
        }
        if (p.mv != null) sum += Number(p.mv) || 0;
      });

      if (any) {
        if (a.id === "coinbase") {
          a.value = Math.round(sum * 100) / 100;
        } else {
          a.value = Math.round(sum * 100) / 100;
        }
      } else {
        a.value = priorValue;
      }
    });

    let bookUsd = 0;
    (book.accounts || []).forEach((a) => {
      bookUsd += Number(a.value) || 0;
    });
    book.totals = book.totals || {};
    book.totals.book_usd = Math.round(bookUsd * 100) / 100;
    const now = new Date();
    book.as_of = now.toISOString();
    book.as_of_et =
      now.toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }) + " ET · live crypto";
    return { book, priced };
  }

  async function hardRefresh(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    if (hardRefresh._busy) return;
    hardRefresh._busy = true;
    FORCE_BUST = true;
    setRefreshingUI(true);
    toast("Refreshing live crypto marks…", 10000);
    try {
      let book = await loadBook();
      const syms = [];
      Object.values(book.positions || {}).forEach((plist) => {
        (plist || []).forEach((p) => {
          const b = baseSymbol(p.symbol);
          if (b && b !== "JUPSOL") syms.push(b);
          if (String(p.symbol || "").indexOf("JupSOL") === 0 || b === "JUPSOL") syms.push("SOL");
        });
      });
      const prices = await fetchLiveCryptoPrices(syms);
      const result = applyLiveCryptoMarks(book, prices);
      book = result.book;
      window.__BOOK__ = book;
      setAsOf(book);
      if (PAGE === "overview" || PAGE === "owner") renderOverview(book);
      if (PAGE === "consolidated") renderConsolidated(book);
      if (PAGE === "pnl") renderPnL(book);
      if (PAGE === "history") renderHistory(book);
      if (PAGE === "barometer") {
        try {
          const baro = await loadBarometer();
          window.__BARO__ = baro;
          renderBarometer(baro, book);
        } catch (e) {
          console.warn(e);
        }
      }
      await new Promise((r) => setTimeout(r, 500));
      const total =
        book.totals && book.totals.book_usd != null
          ? fmtUSD(book.totals.book_usd, { cents: false })
          : "";
      toast(
        "Updated " +
          total +
          " · " +
          (result.priced || 0) +
          " crypto marks · stocks/HL unchanged · " +
          (book.as_of_et || "")
      );
    } catch (err) {
      console.error(err);
      toast("Refresh failed: " + (err && err.message ? err.message : err));
    } finally {
      FORCE_BUST = false;
      setRefreshingUI(false);
      hardRefresh._busy = false;
    }
  }
  window.hardRefresh = hardRefresh;
  hardRefresh._busy = false;


  // Event delegation — survives hero re-renders
  document.addEventListener("click", (ev) => {
    const btn = ev.target && ev.target.closest && ev.target.closest("[data-refresh]");
    if (!btn) return;
    hardRefresh(ev);
  });

  function setAsOf(book) {
    $all("[data-asof]").forEach((el) => {
      el.textContent = formatAsOf(book.as_of);
    });
  }

  /* ---- Overview ---- */
  function renderOverview(book) {
    const hero = $("#hero");
    if (!hero) return;
    const t = book.totals || {};
    const cashNote = t.cash_usd != null ? fmtUSD(t.cash_usd, { cents: false }) + " cash · " : "";
    hero.innerHTML = `
      <div class="hero-top">
        <div>
          <p class="label">Book total</p>
          <h2 class="total tabular">${fmtUSD(t.book_usd, { cents: false })}</h2>
          <p class="meta">${cashNote}<span data-asof>${book.as_of_et || ""}</span>
            </p>
        </div>
        <button class="btn btn-soft" type="button" data-refresh>Refresh</button>
      </div>
      <div class="chips" id="account-chips"></div>`;

    const chips = $("#account-chips");
    (book.accounts || []).forEach((a) => {
      const st = statusLabel(a);
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      btn.innerHTML = `
        <span class="name">${escapeHtml(a.name)}</span>
        <strong class="val tabular">${a.value != null ? fmtUSD(a.value, { cents: false }) : "—"}</strong>
        ${st.text && st.text !== "—" ? `<span class="badge live">${st.text}</span>` : ""}`;
      btn.addEventListener("click", () => {
        location.href = (IS_OWNER ? "owner.html" : "consolidated.html");
      });
      chips.appendChild(btn);
    });

    // Banner
    const banner = $("#interim-banner");
    if (banner) {
      const note = (t.note || "").replace(/partial/gi, "").replace(/\s{2,}/g, " ").trim();
      banner.innerHTML = note ? escapeHtml(note) : "";
      if (!note) banner.hidden = true;
    }

    // Perps
    const perps = (book.positions && book.positions.hyperliquid) || [];
    const perpsBody = $("#perps-body");
    if (perpsBody) {
      if (!perps.length) {
        perpsBody.innerHTML = `<tr><td colspan="6" class="empty">No open perps</td></tr>`;
      } else {
        perpsBody.innerHTML = perps
          .map((p) => {
            const side = `${p.side || "long"} ${p.leverage || "?"}x ${p.leverage_type || "cross"}`;
            return `<tr>
              <td><strong>${escapeHtml(p.symbol)}</strong></td>
              <td>${escapeHtml(side)}</td>
              <td class="mono">${fmtNum(p.qty, 5)}</td>
              <td class="mono">${fmtUSD(p.mark)}</td>
              <td class="mono">${fmtUSD(p.margin, { cents: false })}</td>
              <td class="mono ${pnlClass(p.uPnL)}">${fmtUSD(p.uPnL, { cents: false })}</td>
            </tr>`;
          })
          .join("");
      }
    }

    // Recent activity
    const fills = (book.fills || []).slice(0, 8);
    const act = $("#activity-list");
    if (act) {
      if (!fills.length) {
        act.innerHTML = `<div class="empty">No fills in seed</div>`;
      } else {
        act.innerHTML = fills
          .map(
            (f) => `<div class="activity-row">
              <span class="when">${escapeHtml(formatTs(f.ts))}</span>
              <strong class="sym">${escapeHtml(String(f.symbol || "—"))}</strong>
              <span class="acct">${escapeHtml(f.account || "")}</span>
              <strong class="mono">${f.notional != null ? fmtUSD(f.notional, { cents: false }) : "—"}</strong>
            </div>`
          )
          .join("");
      }
    }

    // Largest holdings + donut
    renderLargest(book);
  }

  function pieCanonical(sym) {
    if (!sym || sym === "Other (dust)") return null;
    const s = String(sym).trim();
    // options / dated contracts stay unique
    if (/\s/.test(s) && /\d/.test(s)) return s;
    if (/-PERP$/i.test(s)) return s;
    const ALIAS = {
      WETH: "ETH", wETH: "ETH", stETH: "ETH", cbETH: "ETH",
      WBTC: "BTC", cbBTC: "BTC", tBTC: "BTC",
      "JupSOL · LST": "SOL", JupSOL: "SOL", "SOL-STAKE": "SOL", mSOL: "SOL", bSOL: "SOL",
      "USDC.e": "USDC", USDbC: "USDC", USDCE: "USDC",
      "USDT.e": "USDT",
    };
    return ALIAS[s] || s;
  }

  function consolidateLargest(items) {
    const buckets = new Map();
    for (const h of items || []) {
      const key = pieCanonical(h.symbol);
      if (!key || h.mv == null) continue;
      let b = buckets.get(key);
      if (!b) {
        b = { symbol: key, mv: 0, qty: 0, qtyOk: true, accounts: [] };
        buckets.set(key, b);
      }
      b.mv += Number(h.mv) || 0;
      if (h.qty == null || Number.isNaN(Number(h.qty))) b.qtyOk = false;
      else b.qty += Number(h.qty);
      const accts = h.accounts && h.accounts.length ? h.accounts : (h.account ? [h.account] : []);
      for (const a of accts) {
        if (a && !b.accounts.includes(a)) b.accounts.push(a);
      }
    }
    return Array.from(buckets.values())
      .map((b) => ({
        symbol: b.symbol,
        mv: b.mv,
        qty: b.qtyOk ? b.qty : null,
        accounts: b.accounts,
        account: b.accounts.length <= 1
          ? (b.accounts[0] || "")
          : b.accounts.length <= 3
            ? b.accounts.join(" + ")
            : b.accounts.slice(0, 2).join(" + ") + ` +${b.accounts.length - 2} more`,
      }))
      .sort((a, b) => Math.abs(b.mv) - Math.abs(a.mv));
  }

  function renderLargest(book) {
    const list = $("#holdings-list");
    const donut = $("#donut");
    const items = consolidateLargest(book.largest_holdings || []).slice(0, 12);
    const total = (book.totals && book.totals.book_usd) || 1;
    if (list) {
      list.innerHTML = items
        .map((h, i) => {
          const w = h.weight_pct != null ? h.weight_pct : (h.mv / total) * 100;
          const src = h.account || ((h.accounts && h.accounts.length) ? h.accounts.join(" + ") : "");
          const acctHint = src
            ? `<div class="text-muted" style="font-size:10px;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(src)}</div>`
            : "";
          return `<div class="list-row">
            <i class="swatch" style="background:${SWATCHES[i % SWATCHES.length]}"></i>
            <div style="flex:1;min-width:0;overflow:hidden">
              <strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(h.symbol)}</strong>
              ${acctHint}
            </div>
            <span class="text-muted mono" style="font-size:11px">${fmtPct(w).replace("+", "")}</span>
            <span class="mono" style="width:96px;text-align:right">${fmtUSD(h.mv, { cents: false })}</span>
          </div>`;
        })
        .join("");
    }
    if (donut) {
      const slices = items.filter((h) => h.mv > 0).slice(0, 8);
      const sum = slices.reduce((a, b) => a + b.mv, 0) || 1;
      let angle = -90;
      const r = 82;
      const ir = 52;
      const cx = 90;
      const cy = 90;
      const paths = slices
        .map((h, i) => {
          const frac = h.mv / sum;
          const sweep = frac * 360;
          const path = donutSlice(cx, cy, r, ir, angle, angle + sweep);
          angle += sweep;
          return `<path d="${path}" fill="${SWATCHES[i % SWATCHES.length]}"/>`;
        })
        .join("");
      donut.innerHTML = `<svg viewBox="0 0 180 180" aria-hidden="true">${paths}</svg>
        <div class="donut-center"><div><span>Book</span><strong class="tabular">${fmtUSD(book.totals.book_usd, { cents: false })}</strong></div></div>`;
    }
  }

  function polar(cx, cy, r, deg) {
    const rad = ((deg - 90) * Math.PI) / 180;
    // Using angle where 0 is top via -90 offset already in caller; use standard:
    const r2 = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(r2), cy + r * Math.sin(r2)];
  }

  function donutSlice(cx, cy, r, ir, startDeg, endDeg) {
    // Convert our -90-based degrees to standard math (0=east): add nothing if we pass absolute
    const toRad = (d) => (d * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startDeg));
    const y1 = cy + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(endDeg));
    const y2 = cy + r * Math.sin(toRad(endDeg));
    const ix1 = cx + ir * Math.cos(toRad(endDeg));
    const iy1 = cy + ir * Math.sin(toRad(endDeg));
    const ix2 = cx + ir * Math.cos(toRad(startDeg));
    const iy2 = cy + ir * Math.sin(toRad(startDeg));
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2} Z`;
  }

  /* ---- Consolidated ---- */
  function renderConsolidated(book) {
    const root = $("#accounts-root");
    if (!root) return;
    root.innerHTML = "";
    const positions = book.positions || {};
    const bookTotal = (book.totals && book.totals.book_usd) || 0;

    (book.accounts || []).forEach((a, idx) => {
      const st = statusLabel(a);
      const pos = positions[a.id] || [];
      const weight =
        a.value != null && bookTotal
          ? ((a.value / bookTotal) * 100).toFixed(1) + "%"
          : "—";
      const wrap = document.createElement("div");
      wrap.className = "acct-block";
      const btn = document.createElement("button");
      btn.className = "acct-row";
      btn.type = "button";
      btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = `
        <div class="left">
          <span class="acct-icon">${escapeHtml(initials(a.name))}</span>
          <div>
            <div class="acct-name">${escapeHtml(a.name)}
              <span class="status-tag ${st.cls}">${st.text}</span>
            </div>
            <div class="acct-meta">${pos.length} holdings · click to expand</div>
          </div>
        </div>
        <div class="acct-stats">
          <div class="stat"><span>Value</span><strong class="mono">${a.value != null ? fmtUSD(a.value, { cents: false }) : "—"}</strong></div>
          <div class="stat"><span>Weight</span><strong class="mono">${weight}</strong></div>
          <div class="stat"><span>uPnL</span><strong class="mono ${pnlClass(a.uPnL)}">${a.uPnL != null ? fmtUSD(a.uPnL, { cents: false }) : "—"}</strong></div>
          <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
        </div>`;
      const panel = document.createElement("div");
      panel.className = "holdings-panel";
      panel.id = "holdings-" + a.id;
      if (!pos.length) {
        panel.innerHTML = `<div class="empty">${escapeHtml(a.note || "No holdings listed yet.")}</div>`;
      } else {
        panel.innerHTML = `<div class="table-wrap"><table class="data"><thead><tr>
          <th>Symbol</th><th>Kind</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Value</th><th class="right">uPnL</th>
        </tr></thead><tbody>
        ${pos
          .map((p) => {
            const mv = p.mv != null ? p.mv
              : p.value != null ? p.value
              : p.market_value != null ? p.market_value
              : (p.qty != null && p.mark != null ? Number(p.qty) * Number(p.mark) : p.margin);
            return `<tr>
              <td><strong>${escapeHtml(p.symbol)}</strong></td>
              <td class="text-muted">${escapeHtml(p.kind || "")}</td>
              <td class="right mono">${fmtNum(p.qty, 6)}</td>
              <td class="right mono">${p.mark != null ? fmtUSD(p.mark) : "—"}</td>
              <td class="right mono">${mv != null ? fmtUSD(mv, { cents: false }) : "—"}</td>
              <td class="right mono ${pnlClass(p.uPnL)}">${p.uPnL != null ? fmtUSD(p.uPnL, { cents: false }) : "—"}</td>
            </tr>`;
          })
          .join("")}
        </tbody></table></div>`;
      }
      btn.addEventListener("click", () => {
        const open = panel.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      // Auto-expand first account with positions
      if (idx === 0 && pos.length) {
        panel.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
      wrap.appendChild(btn);
      wrap.appendChild(panel);
      root.appendChild(wrap);
    });
  }

  /* ---- P&L ---- */
  function renderPnL(book) {
    const body = $("#pnl-body");
    if (!body) return;
    const rows = [];
    const positions = book.positions || {};
    Object.keys(positions).forEach((acctId) => {
      const acct = (book.accounts || []).find((a) => a.id === acctId);
      const acctName = acct ? acct.name : acctId;
      (positions[acctId] || []).forEach((p) => {
        if (p.kind === "cash") return;
        const cost =
          p.cost_total != null
            ? p.cost_total
            : p.cost_basis != null && p.qty != null
            ? Math.abs(p.qty) * p.cost_basis * (p.kind === "option" ? 100 : 1)
            : p.entry != null && p.qty != null
            ? Math.abs(p.qty) * p.entry
            : null;
        const mv = p.mv != null ? p.mv : null;
        rows.push({
          account: acctName,
          symbol: p.symbol,
          kind: p.kind,
          qty: p.qty,
          cost_basis: p.cost_basis != null ? p.cost_basis : p.entry,
          cost_total: cost,
          mark: p.mark,
          mv,
          uPnL: p.uPnL,
          uPnL_pct: p.uPnL_pct,
          partial: p.partial,
          basis_status: p.basis_status,
        });
      });
    });
    rows.sort((a, b) => Math.abs(b.uPnL || 0) - Math.abs(a.uPnL || 0));
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="8" class="empty">No positions</td></tr>`;
      return;
    }
    body.innerHTML = rows
      .map((r) => {
        const pct =
          r.uPnL_pct != null
            ? r.uPnL_pct
            : r.uPnL != null && r.cost_total
            ? (r.uPnL / r.cost_total) * 100
            : null;
        return `<tr>
          <td>${escapeHtml(r.account)}</td>
          <td><strong>${escapeHtml(r.symbol)}</strong></td>
          <td class="text-muted">${escapeHtml(r.kind || "")}</td>
          <td class="right mono">${fmtNum(r.qty, 6)}</td>
          <td class="right mono">${r.cost_basis != null ? fmtUSD(r.cost_basis) : "—"}</td>
          <td class="right mono">${r.mark != null ? fmtUSD(r.mark) : "—"}</td>
          <td class="right mono ${pnlClass(r.uPnL)}">${r.uPnL != null ? fmtUSD(r.uPnL, { cents: false }) : "—"}</td>
          <td class="right mono ${pnlClass(pct)}">${pct != null ? fmtPct(pct) : "—"}</td>
        </tr>`;
      })
      .join("");

    const sumEl = $("#pnl-summary");
    if (sumEl) {
      const known = rows.filter((r) => r.uPnL != null);
      const sum = known.reduce((a, b) => a + b.uPnL, 0);
      sumEl.textContent =
        `Unrealized P/L (positions with basis): ${fmtUSD(sum, { cents: false })} across ${known.length} rows. Coinbase transfer-ins may show — where basis is incomplete.`;
    }
  }

  /* ---- History ---- */
  function renderHistory(book) {
    const body = $("#history-body");
    const note = $("#history-note");
    if (note) {
      const parts = [];
      if (book.fills_note) parts.push(book.fills_note);
      if (book.activity_note) parts.push(book.activity_note);
      note.textContent = parts.join(" ");
    }
    if (!body) return;

    const rows = [];
    (book.fills || []).forEach((f) => {
      rows.push({
        ts: f.ts,
        account: f.account || "",
        symbol: f.symbol || "—",
        side: f.side || f.raw_type || "fill",
        qty: f.qty,
        notional: f.notional != null ? f.notional : f.price,
        kind: "broker",
      });
    });
    (book.activity || []).forEach((a) => {
      const chain = a.chain && a.chain !== "broker" ? " · " + a.chain : "";
      rows.push({
        ts: a.date || a.ts,
        account: (a.account || "") + chain,
        symbol: a.symbol || "—",
        side: a.type || "tx",
        qty: a.qty,
        notional: a.amount_usd,
        kind: "onchain",
      });
    });
    rows.sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="empty">No fill or on-chain activity in this snapshot</td></tr>`;
      return;
    }
    // Cap display for UI responsiveness
    const shown = rows.slice(0, 150);
    body.innerHTML = shown
      .map(
        (f) => `<tr>
          <td class="mono text-muted">${escapeHtml(formatTs(f.ts))}</td>
          <td>${escapeHtml(f.account || "")}</td>
          <td><strong>${escapeHtml(String(f.symbol || "—"))}</strong></td>
          <td>${escapeHtml(f.side || "")}</td>
          <td class="right mono">${f.qty != null ? fmtNum(f.qty, 6) : "—"}</td>
          <td class="right mono">${f.notional != null ? fmtUSD(f.notional, { cents: false }) : "—"}</td>
        </tr>`
      )
      .join("");
  }


  /* ---- Barometer ---- */
  let __BARO__ = null;
  let __baroTypeFilter = "all";

  async function loadBarometer() {
    const res = await fetch(dataUrl("barometer.json"), { cache: FORCE_BUST ? "no-store" : "default" });
    if (!res.ok) throw new Error("Could not load barometer.json (" + res.status + ")");
    return res.json();
  }

  function renderBarometer(baro, book) {
    __BARO__ = baro;
    const span = baro.span || {};
    const t = baro.totals || {};
    const pnl = (baro.running_pnl && baro.running_pnl.headline) || {};
    const note = $("#baro-note");
    if (note) {
      note.textContent =
        "Ledger span " + (span.first || "?") + " → " + (span.last || "?") +
        " · " + Number(t.event_count || 0).toLocaleString() + " tagged events" +
        " · spam/noise bucket " + Number(baro.spam_noise_count || 0).toLocaleString() +
        " (toggle above). Explorers + archive; not tax-grade.";
    }

    const hero = $("#baro-hero");
    if (hero) {
      // Always paint — never leave hidden blank scoreboard
      hero.hidden = false;
      hero.removeAttribute("hidden");
      const net = t.all_time_net_usd;
      const buys = t.all_time_buys_usd;
      const sells = t.all_time_sells_usd;
      const events = t.event_count || 0;
      const spanLabel = (span.first && span.last)
        ? String(span.first).slice(0, 4) + "–" + String(span.last).slice(0, 4)
        : "—";
      const spanFull = (span.first || "?") + " → " + (span.last || "?");
      hero.innerHTML = `
        <div class="hero-top">
          <div>
            <p class="label">All-time net (sells − buys)</p>
            <h2 class="total tabular">${fmtUSD(net, { cents: false })}</h2>
            <p class="meta">${escapeHtml(spanFull)} · ${Number(events).toLocaleString()} events
              · Majors P&amp;L ${fmtUSD(pnl.total_pnl_usd, { cents: false })}</p>
          </div>
        </div>
        <div class="chips" id="baro-hero-chips">
          <div class="chip" role="group">
            <span class="name">Buys</span>
            <strong class="val tabular">${fmtUSD(buys, { cents: false })}</strong>
          </div>
          <div class="chip" role="group">
            <span class="name">Sells</span>
            <strong class="val tabular">${fmtUSD(sells, { cents: false })}</strong>
          </div>
          <div class="chip" role="group">
            <span class="name">Events</span>
            <strong class="val tabular">${Number(events).toLocaleString()}</strong>
          </div>
          <div class="chip" role="group">
            <span class="name">Date span</span>
            <strong class="val tabular">${escapeHtml(spanLabel)}</strong>
          </div>
        </div>`;
    }

    // wallet picker — value must match by_wallet keys (full address)
    const sel = $("#baro-wallet");
    if (sel && !sel.dataset.ready) {
      const wallets = (baro.wallets || []).slice().sort((a, b) => (b.event_count || 0) - (a.event_count || 0));
      sel.innerHTML = `<option value="all">All wallets (roll-up)</option>` +
        wallets.map((w) => {
          const addr = w.address || "";
          const hasSeries = !!(baro.by_wallet && baro.by_wallet[addr]);
          const label = (w.label || addr) + (hasSeries ? "" : " · no daily rows");
          return `<option value="${escapeHtml(addr)}">${escapeHtml(label)} · ${w.event_count || 0} ev</option>`;
        }).join("");
      sel.dataset.ready = "1";
      sel.addEventListener("change", () => renderBarometerTables(__BARO__));
    }
    const spam = $("#baro-show-spam");
    if (spam && !spam.dataset.ready) {
      spam.dataset.ready = "1";
      spam.addEventListener("change", () => renderBarometerTables(__BARO__));
    }

    // type filter chips (light-card styles via .baro-filter-chips)
    const typesWrap = $("#baro-type-filters");
    if (typesWrap && !typesWrap.dataset.ready) {
      const hist = baro.type_histogram || {};
      const keys = ["all", "swap", "transfer", "airdrop", "nft_mint", "nft_buy", "nft_sell", "lp_add", "lp_remove", "stake", "unstake"];
      typesWrap.innerHTML = keys.map((k) => {
        const n = k === "all" ? (t.event_count || 0) : (hist[k] || 0);
        return `<button type="button" class="chip baro-type${k === "all" ? " on" : ""}" data-type="${k}">${k}<strong class="val tabular">${Number(n).toLocaleString()}</strong></button>`;
      }).join("");
      typesWrap.dataset.ready = "1";
      typesWrap.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-type]");
        if (!btn) return;
        __baroTypeFilter = btn.getAttribute("data-type") || "all";
        $all(".baro-type", typesWrap).forEach((b) => b.classList.toggle("on", b === btn));
        renderBarometerTables(__BARO__);
      });
    }

    // PnL table
    const pnlBody = $("#baro-pnl-body");
    const assets = (baro.running_pnl && baro.running_pnl.assets) || {};
    if (pnlBody) {
      const rows = Object.keys(assets).map((sym) => {
        const a = assets[sym] || {};
        return `<tr>
          <td><strong>${escapeHtml(sym)}</strong></td>
          <td class="right mono">${fmtNum(a.qty, 6)}</td>
          <td class="right mono">${a.avg_cost_usd != null ? fmtUSD(a.avg_cost_usd) : "—"}</td>
          <td class="right mono">${a.mark_usd != null ? fmtUSD(a.mark_usd) : "—"}</td>
          <td class="right mono ${pnlClass(a.unrealized_pnl_usd)}">${a.unrealized_pnl_usd != null ? fmtUSD(a.unrealized_pnl_usd, { cents: false }) : "—"}</td>
          <td class="right mono ${pnlClass(a.realized_pnl_usd)}">${fmtUSD(a.realized_pnl_usd, { cents: false })}</td>
        </tr>`;
      });
      pnlBody.innerHTML = rows.join("") || `<tr><td colspan="6" class="empty">No majors P&amp;L yet</td></tr>`;
    }
    const gaps = $("#baro-pnl-gaps");
    if (gaps) {
      const g = (baro.running_pnl && baro.running_pnl.gaps) || [];
      gaps.textContent = g.length ? ("Gaps: " + g.join(" ")) : "";
    }

    renderBarometerTables(baro);
  }

  function baroWeekKey(dayStr) {
    // Monday-start ISO-ish week key from YYYY-MM-DD
    const parts = String(dayStr || "").split("-").map(Number);
    if (parts.length < 3 || !parts[0]) return dayStr;
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    if (Number.isNaN(d.getTime())) return dayStr;
    const dow = d.getUTCDay(); // 0 Sun
    const offset = dow === 0 ? -6 : 1 - dow;
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  }

  function renderBarometerTables(baro) {
    if (!baro) return;
    const wallet = ($("#baro-wallet") && $("#baro-wallet").value) || "all";
    const showSpam = $("#baro-show-spam") && $("#baro-show-spam").checked;
    const typeF = __baroTypeFilter || "all";

    let days;
    if (wallet === "all") {
      days = Array.isArray(baro.rollup) ? baro.rollup : [];
    } else {
      const series = baro.by_wallet && baro.by_wallet[wallet];
      days = Array.isArray(series) ? series : [];
    }

    const windowLabel = $("#baro-window-label");
    if (windowLabel) {
      if (days.length) {
        windowLabel.textContent =
          "Recent daily window · " + days[0].day + " → " + days[days.length - 1].day +
          " (" + days.length + " days)";
      } else {
        windowLabel.textContent = "Recent daily window · no rows for this filter";
      }
    }

    // notable days
    const notable = (wallet === "all"
      ? (baro.notable_days || [])
      : [...days].sort((a, b) => Math.abs(b.net_usd || 0) - Math.abs(a.net_usd || 0)).slice(0, 40));
    const daysBody = $("#baro-days-body");
    if (daysBody) {
      daysBody.innerHTML = notable.slice(0, 25).map((r) => `<tr>
        <td class="mono">${escapeHtml(r.day)}</td>
        <td class="right mono">${fmtUSD(r.buys_usd, { cents: false })}</td>
        <td class="right mono">${fmtUSD(r.sells_usd, { cents: false })}</td>
        <td class="right mono ${pnlClass(r.net_usd)}">${fmtUSD(r.net_usd, { cents: false })}</td>
        <td class="right mono">${r.event_count != null ? r.event_count : "—"}</td>
        <td class="text-muted" style="font-size:12px">${escapeHtml(r.notes || "")}</td>
      </tr>`).join("") || `<tr><td colspan="6" class="empty">No days</td></tr>`;
    }

    // weekly summary (last ~12 weeks with any activity preferred)
    const weekMap = new Map();
    days.forEach((r) => {
      const k = baroWeekKey(r.day);
      let w = weekMap.get(k);
      if (!w) {
        w = { week: k, buys_usd: 0, sells_usd: 0, net_usd: 0, event_count: 0 };
        weekMap.set(k, w);
      }
      w.buys_usd += Number(r.buys_usd) || 0;
      w.sells_usd += Number(r.sells_usd) || 0;
      w.net_usd += Number(r.net_usd) || 0;
      w.event_count += Number(r.event_count) || 0;
    });
    const weeks = [...weekMap.values()].sort((a, b) => (a.week < b.week ? -1 : 1));
    const weeklyBody = $("#baro-weekly-body");
    if (weeklyBody) {
      const show = weeks.slice(-12).reverse();
      weeklyBody.innerHTML = show.map((r) => `<tr>
        <td class="mono">${escapeHtml(r.week)}</td>
        <td class="right mono">${fmtUSD(r.buys_usd, { cents: false })}</td>
        <td class="right mono">${fmtUSD(r.sells_usd, { cents: false })}</td>
        <td class="right mono ${pnlClass(r.net_usd)}">${fmtUSD(r.net_usd, { cents: false })}</td>
        <td class="right mono">${r.event_count}</td>
      </tr>`).join("") || `<tr><td colspan="5" class="empty">No weekly rows in window</td></tr>`;
    }

    // daily table (newest first)
    const dailyBody = $("#baro-daily-body");
    const dailySorted = [...days].reverse().slice(0, 366);
    if (dailyBody) {
      dailyBody.innerHTML = dailySorted.map((r) => `<tr>
        <td class="mono">${escapeHtml(r.day)}</td>
        <td class="right mono">${fmtUSD(r.buys_usd, { cents: false })}</td>
        <td class="right mono">${fmtUSD(r.sells_usd, { cents: false })}</td>
        <td class="right mono">${fmtUSD(r.transfer_in_usd, { cents: false })}</td>
        <td class="right mono">${fmtUSD(r.transfer_out_usd, { cents: false })}</td>
        <td class="right mono ${pnlClass(r.net_usd)}">${fmtUSD(r.net_usd, { cents: false })}</td>
        <td class="text-muted" style="font-size:12px">${escapeHtml(r.notes || "")}</td>
      </tr>`).join("") || `<tr><td colspan="7" class="empty">No daily rows in recent window</td></tr>`;
    }

    // spark bars for last ~90 days with buy/sell/net activity
    const chart = $("#baro-chart");
    const caption = $("#baro-chart-caption");
    if (chart) {
      const series = days.filter((d) => d.buys_usd || d.sells_usd || d.net_usd).slice(-90);
      if (!series.length) {
        chart.innerHTML = "";
        if (caption) {
          caption.textContent = days.length
            ? "No buy/sell activity in the recent daily window for this filter (transfers-only days omitted from spark)."
            : "No daily series for this wallet in the recent window.";
        }
      } else {
        const maxAbs = Math.max(1, ...series.map((d) => Math.abs(Number(d.net_usd) || 0)));
        chart.innerHTML = series.map((d) => {
          const net = Number(d.net_usd) || 0;
          const h = Math.max(2, Math.round((Math.abs(net) / maxAbs) * 56));
          const cls = net >= 0 ? "up" : "down";
          return `<i class="baro-bar ${cls}" style="height:${h}px" title="${escapeHtml(d.day)}: net ${net}"></i>`;
        }).join("");
        if (caption) {
          caption.textContent =
            "Spark: last " + series.length + " active days in window (" +
            series[0].day + " → " + series[series.length - 1].day + "). Teal = net sells > buys.";
        }
      }
    }

    // events
    let events = baro.recent_events || [];
    if (wallet !== "all") events = events.filter((e) => e.wallet === wallet);
    if (typeF !== "all") events = events.filter((e) => e.type === typeF);
    events = events.slice(0, 80);
    if (showSpam) {
      const spamRows = (baro.spam_noise_sample || []).slice().reverse();
      const spamF = wallet === "all" ? spamRows : spamRows.filter((e) => e.wallet === wallet);
      events = spamF.concat(events);
    }
    const evBody = $("#baro-events-body");
    if (evBody) {
      evBody.innerHTML = events.slice(0, 200).map((e) => `<tr>
        <td class="mono text-muted">${escapeHtml(formatTs(e.ts))}</td>
        <td>${escapeHtml(e.wallet_label || e.wallet || "")}</td>
        <td><span class="baro-tag">${escapeHtml(e.type || "")}</span></td>
        <td>${escapeHtml((e.symbols || []).slice(0, 4).join(", ") || "—")}</td>
        <td class="right mono">${e.buy_usd != null ? fmtUSD(e.buy_usd, { cents: false }) : (e.usd_fuzzy ? "fuzzy" : "—")}</td>
        <td class="right mono">${e.sell_usd != null ? fmtUSD(e.sell_usd, { cents: false }) : "—"}</td>
        <td class="text-muted" style="font-size:11px">${escapeHtml((e.source || "").replace("_archive", ""))}</td>
      </tr>`).join("") || `<tr><td colspan="7" class="empty">No events for filter</td></tr>`;
    }
  }

  function formatAsOf(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }) + " ET";
  } catch (e) {
    return String(iso);
  }
}

function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---- Owner PIN (temporary interim gate) ---- */
  // TEMPORARY: plain compare for interim only. Default PIN: "view"
  const OWNER_PIN_TEMP = "view";

  function ownerGate() {
    const key = "cockpit_owner_ok_v1";
    const gate = $("#pin-gate");
    const app = $("#app-root");
    if (sessionStorage.getItem(key) === "1") {
      if (gate) gate.hidden = true;
      if (app) app.hidden = false;
      return true;
    }
    if (gate) gate.hidden = false;
    if (app) app.hidden = true;
    const form = $("#pin-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = $("#pin-input");
        const err = $("#pin-err");
        const val = (input && input.value) || "";
        if (val === OWNER_PIN_TEMP) {
          sessionStorage.setItem(key, "1");
          if (gate) gate.hidden = true;
          if (app) app.hidden = false;
          boot();
        } else if (err) {
          err.style.display = "block";
          err.textContent = "Wrong PIN. Temporary default is shown in the README.";
        }
      });
    }
    return false;
  }

  async function boot() {
    const loading = $("#loading");
    try {
      const book = await loadBook();
      window.__BOOK__ = book;
      setAsOf(book);
      if (PAGE === "overview" || PAGE === "owner") {
        renderOverview(book);
        if (book.barometer) {
          const banner = $("#interim-banner");
          if (banner && !banner.dataset.baro) {
            const b = book.barometer;
            const line = `Barometer: buys ${fmtUSD(b.all_time_buys_usd, { cents: false })} · sells ${fmtUSD(b.all_time_sells_usd, { cents: false })} · net ${fmtUSD(b.all_time_net_usd, { cents: false })} (as of ${(b.as_of_day || "").slice(0, 10)}).`;
            const existing = banner.innerHTML || "";
            banner.hidden = false;
            banner.innerHTML = (existing ? existing + " · " : "") + line + ' <a class="link-teal" href="barometer.html">Open</a>';
            banner.dataset.baro = "1";
          }
        }
      }
      if (PAGE === "consolidated") renderConsolidated(book);
      if (PAGE === "pnl") renderPnL(book);
      if (PAGE === "history") renderHistory(book);
      if (PAGE === "barometer") {
        const baro = await loadBarometer();
        window.__BARO__ = baro;
        if (baro.generated_at) {
          $all("[data-asof]").forEach((el) => {
            el.textContent = formatAsOf(baro.generated_at);
          });
        }
        renderBarometer(baro, book);
      }
      if (loading) loading.remove();
    } catch (err) {
      if (loading) {
        loading.textContent = "Failed to load data. Serve this folder over HTTP (see README). " + err.message;
      }
      console.error(err);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (IS_OWNER) {
      if (!ownerGate()) return;
    }
    boot();
  });
})();
