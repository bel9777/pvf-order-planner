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

- Live recalculation: after the first "Build my order," every input change
  rebuilds the list immediately (button becomes "Rebuild my order").
  Rebuilds intentionally reset manual swaps/removes.
- Total card now carries the month framing + per-plate line: "One delivery
  covers about N dinners, M breakfasts and L lunches of leftovers... about
  $X.XX a plate" (meat cost / all meat servings incl. leftovers; eggs and
  stock excluded from plate math).
- Copy pass: "with our meat" on both meal steppers (fish/beef nights
  excluded by wording), plainer section header.

- Dinners question reframed after Brian's test: it now asks for dinners
  built around farm meat, not all home cooking ("Pasta night and leftovers
  night don't need us"), default 3/week. Brian's $731 test build was correct
  math but assumed farm meat at every home dinner.
- Deploy note: `git push` must be run from PowerShell on Brian's machine
  (Bash tool can't run credential helpers).

## One-click cart fill — VERIFIED end-to-end (2026-07-06)

- `addAllToCart()` in app.js: same-origin only. Per plan line: fetch
  `/store/product/<slug>`, lift the `theme.add-product-button` component's
  `wire:snapshot`, POST `/livewire/update` with qty stacked `addToCart(id)`
  calls + CSRF from `#csrfToken`. One POST per product carries full qty
  (verified: 2 stacked calls -> cart line (2)).
- Verified live on parkviewfamilyfarm.com with Brian's signed-in session:
  button filled cart and redirected to /cart. Signed-out flow verified too
  (friendly message; GrazeCart customer sessions expire aggressively).
- `embed.js`: two-line paste for a GrazeCart custom page
  (`<div id="pvf-order-planner"></div>` + script tag) pulls markup/styles/
  logic from GitHub Pages; site header unaffected; planner looks native.
- On github.io the button stays hidden (link-list fallback).
- Fragility note: this rides GrazeCart's internal Livewire mechanism —
  a platform update could break the button; fallback is the link list.
- **PAGE IS LIVE (2026-07-06): https://parkviewfamilyfarm.com/order-planner**
  (GrazeCart admin page id 7, HTML widget with the two-line embed snippet).
  UNLINKED — not in site nav yet, pending Brian's click-through sign-off.
  Launch next: nav link, July delivery email, QR card at Brighton booth.

## Brand inheritance + card cleanup (2026-07-06, after Brian's review)

- Embedded page inherits GrazeCart theme tokens (`--action-color`,
  `--text-color` from theme-variables.css) so a site rebrand carries over
  automatically; github.io keeps its own fallbacks (cream bg standalone
  only, white when embedded).
- Per-line qty stepper (Brian request): − / + on every order line, live
  totals/covers/per-plate recalc; minus floors at 1, remove stays explicit.
- How-to card on-site = one button + one deadline sentence; manual steps
  and "Open the store" are github.io-only. Gotcha fixed: our display rules
  beat the `hidden` attribute until `[hidden]{display:none!important}`.
- github.io assets cache for 10 min (Pages max-age=600) — after a deploy,
  the embedded page can serve stale CSS/JS briefly; it self-heals.

## Open items

- Not yet linked from parkviewfamilyfarm.com or announced to customers.
  Ideas: link in monthly delivery email, GrazeCart nav, or QR at market.
- Serving/leftover numbers in `META` are informed estimates. Brian should
  gut-check bacon (4 servings/lb) and the turkey rotation.
- December 2026 Rochester date: rule says Dec 5 (matches the override
  added 2026-07-04). GrazeCart January override maintenance still manual.
- Consider a shareable link that encodes the plan (query params) so
  customers can send their list to a spouse.
