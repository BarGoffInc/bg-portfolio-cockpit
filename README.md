# BG Portfolio Cockpit

Shared live book for the Manager and the Owner. One site, view-only numbers (no trading, no API keys).

Open: https://bargoffinc.github.io/bg-portfolio-cockpit/

## Buyer tags

Holdings and fills can show a small badge:

- **A** — bought by the account Owner
- **P** — bought by Manager
- **++** — both have bought that holding

Blank means not yet attributed. Tags live in `attribution.json` and are stamped onto `book.json` on each refresh.

## Charts page and the plan log

`charts.html` draws every recommended level on a candlestick chart: green buy rungs, orange sell targets, a dashed red kill line (weekly close), dotted grey lines for replaced plans (over the dates they were live), ● where a plan was made or revised, and ▲▼ where real fills happened.

- **`plans.json`** is the plan log. It's append-only, and only `plans.py` writes to it. Entries are never edited or deleted. A status change adds to `status_history`. A revision adds new entries with `supersedes: [old ids]`, which marks the old ones `superseded`.
- **Statuses:** planned, armed, filled, partially filled, missed, cancelled, superseded.
- **Fills are never typed in.** `plans.py match` reads `book.json` fills from the account APIs. A fill on the same ticker, after the plan was made, on the right side and at the level (±1%) moves the level to filled or partially filled, keeps the fill ids and adds a timeline line.
- **Candles:** `plans.py bake` writes `candles/<TICKER>.json` (Yahoo daily for stocks, Coinbase for crypto). The page also pulls live Coinbase candles for crypto.
- The 3-hourly refresh (`build_v2_data.py`) runs `match` and `bake`, then pushes `plans.json` and `candles/`.

How Conviction logs a change (then commit and push `plans.json`):

```
python3 plans.py add --ticker VVV --asset-type crypto --kind buy_rung --price 25.85 --usd 1800 --units 70 --pct 20 \
  --trigger "tag + washed RSI18 or bullish divergence" --notes "4h higher low" \
  --set VVV-r3-20261124 --set-label "Revision 3" --supersedes VVV-20261122-017
python3 plans.py status VVV-20261122-018 armed --note "GTC limit placed on Coinbase"   # or cancelled / missed
python3 plans.py supersede VVV-20261122-019 VVV-20261122-020 --by-set VVV-r3-20261124 --note "why"
python3 plans.py event --ticker VVV --text "Nov 24: VVV ladder raised after the breakout held"
python3 plans.py list --ticker VVV --active
```

Kinds: `buy_rung`, `rebuy_rung`, `strength_add`, `sell_target`, `runner`, `kill_line`, `option`.
