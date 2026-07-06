"""Scrape parkviewfamilyfarm.com (GrazeCart) storefront into docs/inventory.json.

Run daily by .github/workflows/scrape.yml; can also be run locally:
    py scraper/scrape.py

Products are parsed from schema.org microdata on category pages, which is
stable GrazeCart markup. Sold-out detection uses the availability microdata
plus a text fallback, since GrazeCart themes vary in how they badge it.
"""

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

BASE = "https://parkviewfamilyfarm.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PVF-OrderPlanner/1.0"
}
# Categories that never belong in meal planning math (still scraped for links).
NON_FOOD_CATEGORIES = {"farm-supporter-program"}
# Fallback if nav discovery ever fails — keep in sync with the live store.
KNOWN_CATEGORIES = [
    "chicken",
    "pork",
    "eggs",
    "turkey",
    "lamb",
    "freezer-bundles",
    "farm-supporter-program",
]

OUT_PATH = Path(__file__).resolve().parent.parent / "docs" / "inventory.json"


def fetch(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.text


def discover_categories() -> list[str]:
    html = fetch(f"{BASE}/store")
    soup = BeautifulSoup(html, "html.parser")
    slugs: list[str] = []
    for a in soup.select('a[href*="/store/"]'):
        path = urlparse(a["href"]).path
        m = re.fullmatch(r"/store/([a-z0-9-]+)", path)
        if m and m.group(1) != "product" and m.group(1) not in slugs:
            slugs.append(m.group(1))
    return slugs or KNOWN_CATEGORIES


def parse_weight(text: str) -> float | None:
    """'Avg. 4 lb.' -> 4.0, 'Avg. 11.2 oz.' -> 0.7"""
    m = re.search(r"([\d.]+)\s*(lb|oz)", text, re.I)
    if not m:
        return None
    value = float(m.group(1))
    return round(value / 16, 3) if m.group(2).lower() == "oz" else value


def parse_products(html: str, category: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    products = []
    for section in soup.select('section[itemtype="https://schema.org/Product"]'):
        item_id = section.get("itemid", "")
        slug = item_id.rstrip("/").rsplit("/", 1)[-1]
        if not slug:
            continue

        name_el = section.select_one("[itemprop=name]")
        desc_el = section.select_one("[itemprop=description] p")
        price_el = section.select_one("[itemprop=price]")
        avail_el = section.select_one("link[itemprop=availability]")
        weight_el = section.select_one(".productListing__averageWeight")
        img_el = section.select_one("img[itemprop=image]")

        price = None
        price_unit = "each"
        if price_el:
            raw = price_el.get_text(" ", strip=True)
            m = re.search(r"([\d,]+\.?\d*)", raw)
            if m:
                price = float(m.group(1).replace(",", ""))
            if "/lb" in raw:
                price_unit = "lb"

        in_stock = True
        if avail_el and "OutOfStock" in avail_el.get("href", ""):
            in_stock = False
        if re.search(r"sold\s*out", section.get_text(" ", strip=True), re.I):
            in_stock = False

        products.append(
            {
                "slug": slug,
                "name": name_el.get_text(strip=True) if name_el else slug,
                "description": desc_el.get_text(strip=True) if desc_el else "",
                "category": category,
                "price": price,
                "price_unit": price_unit,
                "avg_weight_lb": parse_weight(weight_el.get_text()) if weight_el else None,
                "in_stock": in_stock,
                "image": img_el.get("src") if img_el else None,
                "url": f"{BASE}/store/product/{slug}",
            }
        )
    return products


def main() -> int:
    categories = discover_categories()
    seen: dict[str, dict] = {}  # slug -> product; some items list in 2+ categories
    for cat in categories:
        try:
            html = fetch(f"{BASE}/store/{cat}")
        except requests.RequestException as e:
            print(f"WARN: {cat}: {e}", file=sys.stderr)
            continue
        items = parse_products(html, cat)
        print(f"{cat}: {len(items)} products")
        for p in items:
            if p["slug"] in seen:
                seen[p["slug"]].setdefault("also_in", []).append(cat)
            else:
                seen[p["slug"]] = p
        time.sleep(1)  # be polite to the storefront
    all_products = list(seen.values())

    # Guardrail: a near-empty scrape means the markup changed, not that the
    # farm sold everything. Fail loudly instead of committing a broken file.
    food = [p for p in all_products if p["category"] not in NON_FOOD_CATEGORIES]
    if len(food) < 10:
        print(f"ERROR: only {len(food)} food products scraped; aborting.", file=sys.stderr)
        return 1

    payload = {
        "scraped_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": BASE,
        "categories": categories,
        "products": all_products,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=1), encoding="utf-8")
    print(f"Wrote {len(all_products)} products -> {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
