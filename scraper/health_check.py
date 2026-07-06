"""Outside-in health check for the PVF Order Planner.

Probes the LIVE system the way a customer reaches it — github.io assets,
the embedded page on parkviewfamilyfarm.com, the nav link, inventory
freshness, and the GrazeCart Livewire preconditions the one-click cart
button depends on. Run twice daily by .github/workflows/health.yml;
failures open a GitHub issue on this repo.

Local run:  py scraper/health_check.py
Exit code:  0 = all healthy, 1 = one or more failures.
"""

import json
import os
import sys
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

APP = "https://bel9777.github.io/pvf-order-planner/"
FARM = "https://parkviewfamilyfarm.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PVF-HealthCheck/1.0"
}
MAX_INVENTORY_AGE_HOURS = 30  # scrape runs daily; one missed run trips this
NON_FOOD = {"farm-supporter-program"}

results = []  # (ok, name, detail)


def check(name):
    def wrap(fn):
        def run():
            try:
                detail = fn()
                results.append((True, name, detail or "ok"))
            except Exception as e:
                results.append((False, name, str(e)))
        return run
    return wrap


def get(url, **kw):
    resp = requests.get(url, headers=HEADERS, timeout=30, **kw)
    if resp.status_code != 200:
        raise AssertionError(f"HTTP {resp.status_code} for {url}")
    return resp


@check("github.io app assets serve")
def check_assets():
    for f in ("", "app.js", "style.css", "embed.js", "inventory.json"):
        get(APP + f)
    body = get(APP).text
    assert 'id="planner"' in body, "index.html missing planner markup"
    js = get(APP + "app.js").text
    assert "addAllToCart" in js, "app.js missing cart code"
    return "index, app.js, style.css, embed.js, inventory.json all 200"


@check("inventory fresh and sane")
def check_inventory():
    data = get(APP + "inventory.json").json()
    scraped = datetime.strptime(data["scraped_at"], "%Y-%m-%dT%H:%M:%SZ").replace(
        tzinfo=timezone.utc
    )
    age_h = (datetime.now(timezone.utc) - scraped).total_seconds() / 3600
    assert age_h <= MAX_INVENTORY_AGE_HOURS, (
        f"inventory is {age_h:.0f}h old (limit {MAX_INVENTORY_AGE_HOURS}h) — "
        "daily scrape has stopped running or stopped committing"
    )
    food = [p for p in data["products"] if p["category"] not in NON_FOOD]
    in_stock = [p for p in food if p["in_stock"]]
    assert len(in_stock) >= 10, f"only {len(in_stock)} in-stock food products — scrape suspect"
    priced = [p for p in food if p["price"] is not None]
    assert len(priced) >= 0.9 * len(food), "too many products missing prices"
    return f"{age_h:.0f}h old, {len(in_stock)} in-stock food products"


@check("farm site /order-planner page carries the embed")
def check_embed_page():
    body = get(f"{FARM}/order-planner").text
    assert 'id="pvf-order-planner"' in body, "mount div missing — page edited or widget dropped"
    assert "embed.js" in body, "embed script tag missing"
    return "mount div + embed script present"


@check("Order Planner link in site nav")
def check_nav():
    soup = BeautifulSoup(get(FARM).text, "html.parser")
    links = [a.get("href", "") for a in soup.select(".mainNavigation a")]
    assert any("/order-planner" in h for h in links), "nav link gone from Main Menu"
    return "nav link present"


@check("GrazeCart cart mechanism preconditions")
def check_cart_mechanism():
    # The one-click button lifts the theme.add-product-button component's
    # wire:snapshot from a product page (only rendered for signed-in
    # customers) and POSTs addToCart(id) calls to /livewire/update. This
    # sessionless probe can't see the signed-in markup, so it validates the
    # platform markers any breaking GrazeCart change would disturb:
    # Livewire v3 snapshot markup, the /livewire/update endpoint, the CSRF
    # token, and the cart-add method surface.
    inv = get(APP + "inventory.json").json()
    slug = next(
        p["slug"] for p in inv["products"]
        if p["in_stock"] and p["category"] not in NON_FOOD
    )
    body = get(f"{FARM}/store/product/{slug}").text
    assert 'id="csrfToken"' in body, "csrfToken meta gone"
    assert "wire:snapshot" in body, "Livewire v3 wire:snapshot markup gone — platform changed"
    assert "/livewire/update" in body, "/livewire/update endpoint reference gone"
    assert "addToCart" in body, "addToCart* method surface gone — cart wiring changed"

    soup = BeautifulSoup(body, "html.parser")
    snapshots = soup.select("[wire\\:snapshot]")
    assert snapshots, "no parseable wire:snapshot components on product page"
    json.loads(snapshots[0]["wire:snapshot"])  # snapshot format still JSON
    return f"Livewire v3 + /livewire/update + addToCart surface intact on {slug} (sessionless probe)"


def main() -> int:
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")  # Windows console defaults to cp1252
    for fn in (check_assets, check_inventory, check_embed_page, check_nav, check_cart_mechanism):
        fn()

    if os.environ.get("PVF_SIMULATE_FAILURE"):
        results.append((False, "simulated failure",
                        "fire drill via workflow_dispatch — not a real outage"))

    failures = [r for r in results if not r[0]]
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    print(f"## Order Planner health check — {now}\n")
    for ok, name, detail in results:
        print(f"- {'✅' if ok else '🔴'} **{name}** — {detail}")
    if failures:
        print(f"\n**{len(failures)} check(s) failing.** "
              "The one-click cart button degrades to the link list automatically; "
              "see docs/current-state.md and CLAUDE.md in this repo for how each piece works.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
