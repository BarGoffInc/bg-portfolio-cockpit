#!/usr/bin/env python3
"""Max Buy house recipe (CON-31, approved by Pablo Nov 25 2026) — shared by plan-alarm.py, the engine and the apply script.

Trigger: a Gemini weekly MAX BUY on a CLOSED week (maxbuy-labels.json, confirmed:true). Rung 1 buys at that weekly close
(in practice the next open). Stocks: 40/20/20/20 of the name's budget; adds 2-4 fire only on a WEEKLY CLOSE below BOTH the
Max Buy close and the lowest price paid so far; max 4 buys. Crypto: 40% at the Max Buy close, then 10% of budget on every
qualifying weekly close, stop at 2x budget. No hard stop: the weekly-close cut line is the thesis-break exit (alert only).
Weekly close = stocks: last daily close of the week (Fri 4 PM ET, 1 PM on early-close days); crypto: the Sunday UTC daily
candle close = Sunday 7 PM ET (Mon 00:00 UTC).
Campaign fills come only from book.json fills (broker / exchange API pulls): BUY fills of the ticker (spot, -PERP, or a call
on the underlying) at or after the Max Buy week's close."""
import json, os, re, datetime as dt
from zoneinfo import ZoneInfo
HERE = os.path.dirname(os.path.abspath(__file__))
ET = ZoneInfo("America/New_York"); UTC = dt.timezone.utc
VERSION = "mbr-2026-11-25"
STOCK_W = [40, 20, 20, 20]          # % of budget per buy, max 4 buys
CRYPTO_FIRST, CRYPTO_ADD, CRYPTO_CAP = 40, 10, 200   # % of budget; stop adding at 2x budget
OCC = re.compile(r"^([A-Z.]+)\s+(\d{6})([CP])(\d{8})$")


def J(p):
    try:
        return json.load(open(p))
    except Exception:
        return None


def labels(path=None):
    d = J(path or os.path.join(HERE, "maxbuy-labels.json")) or {"prints": []}
    return d.get("prints", [])


def week_close_ts(week_end, cls):
    """Epoch seconds when the week ending `week_end` (YYYY-MM-DD; Fri for stocks, Sun for crypto) closed."""
    d = dt.date.fromisoformat(week_end)
    if cls == "crypto":
        sun = d + dt.timedelta(days=(6 - d.weekday()) % 7)
        return int(dt.datetime.combine(sun + dt.timedelta(days=1), dt.time(0, 0), UTC).timestamp())
    fri = d + dt.timedelta(days=(4 - d.weekday()) % 7) if d.weekday() <= 4 else d
    return int(dt.datetime.combine(fri, dt.time(16, 0), ET).timestamp())


def latest_print(t, cls, prints=None):
    """Newest confirmed closed-week Max Buy for ticker t, plus any pending (open-week) label."""
    P = [p for p in (prints if prints is not None else labels()) if p["t"].upper() == t.upper()]
    conf = sorted([p for p in P if p.get("confirmed") and p.get("close")], key=lambda p: p["week_end"])
    pend = sorted([p for p in P if p.get("pending")], key=lambda p: p["week_end"])
    mb = dict(conf[-1]) if conf else None
    if mb:
        mb["close_ts"] = week_close_ts(mb["week_end"], cls)
    return mb, (pend[-1] if pend else None), [p for p in P if not p.get("confirmed") and not p.get("pending")]


def underlying(sym):
    s = (sym or "").strip().upper()
    m = OCC.match(s)
    if m:
        return m.group(1), "option"
    if s.endswith("-PERP"):
        return s[:-5], "perp"
    return re.sub(r"\s*\(.*\)$", "", s).replace("XYZ:", ""), "spot"


