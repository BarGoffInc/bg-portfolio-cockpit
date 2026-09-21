# Daily EOD activity archive

Reusable end-of-day layout for BG Portfolio Cockpit / Conviction journal.
Nightly job writes one folder per **America/New_York** calendar day.

## Layout

```
daily/
  YYYY-MM-DD/
    summary.json     # book totals, cash, day P/L vs prior EOD if known
    activity.json    # that day's buys/sells/transfers
    activity.md      # human one-pager
    book.json        # slim EOD book snapshot (latest / when available)
INDEX.md             # rolling last 60 day index
README.md            # this file
```

Absolute root (Conviction box): `/workspace/conviction/journal/daily/`

GitHub Pages mirror: `bargoffinc/bg-portfolio-cockpit` → `daily/`

Mac mirror: `/Users/bargoffinc/Desktop/BG-Portfolio-Cockpit/daily/`

## When

**11:59pm America/New_York** every day (user-locked; overnight is intentional for true EOD).

## Nightly command

```bash
python3 /workspace/conviction/cockpit/build_eod_daily.py
```

## Sources (in order)

1. Live APIs when healthy (Coinbase Advanced Trade, SnapTrade / broker exports, Hyperliquid)
2. Else latest `journal/snapshots/*` fills
3. Always merge `journal/fills.json` for manual gap fills
4. On-chain from barometer `events_normalized.json`
5. Slim `book.json` from `/workspace/conviction/cockpit/book.json`

## Write order

1. Create `daily/YYYY-MM-DD/`
2. `activity.json` → `activity.md` → slim `book.json` → `summary.json`
3. Update `INDEX.md`

## Rules

- **Idempotent:** re-run same day overwrites that folder; never invent fills or P/L.
- `vs_prior_eod_usd` is null unless prior day's `summary.json` exists and both NAVs are trusted.
- Fail soft: if a venue errors, write partial day with explicit `gaps[]`; non-zero exit only if zero venues succeeded.
- Day bucketing: convert all timestamps to America/New_York before assigning `day`.
- Deduplicate on trade_id / order_id / tid / tx hash / broker dedupe_key before write.

## summary.json / activity.json schemas

See `/workspace/conviction/journal/snapshots/eod-daily-schema.md` (canonical draft).

### Platform labels (stable)

- Coinbase, Robinhood, E*TRADE, Hyperliquid, Solana wallets, EVM wallets (<short label>), Journal/manual

### Side / counting

| Side / type | Counts toward buy_usd / sell_usd? |
|---|---|
| BUY / BTO / BTC | buy |
| SELL / STO / STC | sell |
| TRANSFER (own wallets) | no — list only |
| AIRDROP / NFT_MINT / LP_* / APPROVE / ASSIGN / EXPIRE | no — list with note |
| SWAP | attribute buy/sell when source provides; else list only |

## Alignment with 60-day report

Companions:

- `journal/snapshots/activity-60d-YYYY-MM-DD.{json,md,csv}`

Once nightly EOD is live, rebuild the 60-day report by concatenating the last 60 `activity.json` files rather than re-parsing every broker snapshot.

## Backfill

Initial seed (2026-07-23 → 2026-09-21, 61 days) from `activity-60d-2026-09-21.*`. Empty days have zero totals and empty `lines`. Only `2026-09-21` carries slim `book.json` + NAV in `summary.json`.
