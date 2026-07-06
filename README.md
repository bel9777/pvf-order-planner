# PVF Order Planner

Monthly order planning tool for Park View Farm home-delivery customers.
Families answer five questions about how they eat; the planner turns that
into a month of breakfasts, dinners, and leftover lunches as a clickable
order list against live store inventory.

**Live app:** https://bel9777.github.io/pvf-order-planner/

## How it works

- `docs/` is the whole app (GitHub Pages, no build step): `index.html`,
  `style.css`, `app.js`, and `inventory.json`.
- `scraper/scrape.py` scrapes parkviewfamilyfarm.com category pages
  (schema.org microdata) into `docs/inventory.json`.
- `.github/workflows/scrape.yml` runs the scraper daily and commits the
  refreshed inventory. Sold-out products drop out of plans automatically.
- No cart API exists on GrazeCart, so each order line links to its product
  page; the customer adds items to their cart there.

## Key logic (docs/app.js)

- `META` — per-product meal knowledge: group (breakfast / chicken / pork /
  turkey / lamb / eggs / pantry), adult servings per package, leftover lunch
  servings, rotation priority. Unknown new products fall back to
  category + weight defaults so the daily scrape can't break the planner.
- `fillGroup()` — greedy variety fill; roughly one distinct cut per 2.5 meals.
- Delivery rules mirror the GrazeCart overrides: Rochester = first Saturday
  (second Saturday in July), Buffalo = third Saturday, order deadline
  Thursday 11:59 PM before delivery. $100 minimum, $20 fee, free at $200+.

## Local dev

```
py scraper/scrape.py          # refresh inventory
py -m http.server 8642 --directory docs
```