def campaign_fills(t, since_ts, book=None, aliases=()):
    """BUY fills (API) for ticker t at/after since_ts. Options only count if they are calls."""
    book = book or J(os.path.join(HERE, "book.json")) or {}
    names = {t.upper(), *[a.upper() for a in aliases]}
    out = []
    for f in book.get("fills") or []:
        u, k = underlying(f.get("symbol"))
        if u not in names or (f.get("side") or "").upper() != "BUY":
            continue
        if k == "option":   # recipe calls are 12-18 months out: skip puts and short-dated calls (e.g. buying back a covered call)
            m = OCC.match(f["symbol"].strip().upper())
            try:
                exp = dt.datetime.strptime(m.group(2), "%y%m%d").replace(tzinfo=UTC).timestamp()
                fts = dt.datetime.fromisoformat(str(f["ts"]).replace("Z", "+00:00")).timestamp()
            except Exception:
                continue
            if m.group(3) != "C" or exp - fts < 180 * 86400:
                continue
        try:
            ts = dt.datetime.fromisoformat(str(f["ts"]).replace("Z", "+00:00")).timestamp()
            p = float(f.get("price") or 0)
        except Exception:
            continue
        if ts >= since_ts and p > 0:
            out.append(dict(ts=ts, price=p, kind=k, qty=abs(float(f.get("qty") or 0)),
                            usd=abs(float(f.get("notional") or 0)) or abs(float(f.get("qty") or 0)) * p * (100 if k == "option" else 1),
                            account=f.get("account"), symbol=f.get("symbol")))
    return sorted(out, key=lambda x: x["ts"])


def weekly_closes(rows, cls, now=None):
    """rows = [[ts,o,h,l,c,v],...] daily (engine data_live format). Returns closed weeks [(week_end_date, close, close_ts)]."""
    now = now or dt.datetime.now(UTC).timestamp()
    wk = {}
    for r in rows:
        ts, c = int(r[0]), r[4]
        if not c:
            continue
        d = dt.datetime.fromtimestamp(ts, UTC if cls == "crypto" else ET).date()
        k = d.isocalendar()[:2]
        if k not in wk or d >= wk[k][0]:
            wk[k] = (d, float(c))
    out = []
    for k in sorted(wk):
        d, c = wk[k]
        y, w = k
        if cls == "crypto":
            sun = dt.date.fromisocalendar(y, w, 7)
            cts = week_close_ts(str(sun), "crypto")
            if d != sun:      # Sunday UTC bar missing -> week not complete (or feed gap): skip
                continue
            we = sun
        else:
            fri = dt.date.fromisocalendar(y, w, 5)
            cts = week_close_ts(str(fri), "stock")
            we = d
        if cts + 600 <= now:
            out.append((str(we), c, cts))
    return out


def state(t, cls, budget, rows=None, book=None, prints=None, aliases=(), now=None):
    """Campaign state for one name: Max Buy, API fills since the Max Buy close, lowest paid, buys used, next add."""
    mb, pend, unconf = latest_print(t, cls, prints)
    s = dict(t=t, cls=cls, budget=budget, mb=mb, pending=pend, unconfirmed=unconf, fills=[], buys=0, deployed=0.0,
             lowest=None, threshold=None, can_add=False, next_usd=None, next_n=None, cap_usd=None)
    if not mb:
        return s
    F = campaign_fills(t, mb["close_ts"], book, aliases)
    s["fills"] = F
    # a 'buy' = one week bucket with API buy fills (several fills in a week = one tranche)
    weeks = sorted({dt.datetime.fromtimestamp(f["ts"], UTC).isocalendar()[:2] for f in F})
    s["buys"] = len(weeks)
    s["deployed"] = round(sum(f["usd"] for f in F), 2)
    px = [f["price"] for f in F if f["kind"] != "option"]
    s["lowest"] = min(px) if px else None
    s["threshold"] = min([mb["close"]] + ([s["lowest"]] if s["lowest"] else []))
    if cls == "crypto":
        s["cap_usd"] = budget * CRYPTO_CAP / 100
        s["next_usd"] = budget * (CRYPTO_FIRST if not F else CRYPTO_ADD) / 100
        s["can_add"] = bool(F) and s["deployed"] + s["next_usd"] <= s["cap_usd"] + 1
    else:
        s["cap_usd"] = budget
        s["next_n"] = min(s["buys"] + 1, 4)
        s["next_usd"] = budget * STOCK_W[min(s["buys"], 3)] / 100
        s["can_add"] = bool(F) and s["buys"] < 4
    return s


def max_leverage(entry, cut, mmr=0.02):
    """Highest leverage that keeps an isolated long's liquidation below the cut line, with a 10% safety haircut."""
    if not entry or not cut or cut >= entry:
        return None
    raw = 1.0 / ((entry - cut) / entry + mmr)
    return max(1.0, round(raw * 0.9, 1))
