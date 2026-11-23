#!/usr/bin/env python3
"""Export Perp Desk's hourly feed into cockpit-deploy/perps.json.

Reads ONLY /workspace/perp-desk/dashboard/data.json for recommendations
and performance (never raw ledgers, never chat-typed trades). Cross-checks
each idea against cockpit plans.json (active cash/book plans only) and
book.json (spot holdings). Called from build_v2_data.py on each 3-hourly
refresh; safe to run by hand. Does not edit Perp Desk files.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")

DATA = Path("/workspace/perp-desk/dashboard/data.json")
DEPLOY = Path("/workspace/conviction/cockpit-deploy")
PLANS = DEPLOY / "plans.json"
BOOK = DEPLOY / "book.json"
DEST = DEPLOY / "perps.json"

HEAVY_SPOT_USD = 2000.0
NEAR_SELL_PCT = 5.0
RUNG_MATCH_PCT = 3.0
INACTIVE = {"cancelled", "superseded", "missed", "expired"}

# Spot symbols that are just wrappers / LSTs of a base asset.
BASE_OF = {
    "WETH": "ETH",
    "STETH": "ETH",
    "WSTETH": "ETH",
    "WBTC": "BTC",
    "CBBTC": "BTC",
    "JUPSOL": "SOL",
}


def now_et() -> datetime:
    return datetime.now(ET)


def now_et_str() -> str:
    return now_et().strftime("%Y-%m-%d %H:%M:%S ET")


def money(x, dashes="—"):
    """USD with cents, thousands separators. None/non-numeric → dashes."""
    if x is None or x == "":
        return dashes
    try:
        n = float(x)
    except (TypeError, ValueError):
        return dashes
    sign = "-" if n < 0 else ""
    return f"{sign}${abs(n):,.2f}"


def money_signed(x, dashes="—"):
    if x is None or x == "":
        return dashes
    try:
        n = float(x)
    except (TypeError, ValueError):
        return dashes
    if n > 0:
        return f"+{money(n)}"
    if n < 0:
        return money(n)
    return money(0)


def px(x, dashes="—"):
    """Price: whole numbers have no decimals; otherwise strip trailing zeros."""
    if x is None or x == "":
        return dashes
    try:
        n = float(x)
    except (TypeError, ValueError):
        return dashes
    if abs(n - round(n)) < 1e-9:
        return f"{int(round(n)):,}"
    ax = abs(n)
    if ax >= 1:
        return f"{n:,.2f}".rstrip("0").rstrip(".")
    return f"{n:.6f}".rstrip("0").rstrip(".")


def px_list(vals):
    return " / ".join("$" + px(v) for v in vals if v is not None)


def pct(x, dashes="—"):
    if x is None or x == "":
        return dashes
    try:
        n = float(x)
    except (TypeError, ValueError):
        return dashes
    return f"{n:.1f}%"


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def display_coin(coin: str) -> str:
    c = (coin or "").strip()
    if c.lower().startswith("xyz:"):
        return c.split(":", 1)[1]
    return c


def book_ticker(coin: str, idea_id: str | None = None) -> str:
    c = display_coin(coin or idea_id or "").upper()
    if c.endswith("-HEDGE"):
        c = c[: -len("-HEDGE")]
    if c.startswith("BTC-"):
        c = "BTC"
    return c


def infer_side(item: dict) -> str:
    s = (item.get("side") or "").strip().lower()
    if s in ("long", "short"):
        return s
    rec = (item.get("recommend") or "").lower()
    role = (item.get("role") or "").lower()
    if "short" in rec or "hedge" in role or "hedge" in (item.get("id") or "").lower():
        # A named hedge ticket is a short unless side says otherwise.
        if "no_long" in rec:
            return "short"
        if role in ("hedge-watch", "hedge") or "hedge" in (item.get("id") or "").lower():
            return "short"
    return "long"


def cta_bucket(item: dict, kind: str) -> str:
    rec = (item.get("recommend") or "").strip().lower()
    status = (item.get("status") or "").strip().lower()
    if kind == "conditional" or status == "conditional" or (item.get("role") or "") == "conditional":
        return "waiting"
    if any(k in rec for k in ("skip", "no_ticket", "no_long")):
        return "stand_down"
    if status in ("standby",):
        return "stand_down"
    if status in ("armed", "place"):
        return "place_now"
    if status in ("watch", "watch-hedge", "watch-only"):
        # A hedge waiting on a price zone is "waiting"; a no-ticket watch is stand down.
        if rec in ("", "watch_only_until_zone", "watch"):
            return "waiting"
        return "stand_down"
    if status in ("available",):
        return "stand_down" if rec else "place_now"
    if kind == "hedge":
        return "waiting"
    return "waiting"


def slim_tp(tp):
    out = []
    for t in tp or []:
        if not isinstance(t, dict):
            continue
        out.append({
            "name": t.get("name"),
            "price": t.get("price"),
            "frac": t.get("frac"),
            "coins": t.get("coins_if_full") or t.get("coins"),
            "pnl_usd": t.get("pnl_usd"),
            "R": t.get("R") if t.get("R") is not None else t.get("r_multiple"),
        })
    return out


def target_prices(item: dict) -> list:
    tps = slim_tp(item.get("tp") or item.get("take_profits"))
    if tps:
        return [t["price"] for t in tps if t.get("price") is not None]
    raw = item.get("tps") or []
    return [p for p in raw if p is not None]


def idea_line(item: dict, side: str) -> str:
    coin = display_coin(item.get("coin") or item.get("id") or "")
    role = (item.get("role") or "")
    suffix = ""
    if "hedge" in role or "hedge" in (item.get("id") or "").lower():
        suffix = " (hedge)"
    rungs = item.get("rungs") or []
    stop = item.get("stop")
    targets = target_prices(item)
    lev = item.get("lev") or item.get("isolated_leverage")
    risk = item.get("risk_usd") if item.get("risk_usd") is not None else item.get("risk")
    parts = [f"{coin} {side}{suffix}"]
    if rungs:
        parts.append("rungs " + px_list(rungs))
    if stop is not None:
        parts.append("stop $" + px(stop))
    if targets:
        parts.append("targets " + px_list(targets))
    if lev:
        parts.append(f"{px(lev).replace('.00', '')}x" if isinstance(lev, (int, float)) else f"{lev}x")
        # pretty 3x not 3.00x
        if isinstance(lev, (int, float)) and float(lev) == int(float(lev)):
            parts[-1] = f"{int(float(lev))}x"
    if risk is not None:
        parts.append("risk " + money(risk))
    return " · ".join(parts)


# ── book + plans ──────────────────────────────────────────────────────────


def is_perp_prop(entry: dict) -> bool:
    blob = " ".join(
        str(entry.get(k) or "") for k in ("set", "set_label", "notes", "source")
    ).lower()
    return "perp" in blob


def is_option_symbol(sym: str) -> bool:
    s = (sym or "").strip()
    if " " in s and any(ch.isdigit() for ch in s):
        return True
    return False


def is_perp_symbol(sym: str) -> bool:
    su = (sym or "").upper()
    return "-PERP" in su or su.endswith(" PERP") or su.endswith("PERP")


def base_spot_ticker(sym: str, name: str | None = None) -> str | None:
    raw = (sym or "").strip()
    if not raw or is_option_symbol(raw) or is_perp_symbol(raw):
        return None
    if raw.lower().startswith("other"):
        return None
    su = raw.upper()
    if "JUPSOL" in su:
        return "SOL"
    if "SOL" in su and "STAKED" in su:
        return "SOL"
    if "ETH" in su and "STAKED" in su:
        return "ETH"
    # "JupSOL · LST"
    token = su.split("·")[0].split("(")[0].strip()
    token = token.split()[0] if token else su
    if token in BASE_OF:
        return BASE_OF[token]
    if token in ("USDC", "USD", "USDT", "DAI"):
        return None
    return token


def load_spot(book: dict) -> dict:
    """ticker -> {qty, mv, venues} from current positions only."""
    out = {}
    for venue, poses in (book.get("positions") or {}).items():
        if not isinstance(poses, list):
            continue
        for p in poses:
            if not isinstance(p, dict):
                continue
            if (p.get("kind") or "").lower() == "cash" and (p.get("symbol") or "").upper() == "USDC":
                continue
            tk = base_spot_ticker(p.get("symbol") or p.get("ticker") or "", p.get("name"))
            if not tk:
                continue
            rec = out.setdefault(tk, {"qty": 0.0, "mv": 0.0, "venues": []})
            qty = float(p.get("qty") or 0)
            mv = float(p.get("mv") or 0)
            rec["qty"] += qty
            rec["mv"] += mv
            rec["venues"].append({"venue": venue, "symbol": p.get("symbol"), "qty": qty, "mv": mv})
    return out


def load_book_plans(plans: dict) -> dict:
    """ticker -> {buys, sells, kills, holding_kills, events, no_sell} from active cash plans."""
    by = {}
    for e in plans.get("entries") or []:
        if not isinstance(e, dict):
            continue
        if (e.get("status") or "") in INACTIVE:
            continue
        if is_perp_prop(e):
            continue
        tk = (e.get("ticker") or "").upper()
        if not tk:
            continue
        rec = by.setdefault(
            tk,
            {"buys": [], "sells": [], "kills": [], "holding_kills": [], "runners": [], "notes": []},
        )
        kind = e.get("kind") or ""
        price = e.get("price")
        note = e.get("notes") or ""
        row = {"price": price, "kind": kind, "note": note, "set": e.get("set"), "status": e.get("status")}
        if kind == "buy_rung" or kind == "rebuy_rung":
            rec["buys"].append(row)
        elif kind == "sell_target":
            rec["sells"].append(row)
        elif kind == "runner":
            rec["runners"].append(row)
        elif kind == "kill_line":
            if "holdstop" in (e.get("set") or "") or "already held" in note.lower() or "protects" in note.lower():
                rec["holding_kills"].append(row)
            else:
                rec["kills"].append(row)
    # events (append-only notes, e.g. Pablo's SOL no-trim rule)
    no_sell = {}
    for ev in plans.get("events") or []:
        if not isinstance(ev, dict):
            continue
        tk = (ev.get("ticker") or "").upper()
        text = ev.get("text") or ""
        if not tk:
            continue
        blob = text.lower()
        if any(s in blob for s in ("no trim", "no sells", "no sell", "don't sell", "do not sell", "no selling")):
            no_sell[tk] = text
        by.setdefault(tk, {"buys": [], "sells": [], "kills": [], "holding_kills": [], "runners": [], "notes": []})
        by[tk].setdefault("event_texts", []).append(text)
    for tk, text in no_sell.items():
        by.setdefault(tk, {"buys": [], "sells": [], "kills": [], "holding_kills": [], "runners": [], "notes": []})
        by[tk]["no_sell"] = text
    return by


def near(a, b, pct_lim) -> bool:
    try:
        a, b = float(a), float(b)
    except (TypeError, ValueError):
        return False
    if a == 0 or b == 0:
        return False
    return abs(a - b) / abs(b) * 100.0 <= pct_lim


def rungs_overlap_buys(rungs, buys) -> bool:
    bpx = [b["price"] for b in buys if b.get("price") is not None]
    for r in rungs or []:
        for b in bpx:
            if near(r, b, RUNG_MATCH_PCT):
                return True
    return False


def mark_near_sell(mark, sells, runners) -> tuple[bool, float | None]:
    prices = [s["price"] for s in (sells or []) + (runners or []) if s.get("price") is not None]
    if mark is None:
        return False, None
    try:
        m = float(mark)
    except (TypeError, ValueError):
        return False, None
    best = None
    for p in prices:
        try:
            p = float(p)
        except (TypeError, ValueError):
            continue
        # "near a trim": within NEAR_SELL_PCT, typically just under a sell target
        dist = abs(m - p) / abs(p) * 100.0
        if dist <= NEAR_SELL_PCT and (best is None or dist < best[0]):
            best = (dist, p)
    if best:
        return True, best[1]
    return False, None


def fmt_levels(rows, fallback_prices=None):
    prices = [r["price"] for r in (rows or []) if r.get("price") is not None]
    if not prices and fallback_prices:
        prices = list(fallback_prices)
    return px_list(prices) if prices else ""


def book_plan_line(tk: str, rec: dict | None, no_sell_text: str | None) -> str:
    if no_sell_text and tk == "SOL":
        sells = fmt_levels((rec or {}).get("sells"))
        kill = fmt_levels((rec or {}).get("holding_kills") or (rec or {}).get("kills"))
        bits = ["Book: SOL core, no sells until $97 / $110 or new all-time highs"]
        if kill:
            bits.append("weekly kill " + kill)
        return "; ".join(bits) + "."
    if not rec or not any(rec.get(k) for k in ("buys", "sells", "kills", "holding_kills", "runners", "no_sell")):
        return "Book: no holding and no cash plan." if rec is None else "Book: no cash buy/sell plan."
    bits = [f"Book: {tk}"]
    buys = fmt_levels(rec.get("buys"))
    sells = fmt_levels((rec.get("sells") or []) + (rec.get("runners") or []))
    hold = fmt_levels(rec.get("holding_kills"))
    kill = fmt_levels(rec.get("kills"))
    if buys:
        bits.append("buy ladder " + buys)
    if sells:
        bits.append("sells " + sells)
    if hold:
        bits.append("holding stop " + hold)
    elif kill:
        bits.append("weekly kill " + kill)
    if rec.get("no_sell"):
        bits.append("no-sell rule in effect")
    if len(bits) == 1:
        return f"Book: {tk} has a plan on file, no live buy/sell levels."
    return ", ".join(bits) + "."


def align_idea(item: dict, side: str, spot: dict, plans_by: dict) -> dict:
    tk = book_ticker(item.get("coin") or "", item.get("id"))
    rec = plans_by.get(tk)
    held = spot.get(tk) or {"qty": 0.0, "mv": 0.0, "venues": []}
    spot_mv = float(held.get("mv") or 0)
    spot_qty = float(held.get("qty") or 0)
    notional = item.get("notional")
    try:
        notional_f = float(notional) if notional is not None else None
    except (TypeError, ValueError):
        notional_f = None
    mark = item.get("mark")
    rungs = item.get("rungs") or []
    no_sell = (rec or {}).get("no_sell")
    buys = (rec or {}).get("buys") or []
    sells = (rec or {}).get("sells") or []
    runners = (rec or {}).get("runners") or []
    near_sell, sell_px = mark_near_sell(mark, sells, runners)
    overlap = rungs_overlap_buys(rungs, buys)
    has_book_plan = bool(rec and (buys or sells or runners or rec.get("kills") or rec.get("holding_kills") or no_sell))
    has_spot = spot_mv >= HEAVY_SPOT_USD

    tag = None
    reason = ""

    if side == "short" and no_sell:
        tag = "CONFLICT"
        reason = f"Perp short against a core hold with a no-sell rule."
    elif side == "short" and has_spot and not (sells or runners):
        tag = "CONFLICT"
        reason = f"Perp short against a held book position with no trim plan on file."
    elif side == "long" and near_sell and not overlap and not buys:
        # Long into a book trim, and the book has no buy ladder (e.g. BTC T1 $65k).
        tag = "CONFLICT"
        reason = f"Perp long while the book's plan is to trim near ${px(sell_px)}."
    elif side == "long" and near_sell and not overlap and buys:
        # Book buys exist but at very different levels (e.g. MU cash $505 vs perp $668, T1 $720).
        tag = "CONFLICT"
        reason = (
            f"Perp long sits near the book's sell target ${px(sell_px)}, "
            f"and the rungs do not match the cash buy ladder."
        )
    elif side == "short" and (sells or runners):
        tag = "ALIGNED"
        reason = "Perp short supports a book trim / sell-zone plan."
    elif has_spot and side == "long":
        tag = "STACKED"
        reason = f"Adds a perp long on top of a spot holding of {money(spot_mv)}."
    elif side == "long" and (overlap or buys):
        tag = "ALIGNED"
        reason = "Perp long sits near the book's cash buy ladder." if overlap else "Book has a cash buy plan on this name."
    elif not has_book_plan and not has_spot:
        tag = None
        reason = "No cash holding and no cash plan to compare."
    else:
        tag = "ALIGNED" if has_book_plan else None
        reason = "Compared with the book's live plan." if has_book_plan else "No cash plan to compare."

    combined = None
    combined_note = None
    if notional_f is not None:
        combined = round(spot_mv + notional_f, 2)
        combined_note = (
            f"Spot {money(spot_mv)} + this ticket {money(notional_f)} notional if filled "
            f"= {money(combined)}"
        )
    elif has_spot:
        combined_note = f"Spot {money(spot_mv)}. No open perp on this name (book is flat on Hyperliquid)."

    plan_line = book_plan_line(tk, rec, no_sell)
    if has_spot:
        # Always mention the holding, including on CONFLICT tags.
        qty_txt = f"{spot_qty:.4f}".rstrip("0").rstrip(".")
        hold_bit = f" holds {qty_txt} ({money(spot_mv)})"
        if "Book: SOL core" in plan_line:
            plan_line = plan_line.replace("Book: SOL core", f"Book: SOL core, holds {qty_txt} ({money(spot_mv)})", 1)
        elif plan_line.startswith(f"Book: {tk}"):
            plan_line = plan_line.replace(f"Book: {tk}", f"Book: {tk}{hold_bit}", 1)
        else:
            plan_line = plan_line.rstrip(".") + f". Holds {qty_txt} ({money(spot_mv)})."
    elif not has_spot and plan_line == "Book: no cash buy/sell plan.":
        plan_line = "Book: no holding and no cash plan."

    return {
        "tag": tag,
        "tag_reason": reason,
        "plan_line": plan_line,
        "spot_ticker": tk,
        "spot_qty": round(spot_qty, 8) if spot_qty else 0,
        "spot_mv": round(spot_mv, 2),
        "perp_notional": notional_f,
        "combined_if_filled_usd": combined,
        "combined_note": combined_note,
    }


def pack_idea(item: dict, kind: str, spot: dict, plans_by: dict, extra=None) -> dict:
    side = infer_side(item)
    # Explicit short on a hedge dict
    if kind == "hedge" and (item.get("side") or "").lower() != "long":
        if "hedge" in (item.get("role") or "") or "hedge" in (item.get("id") or "").lower() or item.get("side") == "short":
            side = item.get("side") or "short"
    book = align_idea(item, side, spot, plans_by)
    # Book-strategy override: a CONFLICT short against a no-sell rule is Stand down,
    # even if Perp Desk called the hedge "eligible".
    bucket = cta_bucket(item, kind)
    if book.get("tag") == "CONFLICT" and side == "short" and bucket != "place_now":
        bucket = "stand_down"
    trigger = item.get("trigger")
    waiting_label = "Not placeable until trigger" if bucket == "waiting" else None
    out = {
        "id": item.get("id"),
        "coin": item.get("coin") or item.get("id"),
        "display": display_coin(item.get("coin") or item.get("id") or ""),
        "side": side,
        "role": item.get("role"),
        "grade": item.get("grade"),
        "status": item.get("status"),
        "status_now": item.get("status_now") or item.get("note"),
        "recommend": item.get("recommend"),
        "bucket": bucket,
        "kind": kind,
        "lev": item.get("lev") or item.get("isolated_leverage"),
        "rungs": item.get("rungs") or [],
        "coins": item.get("coins"),
        "avg": item.get("avg") or item.get("avg_entry"),
        "stop": item.get("stop"),
        "targets": target_prices(item),
        "tp": slim_tp(item.get("tp") or item.get("take_profits")),
        "liq": item.get("liq") or item.get("liq_price_full_fill") or item.get("liq_price_filled"),
        "risk_usd": item.get("risk_usd") if item.get("risk_usd") is not None else item.get("risk"),
        "margin": item.get("margin"),
        "notional": item.get("notional"),
        "blended_R": item.get("blended_R"),
        "mark": item.get("mark"),
        "trigger": trigger,
        "waiting_label": waiting_label,
        "reason": item.get("reason") or item.get("note"),
        "flags": item.get("flags"),
        "valid": item.get("valid"),
        "updated_et": item.get("updated_et") or item.get("snapshot_et"),
        "line": idea_line({**item, "side": side}, side),
        "book": book,
    }
    if extra:
        out.update(extra)
    return out


def pack_other_hedge(coin: str, row: dict, spot: dict, plans_by: dict) -> dict:
    """hedges.others entries are short notes, not full tickets."""
    rec = (row.get("recommend") or "").lower()
    status = (row.get("status") or "").lower()
    # Infer side: "no_long" / hedge-watch → short-or-none; no_ticket → none
    if "hedge" in status or rec == "no_long":
        side = "short"
        kind_side = "short (hedge)"
    else:
        side = "long"
        kind_side = "long"
    fake = {
        "id": coin,
        "coin": coin,
        "role": "hedge-watch",
        "status": row.get("status"),
        "recommend": row.get("recommend"),
        "mark": row.get("mark"),
        "reason": row.get("note"),
        "status_now": row.get("note"),
        "rungs": [],
        "stop": None,
        "tps": [],
        "lev": None,
        "risk_usd": None,
    }
    # Build a short line from what we have
    idea = pack_idea(fake, "hedge", spot, plans_by)
    idea["side"] = side
    bits = [f"{display_coin(coin)} {kind_side}"]
    if row.get("mark") is not None:
        bits.append("mark $" + px(row.get("mark")))
    idea["line"] = " · ".join(bits)
    # Re-align with the inferred side (pack_idea may have guessed)
    idea["book"] = align_idea(fake, side, spot, plans_by)
    if idea["book"].get("tag") == "CONFLICT" and side == "short":
        idea["bucket"] = "stand_down"
    return idea


def slim_paper_rec(r: dict) -> dict:
    return {
        "id": r.get("id"),
        "asset": r.get("asset"),
        "direction": r.get("direction"),
        "status": r.get("status"),
        "sent_at_et": r.get("sent_at_et_pretty") or r.get("sent_at_et"),
        "lev": r.get("isolated_leverage"),
        "avg_entry": r.get("avg_entry"),
        "stop": r.get("current_stop") or r.get("stop"),
        "mark": r.get("mark"),
        "open_coins": r.get("open_coins"),
        "realized_usd": r.get("realized_usd"),
        "unrealized_usd": r.get("unrealized_usd"),
        "funding_usd": r.get("funding_usd"),
        "total_usd": r.get("total_usd"),
        "total_R": r.get("total_R"),
        "n_rungs_filled": r.get("n_rungs_filled"),
        "n_rungs_total": r.get("n_rungs_total"),
        "take_profits": slim_tp(r.get("take_profits")),
    }


def slim_actual_trade(t: dict) -> dict:
    return {
        "id": t.get("id"),
        "date": t.get("closed_at_et_pretty") or t.get("closed_at_et"),
        "opened_at_et": t.get("opened_at_et_pretty") or t.get("opened_at_et"),
        "closed_at_et": t.get("closed_at_et_pretty") or t.get("closed_at_et"),
        "asset": t.get("asset"),
        "side": t.get("direction"),
        "size": t.get("entry_sz"),
        "entry": t.get("avg_entry"),
        "exit": t.get("avg_exit"),
        "realized_pnl_usd": t.get("realized_pnl_usd"),
        "net_pnl_usd": t.get("net_pnl_usd"),
        "fees_usd": t.get("fees_usd"),
        "funding_usd": t.get("funding_usd"),
        "R": t.get("R"),
        "result": t.get("result"),
        "status": t.get("status"),
        "account": t.get("account"),
        "stop": t.get("stop"),
    }


def build(data: dict, plans: dict | None, book: dict | None) -> dict:
    spot = load_spot(book or {})
    plans_by = load_book_plans(plans or {})
    action = data.get("action") or {}
    snap = action.get("snapshot") or {}
    account = snap.get("account") or {}
    place = snap.get("place_combination") or {}

    ideas = []
    seen = set()
    for t in action.get("tickets") or []:
        if not isinstance(t, dict):
            continue
        ideas.append(pack_idea(t, "ticket", spot, plans_by))
        seen.add(display_coin(t.get("coin") or t.get("id") or "").upper())
    for t in action.get("conditionals") or []:
        if not isinstance(t, dict):
            continue
        ideas.append(pack_idea(t, "conditional", spot, plans_by))
        seen.add(display_coin(t.get("coin") or t.get("id") or "").upper())
    hedges = action.get("hedges") or {}
    if isinstance(hedges, dict):
        for key, val in hedges.items():
            if key == "others" and isinstance(val, dict):
                for coin, row in val.items():
                    if display_coin(coin).upper() in seen:
                        continue  # already a live ticket (e.g. HYPE standby)
                    if not isinstance(row, dict):
                        continue
                    ideas.append(pack_other_hedge(coin, row, spot, plans_by))
                    seen.add(display_coin(coin).upper())
            elif isinstance(val, dict) and val.get("coin") or (isinstance(val, dict) and val.get("id")):
                disp = display_coin(val.get("coin") or val.get("id") or key).upper()
                # BTC long ticket already exists; still include the BTC short hedge (different side)
                ideas.append(pack_idea(val, "hedge", spot, plans_by))
    elif isinstance(hedges, list):
        for val in hedges:
            if isinstance(val, dict):
                ideas.append(pack_idea(val, "hedge", spot, plans_by))

    cta = {"place_now": [], "waiting": [], "stand_down": []}
    for idea in ideas:
        cta.setdefault(idea["bucket"], []).append(idea)

    paper = data.get("paper") or {}
    actual = data.get("actual") or {}
    comparison = data.get("comparison") or {}
    week = data.get("week") or {}

    paper_recs = [slim_paper_rec(r) for r in (paper.get("recommendations") or []) if isinstance(r, dict)]
    paper_closed = [slim_paper_rec(r) for r in (paper.get("closed_trades") or []) if isinstance(r, dict)]
    actual_trades = [slim_actual_trade(t) for t in (actual.get("trades") or []) if isinstance(t, dict)]
    # newest closed first for the log
    actual_trades_sorted = sorted(
        actual_trades,
        key=lambda t: t.get("closed_at_et") or "",
        reverse=True,
    )

    gaps = []
    if (comparison.get("actual_matched") == 0) or (comparison.get("recommendations_taken") == 0):
        gaps.append(
            "No actual Hyperliquid trade has matched a Perp Desk recommendation yet "
            f"({comparison.get('recommendations_taken', 0)} taken of "
            f"{comparison.get('recommendations_sent', 0)} sent; "
            f"{comparison.get('actual_matched', 0)} of {comparison.get('actual_trades', 0)} actual trades matched)."
        )
    if actual.get("avg_R_closed") is None:
        gaps.append(actual.get("avg_R_note") or "Actual trades have no R multiple until they are matched to a recommendation.")
    if paper.get("honest_note") or paper.get("week_pnl_note"):
        gaps.append("Paper week P&L is provisional (replay can flip fills when candles 429).")
    if actual.get("history_span_note"):
        gaps.append(actual["history_span_note"])
    if (account.get("main_perps_account_value_usd") == 0 and account.get("xyz_perps_account_value_usd") == 0
            and (account.get("spot_usdc_usd") or 0) > 0):
        gaps.append(
            "Hyperliquid perps clearinghouse is $0; the pool sits in spot USDC and must be transferred before isolated orders can be margined."
        )
    gaps.append(
        "Perp Desk rebuilds this feed hourly at :50, 6:50 AM–10:50 PM ET. "
        "Figures are as of the timestamps below, not live."
    )

    book_as_of = (book or {}).get("as_of_et") or (book or {}).get("as_of")
    plans_updated = (plans or {}).get("updated_at")

    def section_updated(block: dict) -> dict:
        return {
            "updated_at_et": block.get("updated_at_et"),
            "updated_at_et_pretty": block.get("updated_at_et_pretty"),
        }

    out = {
        "generated_at_et": data.get("generated_at_et"),
        "exported_at_et": now_et_str(),
        "timezone": data.get("timezone") or "America/New_York",
        "source": str(DATA),
        "read_only": True,
        "no_orders_placed": True,
        "book_as_of_et": book_as_of,
        "plans_updated_at": plans_updated,
        "refresh_note": "Perp Desk feed is rebuilt hourly at :50, 6:50 AM–10:50 PM ET.",
        "week": {
            "label": week.get("label"),
            "start_et": week.get("start_et_pretty") or week.get("start_et"),
            "end_et": week.get("end_et_pretty") or week.get("end_et"),
            "target_usd": week.get("target_usd"),
            "target_usd_display": money(week.get("target_usd")),
        },
        "account": {
            "snapshot_et": snap.get("snapshot_et"),
            "perps_main_usd": account.get("main_perps_account_value_usd"),
            "perps_xyz_usd": account.get("xyz_perps_account_value_usd"),
            "spot_usdc_usd": account.get("spot_usdc_usd"),
            "combined_usd": account.get("combined_usd"),
            "open_positions": (account.get("positions_main") or 0) + (account.get("positions_xyz") or 0),
            "open_orders": (account.get("open_orders_main") or 0) + (account.get("open_orders_xyz") or 0),
            "flat": ((account.get("positions_main") or 0) + (account.get("positions_xyz") or 0)) == 0,
            "note": account.get("note"),
            "place_now": place.get("place"),
            "skip": place.get("skip"),
            "combined_if_default": place.get("combined_if_default"),
        },
        "cta_counts": {
            "place_now": len(cta["place_now"]),
            "waiting": len(cta["waiting"]),
            "stand_down": len(cta["stand_down"]),
            "ideas": len(ideas),
        },
        "cta": cta,
        "paper": {
            "label": "PAPER",
            "provisional": True,
            **section_updated(paper),
            "source": paper.get("source"),
            "week_pnl_usd": paper.get("week_pnl_usd"),
            "week_pnl_display": money_signed(paper.get("week_pnl_usd")),
            "week_progress_pct": paper.get("week_progress_pct"),
            "week_progress_display": pct(paper.get("week_progress_pct")),
            "remaining_to_target_usd": paper.get("remaining_to_target_usd"),
            "total_usd": paper.get("total_usd"),
            "total_display": money_signed(paper.get("total_usd")),
            "realized_usd": paper.get("realized_usd"),
            "realized_display": money_signed(paper.get("realized_usd")),
            "unrealized_usd": paper.get("unrealized_usd"),
            "unrealized_display": money_signed(paper.get("unrealized_usd")),
            "funding_usd": paper.get("funding_usd"),
            "funding_display": money_signed(paper.get("funding_usd")),
            "hit_rate": paper.get("hit_rate"),
            "hit_rate_display": pct((paper.get("hit_rate") or 0) * 100 if (paper.get("hit_rate") is not None and paper.get("hit_rate") <= 1) else paper.get("hit_rate")),
            "avg_R_closed": paper.get("avg_R_closed"),
            "max_drawdown_usd": paper.get("max_drawdown_usd"),
            "max_drawdown_display": money(paper.get("max_drawdown_usd")),
            "max_drawdown_trough_et": paper.get("max_drawdown_trough_et_pretty") or paper.get("max_drawdown_trough_et"),
            "counts": paper.get("counts"),
            "week_pnl_note": paper.get("week_pnl_note"),
            "honest_note": paper.get("honest_note"),
            "recommendations": paper_recs,
            "closed_trades": paper_closed,
        },
        "actual": {
            "label": "ACTUAL",
            "provisional": False,
            **section_updated(actual),
            "source": actual.get("source"),
            "wallet": actual.get("wallet"),
            "equity": actual.get("equity"),
            "open_positions": actual.get("open_positions") or [],
            "week_pnl_usd": actual.get("week_pnl_usd"),
            "week_pnl_display": money_signed(actual.get("week_pnl_usd")),
            "week_progress_pct": actual.get("week_progress_pct"),
            "week_progress_display": pct(actual.get("week_progress_pct")),
            "week_realized_usd": actual.get("week_realized_usd"),
            "week_funding_usd": actual.get("week_funding_usd"),
            "week_fees_usd": actual.get("week_fees_usd"),
            "week_vs_target": (
                f"{money_signed(actual.get('week_pnl_usd'))} of {money(week.get('target_usd'))} this week"
            ),
            "total_usd": actual.get("total_usd"),
            "total_display": money_signed(actual.get("total_usd")),
            "realized_usd": actual.get("realized_usd"),
            "realized_display": money_signed(actual.get("realized_usd")),
            "unrealized_usd": actual.get("unrealized_usd"),
            "unrealized_display": money_signed(actual.get("unrealized_usd")),
            "funding_usd": actual.get("funding_usd"),
            "funding_display": money_signed(actual.get("funding_usd")),
            "funding_paid_usd": actual.get("funding_paid_usd"),
            "funding_received_usd": actual.get("funding_received_usd"),
            "fees_usd": actual.get("fees_usd"),
            "fees_display": money(actual.get("fees_usd")),
            "hit_rate": actual.get("hit_rate"),
            "hit_rate_closed": actual.get("hit_rate_closed"),
            "hit_rate_display": actual.get("hit_rate_closed") or pct((actual.get("hit_rate") or 0) * 100 if (actual.get("hit_rate") is not None and actual.get("hit_rate") <= 1) else actual.get("hit_rate")),
            "avg_R_closed": actual.get("avg_R_closed"),
            "avg_R_note": actual.get("avg_R_note"),
            "max_drawdown_usd": actual.get("max_drawdown_usd"),
            "max_drawdown_display": money(actual.get("max_drawdown_usd")),
            "max_drawdown_trough_et": actual.get("max_drawdown_trough_et_pretty") or actual.get("max_drawdown_trough_et"),
            "counts": actual.get("counts"),
            "history_span_note": actual.get("history_span_note"),
            "honest_note": actual.get("honest_note"),
            "trades": actual_trades_sorted,
            "trades_this_week": actual.get("trades_this_week") if not isinstance(actual.get("trades_this_week"), list) else len(actual.get("trades_this_week") or []),
        },
        "comparison": {
            **section_updated(comparison),
            "paper_week_pnl_usd": comparison.get("paper_week_pnl_usd"),
            "actual_week_pnl_usd": comparison.get("actual_week_pnl_usd"),
            "gap_week_usd": comparison.get("gap_week_usd"),
            "paper_total_usd": comparison.get("paper_total_usd"),
            "actual_total_usd": comparison.get("actual_total_usd"),
            "recommendations_sent": comparison.get("recommendations_sent"),
            "recommendations_taken": comparison.get("recommendations_taken"),
            "recommendations_not_taken": comparison.get("recommendations_not_taken"),
            "actual_trades": comparison.get("actual_trades"),
            "actual_matched": comparison.get("actual_matched"),
            "actual_unmatched": comparison.get("actual_unmatched"),
            "note": comparison.get("note"),
            "source": comparison.get("source"),
        },
        "gaps": gaps,
    }
    return out


def empty_payload(error: str) -> dict:
    return {
        "generated_at_et": None,
        "exported_at_et": now_et_str(),
        "timezone": "America/New_York",
        "source": str(DATA),
        "error": error,
        "cta": {"place_now": [], "waiting": [], "stand_down": []},
        "cta_counts": {"place_now": 0, "waiting": 0, "stand_down": 0, "ideas": 0},
        "paper": {"label": "PAPER", "provisional": True, "closed_trades": [], "recommendations": []},
        "actual": {"label": "ACTUAL", "provisional": False, "trades": [], "open_positions": []},
        "comparison": {},
        "gaps": [error],
    }


def main() -> int:
    dest = Path(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else DEST
    if not DATA.is_file():
        payload = empty_payload(f"Perp Desk feed not found at {DATA}")
        dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
        print(f"perps.py: missing feed, wrote stub -> {dest}", file=sys.stderr)
        return 0
    try:
        data = load_json(DATA)
    except Exception as e:
        payload = empty_payload(f"Could not read Perp Desk feed: {e}")
        dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
        print(f"perps.py: read failed, wrote stub -> {dest}", file=sys.stderr)
        return 0
    plans = None
    book = None
    try:
        plans = load_json(PLANS)
    except Exception as e:
        print(f"perps.py: plans.json skipped: {e}", file=sys.stderr)
    try:
        book = load_json(BOOK)
    except Exception as e:
        print(f"perps.py: book.json skipped: {e}", file=sys.stderr)
    payload = build(data, plans, book)
    dest.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    c = payload["cta_counts"]
    act = payload["actual"]
    print(
        f"perps: {c['place_now']} place / {c['waiting']} waiting / {c['stand_down']} stand-down "
        f"-> {dest} (actual realized {act.get('realized_display')}, "
        f"win rate {act.get('hit_rate_display')}, feed {payload.get('generated_at_et')})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
