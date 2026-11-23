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

## Watchlist adds (from the Score a ticker page)

The official watchlist the cockpit shows is `watchlist.json`, published from the box file `journal/cockpit-watchlist.json` by `journal/scripts/build_watchlist.py`. The old Overview page renders it. The weekly rescore should also read it: after each publish, `ranking/watchlist-to-score.json` lists watchlist names that are not yet on the ranking board.

The site is static GitHub Pages, so a click on **Add to watchlist** cannot write the repo.

What we do instead:

1. **Instant UI (this device).** Adds and removes are saved in `localStorage` under `bg-wl-queue` and show up immediately as "On watchlist" (with a Remove control) on the Score a ticker board, on a hand-scored ticker report, and on the Overview watchlist.
2. **Pending queue on the box.** The same add/remove shape lives in `journal/watchlist-pending.json` (copied to `watchlist-pending.json` in this repo so the page can also show items already queued). There is no public webhook, so a browser click does not write this file by itself. Conviction (or anyone with box access) copies the device queue into `journal/watchlist-pending.json`.
3. **Refresh merge.** The 3-hourly book refresh runs `build_v2_data.py`, which calls `build_watchlist.py`. That script merges pending adds/removes into `journal/cockpit-watchlist.json`, republishes `watchlist.json`, clears the pending file, writes `ranking/watchlist-to-score.json`, and (when `--push` is used) commits `watchlist.json` and `watchlist-pending.json`.

Until a name is merged into `watchlist.json`, the weekly rescore will not see it automatically. After the merge, include every ticker in `ranking/watchlist-to-score.json` → `on_watchlist_not_on_board` on the next Sunday rescore.

