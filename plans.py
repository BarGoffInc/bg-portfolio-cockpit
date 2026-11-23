#!/usr/bin/env python3
"""Append-only plan log for the Charts page (plans.json).

Every recommended level (buy rung, sell target, kill line, runner, re-buy rung, strength add,
option leg) is one entry. Entries are never edited or deleted: a status change appends to
status_history, and a revision adds new entries that list the old ids in `supersedes`
(the old ones get a 'superseded' status event). Fills are never typed in: `match` reads
book.json fills (broker/exchange APIs) and appends 'filled' / 'partially filled' events.

  python3 plans.py add --ticker VVV --kind buy_rung --price 25.85 --usd 1800 --units 70 --pct 20 \
      --trigger "resting limit" --notes "4h higher low" --set VVV-r3 --set-label "Revision 3"
  python3 plans.py status VVV-20261122-012 armed --note "limit placed on Coinbase"
  python3 plans.py supersede VVV-20261122-012 VVV-20261122-013 --by-set VVV-r3 --note "why"
  python3 plans.py event --ticker VVV --text "VVV ladder moved up after breakout"
  python3 plans.py match      # fill-backed status updates from book.json (run by the 3-hourly refresh)
  python3 plans.py bake       # daily candles -> candles/<TICKER>.json (Yahoo stocks, Coinbase crypto)
  python3 plans.py list [--ticker VVV] [--active]
"""
import argparse, datetime as dt, json, os, re, sys, urllib.request
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
PLANS = os.path.join(HERE, "plans.json")
BOOK = os.path.join(HERE, "book.json")
CANDLES = os.path.join(HERE, "candles")
ET = ZoneInfo("America/New_York")
KINDS = ["buy_rung", "rebuy_rung", "strength_add", "sell_target", "runner", "kill_line", "option"]
STATUSES = ["planned", "armed", "filled", "partially filled", "missed", "cancelled", "superseded"]
ACTIVE = {"planned", "armed", "partially filled"}
BUY_KINDS = {"buy_rung", "rebuy_rung", "strength_add"}
SELL_KINDS = {"sell_target", "runner", "kill_line"}
CB_PRODUCT = {}  # ticker -> Coinbase product override, e.g. {"JUPSOL": "SOL-USD"}


def now_et():
    return dt.datetime.now(ET).replace(microsecond=0)


def parse_at(s):
    if not s:
        return now_et()
    d = dt.datetime.fromisoformat(s)
    return d if d.tzinfo else d.replace(tzinfo=ET)


def et_label(d):
    return d.astimezone(ET).strftime("%b %-d, %Y %-I:%M %p ET")


def load():
    if os.path.exists(PLANS):
        return json.load(open(PLANS))
    return {"version": 1, "about": "Append-only plan log for charts.html. Edit only via plans.py.",
            "updated_at": None, "entries": [], "events": []}


def save(db):
    db["updated_at"] = now_et().isoformat()
    tmp = PLANS + ".tmp"
    with open(tmp, "w") as f:
        json.dump(db, f, indent=1, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, PLANS)


def find(db, pid):
    for e in db["entries"]:
        if e["id"] == pid:
            return e
    raise SystemExit(f"no plan entry {pid}")


def next_id(db, ticker, d):
    pre = f"{ticker}-{d.astimezone(ET):%Y%m%d}-"
    n = [int(e["id"].rsplit("-", 1)[1]) for e in db["entries"] if e["id"].startswith(pre)]
    return pre + f"{(max(n) + 1) if n else 1:03d}"


def add_entry(db, ticker, kind, price=None, price_hi=None, usd=None, units=None, unit_label=None,
              pct=None, trigger="", notes="", asset_type="stock", status="planned", set_id=None,
              set_label="", supersedes=None, at=None, source="", close_basis=None, size_note="",
              chart=True, **extra):
    if kind not in KINDS:
        raise SystemExit(f"kind must be one of {KINDS}")
    if status not in STATUSES:
        raise SystemExit(f"status must be one of {STATUSES}")
    d = parse_at(at) if isinstance(at, (str, type(None))) else at
    ticker = ticker.upper()
    e = {"id": next_id(db, ticker, d), "ticker": ticker, "asset_type": asset_type,
         "set": set_id or f"{ticker}-{d:%Y%m%d-%H%M}", "set_label": set_label,
         "created_at": d.isoformat(), "created_et": et_label(d), "kind": kind,
         "price": price, "price_hi": price_hi, "size_usd": usd, "size_units": units,
         "unit_label": unit_label, "size_note": size_note, "ladder_pct": pct,
         "close_basis": close_basis or ("weekly" if kind == "kill_line" else None),
         "trigger": trigger, "notes": notes, "source": source, "chart": chart,
         "supersedes": list(supersedes or []), "fills": [], "status": status,
         "status_history": [{"at": d.isoformat(), "status": status, "note": "created"}]}
    e.update(extra)
    db["entries"].append(e)
    for old in e["supersedes"]:
        set_status(db, old, "superseded", note=f"superseded by {e['id']}", at=d)
    return e


