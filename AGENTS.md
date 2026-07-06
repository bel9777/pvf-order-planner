# PVF Order Planner — agent guide

This file mirrors CLAUDE.md for non-Claude agents. Read CLAUDE.md — it is
the single source of truth for rules in this repo. Summary:

- Read `docs/current-state.md` first.
- `docs/` is the live GitHub Pages site; no build step; don't add frameworks.
- Never hand-edit `docs/inventory.json` (machine-written by the daily scraper).
- Delivery-date logic in `docs/app.js` must stay in sync with GrazeCart
  schedule overrides (Rochester 1st Sat, July = 2nd Sat; Buffalo 3rd Sat).
- Customer-facing copy follows the PVF brand voice: plain, warm, no hype.
- Pushing to main publishes the site. Confirm with Brian first.
- End every session by updating `docs/current-state.md`.
