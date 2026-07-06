# PVF Order Planner — agent guide

Read `docs/current-state.md` first for where things stand.

## What this is

Static planner app for Park View Farm monthly home delivery. Customers
answer household/meal questions, get a clickable order list. Serves the
farm goal: grow online + delivery revenue by removing "blank store, guess
what you need" friction.

## Rules

- `docs/` is the deployed site (GitHub Pages). No build step, no framework.
  Keep it that way unless Brian asks.
- `docs/inventory.json` is machine-written by `scraper/scrape.py` (daily
  GitHub Action). Never hand-edit it; fix the scraper instead.
- Delivery date rules in `app.js` mirror the GrazeCart schedule overrides
  (see the pvf-delivery-schedule memory / shared brain): Rochester = 1st
  Saturday but 2nd Saturday in July; Buffalo = 3rd Saturday; deadline =
  Thursday 11:59 PM before. If Brian changes the route schedule, this file
  and GrazeCart must change together.
- Meal math lives in `META` + `fillGroup()` in `app.js`. New store products
  work automatically via fallbacks, but add a proper `META` entry (group,
  servings, leftovers, rotate) when a real cut shows up.
- Voice for any customer-facing copy: PVF brand voice (plain, warm, no
  hype, no AI tells, no em-dash chains). Brand tokens in `style.css` come
  from the PVF Brand Identity guide.
- Publishing changes to the live site = pushing to main. That is
  customer-facing; confirm with Brian before pushing copy or logic changes.

## End of session

Update `docs/current-state.md` and Brian's memory/shared brain per his
handoff discipline.
