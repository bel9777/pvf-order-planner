# Current state — PVF Order Planner

Updated: 2026-07-06 (initial build session, Claude Fable)

## Status: built, tested locally, deploying

- Scraper works against the live store: 50 unique products across 7
  categories, sold-out detection verified (lamb all out, shoulder steaks,
  turkey ground/thighs). Dedupe handles items listed in two categories
  (freezer bundles appear under both freezer-bundles and pork).
- App tested in local preview: default family build, small sub-$100 build,
  swap (recomputes qty to cover same servings), remove, mobile viewport,
  zone switching. Delivery dates verified against the live site banner
  (Rochester Jul 11 / deadline Jul 9; Buffalo Jul 18 / deadline Jul 16).
- Prices refreshed 2026-07-06 vs the May design snapshot (several changed —
  whole bird now $7.50/lb @ 4 lb avg).

## Decisions this session

- Variety rule: about one distinct cut per 2.5 meals per group, so small
  households get the farm's default picks instead of one of everything.
- Kids count as 0.6 adult servings.
- Freezer bundles, hog deposit, and Farm Supporter Program are excluded
  from meal math (`group: "other"`).

## Post-launch tweaks (2026-07-06, same day)

- Dinners question reframed after Brian's test: it now asks for dinners
  built around farm meat, not all home cooking ("Pasta night and leftovers
  night don't need us"), default 3/week. Brian's $731 test build was correct
  math but assumed farm meat at every home dinner.
- Deploy note: `git push` must be run from PowerShell on Brian's machine
  (Bash tool can't run credential helpers).

## Open items

- Not yet linked from parkviewfamilyfarm.com or announced to customers.
  Ideas: link in monthly delivery email, GrazeCart nav, or QR at market.
- Serving/leftover numbers in `META` are informed estimates. Brian should
  gut-check bacon (4 servings/lb) and the turkey rotation.
- December 2026 Rochester date: rule says Dec 5 (matches the override
  added 2026-07-04). GrazeCart January override maintenance still manual.
- Consider a shareable link that encodes the plan (query params) so
  customers can send their list to a spouse.