def set_status(db, pid, status, note="", at=None, fills=None, by="conviction"):
    if status not in STATUSES:
        raise SystemExit(f"status must be one of {STATUSES}")
    e = find(db, pid)
    d = parse_at(at) if isinstance(at, (str, type(None))) else at
    ev = {"at": d.isoformat(), "status": status, "note": note, "by": by}
    if fills:
        ev["fill_ids"] = fills
        e["fills"] = sorted(set(e["fills"]) | set(fills))
    e["status_history"].append(ev)
    e["status"] = status
    return e


def add_event(db, ticker, text, at=None, kind="note", ids=None):
    d = parse_at(at) if isinstance(at, (str, type(None))) else at
    db["events"].append({"at": d.isoformat(), "at_et": et_label(d), "ticker": ticker.upper(),
                         "kind": kind, "text": text, "ids": ids or []})


# ---------- fills ----------
OCC = re.compile(r"^([A-Z.]+)\s+(\d{6})([CP])(\d{8})$")


def underlying(sym):
    s = (sym or "").strip().upper()
    m = OCC.match(s)
    if m:
        return m.group(1), True
    if s.endswith("-PERP"):
        return s[:-5], False
    return s, False


def fill_id(f):
    return f.get("id") or f"{f.get('ts')}|{f.get('account')}|{f.get('symbol')}|{f.get('side')}|{f.get('qty')}|{f.get('price')}"


def match(db, book_path=BOOK, tol=0.01):
    """Assign API fills to active levels. Buy kinds: BUY at/below level (+1%). Sell targets/runner:
    SELL at/above level (-1%). Kill lines: SELL at/below level (+2%). Same underlying, after the plan
    was made, each fill used once. Options/perps only match option entries / are skipped."""
    book = json.load(open(book_path))
    fills = book.get("fills") or []
    used = {f for e in db["entries"] for f in e.get("fills", [])}
    changed = 0
    for e in db["entries"]:
        if e["status"] not in ACTIVE or e.get("price") is None:
            continue
        t0 = dt.datetime.fromisoformat(e["created_at"])
        hits = []
        for f in fills:
            fid = fill_id(f)
            if fid in used:
                continue
            u, is_opt = underlying(f.get("symbol"))
            if u != e["ticker"] or str(f.get("symbol", "")).upper().endswith("-PERP"):
                continue
            if is_opt != (e["kind"] == "option"):
                continue
            try:
                ft = dt.datetime.fromisoformat(f["ts"].replace("Z", "+00:00"))
                p = float(f.get("price") or 0)
            except Exception:
                continue
            if ft < t0 or p <= 0:
                continue
            side = (f.get("side") or "").upper()
            lo, hi = e["price"], e.get("price_hi") or e["price"]
            k = e["kind"]
            ok = (k in BUY_KINDS and side == "BUY" and p <= hi * (1 + tol)) or \
                 (k in ("sell_target", "runner") and side == "SELL" and p >= lo * (1 - tol)) or \
                 (k == "kill_line" and side == "SELL" and p <= hi * (1 + 2 * tol)) or \
                 (k == "option" and e.get("occ") and str(f.get("symbol")).replace(" ", "") == e["occ"].replace(" ", ""))
            if ok:
                hits.append((fid, abs(float(f.get("notional") or 0)), f))
        if not hits:
            continue
        ids = [h[0] for h in hits]
        used |= set(ids)
        filled_usd = sum(h[1] for h in hits) + (e.get("filled_usd") or 0)
        e["filled_usd"] = round(filled_usd, 2)
        target = e.get("size_usd") or 0
        status = "filled" if (not target or filled_usd >= 0.9 * target) else "partially filled"
        desc = "; ".join(f"{h[2].get('side')} {abs(float(h[2].get('qty') or 0)):g} @ ${float(h[2].get('price')):,.2f} ({h[2].get('account')})" for h in hits)
        set_status(db, e["id"], status, note=f"matched API fills: {desc}", fills=ids, by="match")
        add_event(db, e["ticker"], f"{e['ticker']} {kind_word(e['kind'])} ${e['price']:,g} {status} — {desc}", kind="fill", ids=[e["id"]])
        changed += 1
    return changed


def kind_word(k):
    return {"buy_rung": "buy rung", "rebuy_rung": "re-buy rung", "strength_add": "strength add",
            "sell_target": "sell target", "runner": "runner", "kill_line": "kill line", "option": "option leg"}[k]


