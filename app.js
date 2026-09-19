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

  async function loadBook() {
    const res = await fetch("book.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load book.json (" + res.status + ")");
    return res.json();
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
        <button class="btn btn-soft" type="button" onclick="location.reload()">Refresh</button>
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

  function renderLargest(book) {
    const list = $("#holdings-list");
    const donut = $("#donut");
    const items = book.largest_holdings || [];
    const total = (book.totals && book.totals.book_usd) || 1;
    if (list) {
      list.innerHTML = items
        .map((h, i) => {
          const w = h.weight_pct != null ? h.weight_pct : (h.mv / total) * 100;
          return `<div class="list-row">
            <i class="swatch" style="background:${SWATCHES[i % SWATCHES.length]}"></i>
            <strong style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(h.symbol)}</strong>
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
    const shown = rows.slice(0, 500);
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
      if (PAGE === "overview" || PAGE === "owner") renderOverview(book);
      if (PAGE === "consolidated") renderConsolidated(book);
      if (PAGE === "pnl") renderPnL(book);
      if (PAGE === "history") renderHistory(book);
      if (loading) loading.remove();
    } catch (err) {
      if (loading) {
        loading.textContent = "Failed to load book.json. Serve this folder over HTTP (see README). " + err.message;
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
