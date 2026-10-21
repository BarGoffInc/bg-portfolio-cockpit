# BG Portfolio Cockpit

Shared live book for the Manager and the Owner. One site, view-only numbers (no trading, no API keys).

Open: https://bargoffinc.github.io/bg-portfolio-cockpit/

## Buyer tags

Holdings and fills can show a small badge:

- **A** — bought by the account Owner
- **P** — bought by Manager
- **++** — both have bought that holding

Blank means not yet attributed. Tags live in `attribution.json` and are stamped onto `book.json` on each refresh.
