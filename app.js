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

  /** Refresh button: one cache-busting reload of the page. */
  function hardRefresh() {
    const params = new URLSearchParams(location.search);
    params.set("r", String(Date.now()));
    location.replace(location.pathname + "?" + params.toString() + location.hash);
  }
  window.hardRefresh = hardRefresh;

  // If landed with ?r=, force one busted data fetch then clean the URL
  if (new URLSearchParams(location.search).has("r")) {
    FORCE_BUST = true;
    try {
      const clean = location.pathname + location.hash;
      history.replaceState(null, "", clean);
    } catch (_) {}
  }

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
        <button class="btn btn-soft" type="button" onclick="hardRefresh(event)">Refresh</button>
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
    const note = $("#baro-note");
    const span = baro.span || {};
    const t = baro.totals || {};
    if (note) {
      note.textContent =
        "Barometer-grade · " +
        (span.first || "?") + " → " + (span.last || "?") +
        " · " + (t.event_count || 0).toLocaleString() + " events" +
        " · spam/noise bucket " + (baro.spam_noise_count || 0).toLocaleString() +
        " (toggle below). Explorers + archive; not tax-grade.";
    }

    const hero = $("#baro-hero");
    if (hero) {
      hero.hidden = false;
      const pnl = (baro.running_pnl && baro.running_pnl.headline) || {};
      hero.innerHTML = `
        <div class="hero-top">
          <div>
            <p class="label">All-time net (sells − buys)</p>
            <h2 class="total tabular ${pnlClass(t.all_time_net_usd)}">${fmtUSD(t.all_time_net_usd, { cents: false })}</h2>
            <p class="meta">Buys ${fmtUSD(t.all_time_buys_usd, { cents: false })} · Sells ${fmtUSD(t.all_time_sells_usd, { cents: false })}
              · Majors P&amp;L ${fmtUSD(pnl.total_pnl_usd, { cents: false })}</p>
          </div>
        </div>`;
    }

    // wallet picker
    const sel = $("#baro-wallet");
    if (sel && !sel.dataset.ready) {
      sel.innerHTML = `<option value="all">All wallets (roll-up)</option>` +
        (baro.wallets || []).map((w) =>
          `<option value="${escapeHtml(w.address)}">${escapeHtml(w.label || w.address)} · ${w.event_count || 0} ev</option>`
        ).join("");
      sel.dataset.ready = "1";
      sel.addEventListener("change", () => renderBarometerTables(__BARO__));
    }
    const spam = $("#baro-show-spam");
    if (spam && !spam.dataset.ready) {
      spam.dataset.ready = "1";
      spam.addEventListener("change", () => renderBarometerTables(__BARO__));
    }

    // type filter chips
    const typesWrap = $("#baro-type-filters");
    if (typesWrap && !typesWrap.dataset.ready) {
      const hist = baro.type_histogram || {};
      const keys = ["all", "swap", "transfer", "airdrop", "nft_mint", "nft_buy", "nft_sell", "lp_add", "lp_remove", "stake", "unstake"];
      typesWrap.innerHTML = keys.map((k) => {
        const n = k === "all" ? (t.event_count || 0) : (hist[k] || 0);
        return `<button type="button" class="chip baro-type${k === "all" ? " on" : ""}" data-type="${k}">${k}<strong class="val tabular">${n}</strong></button>`;
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
        const a = assets[sym];
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

    // Overview one-liner lives in book; optional banner already handled separately
    if (book && book.barometer && $("#interim-banner") && PAGE === "overview") {
      /* no-op here */
    }
  }

  function renderBarometerTables(baro) {
    if (!baro) return;
    const wallet = ($("#baro-wallet") && $("#baro-wallet").value) || "all";
    const showSpam = $("#baro-show-spam") && $("#baro-show-spam").checked;
    const typeF = __baroTypeFilter || "all";

    let days;
    if (wallet === "all") {
      days = baro.rollup || [];
    } else {
      days = (baro.by_wallet && baro.by_wallet[wallet]) || [];
    }

    // notable days
    const notable = (wallet === "all" ? (baro.notable_days || []) : [...days].sort((a, b) => Math.abs(b.net_usd) - Math.abs(a.net_usd)).slice(0, 40));
    const daysBody = $("#baro-days-body");
    if (daysBody) {
      daysBody.innerHTML = notable.slice(0, 25).map((r) => `<tr>
        <td class="mono">${escapeHtml(r.day)}</td>
        <td class="right mono">${fmtUSD(r.buys_usd, { cents: false })}</td>
        <td class="right mono">${fmtUSD(r.sells_usd, { cents: false })}</td>
        <td class="right mono ${pnlClass(r.net_usd)}">${fmtUSD(r.net_usd, { cents: false })}</td>
        <td class="right mono">${r.event_count || "—"}</td>
        <td class="text-muted" style="font-size:12px">${escapeHtml(r.notes || "")}</td>
      </tr>`).join("") || `<tr><td colspan="6" class="empty">No days</td></tr>`;
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
      </tr>`).join("") || `<tr><td colspan="7" class="empty">No daily rows</td></tr>`;
    }

    // spark bars for last ~90 days with activity
    const chart = $("#baro-chart");
    if (chart) {
      const series = days.filter((d) => d.buys_usd || d.sells_usd || d.net_usd).slice(-90);
      const maxAbs = Math.max(1, ...series.map((d) => Math.abs(d.net_usd || 0)));
      chart.innerHTML = series.map((d) => {
        const h = Math.max(2, Math.round((Math.abs(d.net_usd) / maxAbs) * 56));
        const cls = (d.net_usd || 0) >= 0 ? "up" : "down";
        return `<i class="baro-bar ${cls}" style="height:${h}px" title="${escapeHtml(d.day)}: net ${d.net_usd}"></i>`;
      }).join("");
    }

    // events
    let events = baro.recent_events || [];
    // Cap DOM for mobile speed
    // (full archive lives in journal snapshots)
    if (wallet !== "all") events = events.filter((e) => e.wallet === wallet);
    if (typeF !== "all") events = events.filter((e) => e.type === typeF);
    events = events.slice(0, 80);
    if (showSpam) {
      const spam = (baro.spam_noise_sample || []).slice().reverse();
      const spamF = wallet === "all" ? spam : spam.filter((e) => e.wallet === wallet);
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