# ---------- candles ----------
def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 bg-cockpit"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def bake(db):
    tickers = {}
    for e in db["entries"]:
        tickers.setdefault(e["ticker"], e["asset_type"])
    os.makedirs(CANDLES, exist_ok=True)
    done = []
    for t, at in sorted(tickers.items()):
        try:
            if at == "crypto":
                prod = CB_PRODUCT.get(t, f"{t}-USD")
                end = dt.datetime.now(dt.timezone.utc)
                rows = {}
                for _ in range(3):  # ~900 days
                    start = end - dt.timedelta(days=299)
                    data = _get(f"https://api.exchange.coinbase.com/products/{prod}/candles?granularity=86400"
                                f"&start={start:%Y-%m-%dT00:00:00Z}&end={end:%Y-%m-%dT23:59:59Z}")
                    for ts, lo, hi, op, cl, vol in data:
                        rows[dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime("%Y-%m-%d")] = [op, hi, lo, cl, vol]
                    if len(data) < 250:
                        break
                    end = start - dt.timedelta(days=1)
                src = f"Coinbase Exchange {prod} daily (UTC days)"
            else:
                j = _get(f"https://query1.finance.yahoo.com/v8/finance/chart/{t}?range=2y&interval=1d")
                r = j["chart"]["result"][0]
                q = r["indicators"]["quote"][0]
                rows = {}
                for i, ts in enumerate(r["timestamp"]):
                    o, h, l, c, v = (q[k][i] for k in ("open", "high", "low", "close", "volume"))
                    if None in (o, h, l, c):
                        continue
                    rows[dt.datetime.fromtimestamp(ts, ET).strftime("%Y-%m-%d")] = [o, h, l, c, v or 0]
                src = "Yahoo Finance daily"
            bars = [[d] + [round(x, 6) for x in rows[d]] for d in sorted(rows)]
            out = {"ticker": t, "asset_type": at, "source": src, "baked_at": now_et().isoformat(), "bars": bars}
            with open(os.path.join(CANDLES, f"{t}.json"), "w") as f:
                json.dump(out, f, separators=(",", ":"))
            done.append(f"{t}:{len(bars)}")
        except Exception as ex:  # keep the old file
            print(f"bake {t} failed: {ex}", file=sys.stderr)
    print("baked", " ".join(done))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    a = sp.add_parser("add")
    a.add_argument("--ticker", required=True); a.add_argument("--kind", required=True, choices=KINDS)
    a.add_argument("--price", type=float); a.add_argument("--price-hi", type=float)
    a.add_argument("--usd", type=float); a.add_argument("--units", type=float); a.add_argument("--unit-label")
    a.add_argument("--pct", type=float); a.add_argument("--trigger", default=""); a.add_argument("--notes", default="")
    a.add_argument("--asset-type", default="stock", choices=["stock", "etf", "crypto"])
    a.add_argument("--status", default="planned", choices=STATUSES)
    a.add_argument("--set"); a.add_argument("--set-label", default=""); a.add_argument("--supersedes", default="")
    a.add_argument("--at"); a.add_argument("--source", default=""); a.add_argument("--size-note", default="")
    s = sp.add_parser("status"); s.add_argument("id"); s.add_argument("status", choices=STATUSES)
    s.add_argument("--note", default=""); s.add_argument("--at")
    su = sp.add_parser("supersede"); su.add_argument("ids", nargs="+"); su.add_argument("--by-set", required=True)
    su.add_argument("--note", default=""); su.add_argument("--at")
    ev = sp.add_parser("event"); ev.add_argument("--ticker", required=True); ev.add_argument("--text", required=True); ev.add_argument("--at")
    sp.add_parser("match"); sp.add_parser("bake")
    li = sp.add_parser("list"); li.add_argument("--ticker"); li.add_argument("--active", action="store_true")
    o = ap.parse_args()
    db = load()
    if o.cmd == "add":
        e = add_entry(db, o.ticker, o.kind, o.price, o.price_hi, o.usd, o.units, o.unit_label, o.pct, o.trigger,
                      o.notes, o.asset_type, o.status, o.set, o.set_label,
                      [x for x in o.supersedes.split(",") if x], o.at, o.source, size_note=o.size_note)
        save(db); print(e["id"])
    elif o.cmd == "status":
        set_status(db, o.id, o.status, o.note, o.at); save(db)
    elif o.cmd == "supersede":
        for i in o.ids:
            set_status(db, i, "superseded", o.note or f"superseded by set {o.by_set}", o.at)
        save(db)
    elif o.cmd == "event":
        add_event(db, o.ticker, o.text, o.at); save(db)
    elif o.cmd == "match":
        n = match(db); save(db) if n else None; print(f"matched {n} plan entries")
    elif o.cmd == "bake":
        bake(db)
    elif o.cmd == "list":
        for e in db["entries"]:
            if (not o.ticker or e["ticker"] == o.ticker.upper()) and (not o.active or e["status"] in ACTIVE):
                print(f"{e['id']:<18} {e['kind']:<12} {e['price']!s:<9} {e['status']:<16} {e['set_label']}")


if __name__ == "__main__":
    main()
