"""
scrapers/instamart.py — Swiggy Instamart stealth scraper
Strategy:
  1. Inject Lucknow lat/lng so Swiggy picks the right store.
  2. Navigate to Instamart search page.
  3. Intercept Swiggy's internal REST calls (mapi.swiggy.com/...search).
  4. Fall back to DOM parsing if XHR capture returns nothing.
"""

import asyncio
import json
import re
import random
from dataclasses import dataclass, asdict
from typing import Optional, List, Any

from playwright.async_api import Page, Response

from scrapers.browser_factory import (
    build_context, new_stealth_page, human_scroll, screenshot,
)
from scrapers.blinkit import Product, _to_float, _make_product
from scrapers._dom_extractor import CARD_EXTRACTOR_JS

BASE_URL   = "https://www.swiggy.com"
SEARCH_URL = "https://www.swiggy.com/instamart/search?custom_back=true&query={query}"

LOCATION = {
    "lat": 26.8505, "lng": 80.9413,
    "address": "Hazratganj, Lucknow, Uttar Pradesh 226001",
    "city": "Lucknow",
    "pincode": "226001",
}


class InstamartScraper:
    def __init__(self, headless: bool = False):
        self.headless = headless
        self._pw  = None
        self._ctx = None

    async def __aenter__(self) -> "InstamartScraper":
        self._pw, self._ctx = await build_context(headless=self.headless)
        return self

    async def __aexit__(self, *_):
        if self._ctx: await self._ctx.close()
        if self._pw:  await self._pw.stop()

    async def search(self, query: str, max_results: int = 5) -> List[Product]:
        page = await new_stealth_page(self._ctx)
        try:
            await self._inject_location(page)
            return await self._scrape(page, query, max_results)
        finally:
            await page.close()

    # ── Location ─────────────────────────────────────────────────────────────

    async def _inject_location(self, page: Page) -> None:
        print("  [Instamart] Priming location...")
        await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30_000)
        await asyncio.sleep(random.uniform(1.2, 2.2))

        await page.evaluate(f"""() => {{
            const loc = {{
                lat: '{LOCATION["lat"]}',
                lng: '{LOCATION["lng"]}',
                address: '{LOCATION["address"]}',
                city: '{LOCATION["city"]}',
                pincode: '{LOCATION["pincode"]}'
            }};
            localStorage.setItem('userLocation', JSON.stringify(loc));
            localStorage.setItem('userCity',     '{LOCATION["city"]}');
            localStorage.setItem('lat',           '{LOCATION["lat"]}');
            localStorage.setItem('lng',           '{LOCATION["lng"]}');
        }}""")

        await self._ctx.add_cookies([
            {"name": "userCity",    "value": LOCATION["city"],
             "domain": ".swiggy.com", "path": "/"},
            {"name": "deviceId",    "value": "quickcomm-scraper-001",
             "domain": ".swiggy.com", "path": "/"},
        ])
        print("  [Instamart] Location injected [ok]")

    # ── Scrape ────────────────────────────────────────────────────────────────

    async def _scrape(self, page: Page, query: str, max_results: int) -> List[Product]:
        captured: list = []

        async def capture_response(response: Response):
            url = response.url
            if "swiggy.com" in url and ("search" in url or "listing" in url or "instamart" in url.lower()):
                ct = response.headers.get("content-type", "")
                if "json" in ct:
                    try:
                        captured.append(await response.json())
                    except Exception:
                        pass

        page.on("response", capture_response)

        search_url = SEARCH_URL.format(query=query.replace(" ", "+"))
        print(f"  [Instamart] Searching: {search_url}")

        try:
            await page.goto(search_url, wait_until="networkidle", timeout=50_000)
        except Exception:
            await page.goto(search_url, wait_until="domcontentloaded", timeout=45_000)

        await asyncio.sleep(random.uniform(2.5, 4.0))
        await human_scroll(page, 400, 5)
        await screenshot(page, "instamart_search_results")

        # Check for bot challenge page
        content = await page.content()
        if "challenge" in content.lower() or "captcha" in content.lower() or "max challenge" in content.lower():
            print("  [Instamart] Bot challenge detected -- trying page refresh")
            await page.reload(wait_until="networkidle", timeout=40_000)
            await asyncio.sleep(3.0)
            content = await page.content()

        for body in captured:
            products = self._parse_response(body, max_results)
            if products:
                print(f"  [Instamart] Found {len(products)} products via XHR [ok]")
                return products

        products = await self._parse_dom(page, max_results)
        if products:
            print(f"  [Instamart] Found {len(products)} products via DOM [ok]")
        else:
            print("  [Instamart] [!] No products found (may be bot-blocked)")
        return products

    def _parse_response(self, body: Any, max_results: int) -> List[Product]:
        """Parse Swiggy Instamart search API response."""
        products: List[Product] = []

        # Swiggy wraps everything: {data: {widgets: [{data: {products: [...]}}]}}
        def extract_items(node, depth=0):
            if depth > 8 or len(products) >= max_results:
                return
            if isinstance(node, dict):
                if "product_id" in node or "catalog_product_id" in node:
                    p = self._item_to_product(node)
                    if p:
                        products.append(p)
                    return
                for v in node.values():
                    extract_items(v, depth + 1)
            elif isinstance(node, list):
                for item in node:
                    extract_items(item, depth + 1)

        extract_items(body)
        return products

    def _item_to_product(self, item: dict) -> Optional[Product]:
        name = (
            item.get("name") or
            item.get("product_name") or
            item.get("display_name") or ""
        )
        if not name:
            return None

        price = _to_float(
            item.get("price") or item.get("selling_price") or item.get("instore_price")
        )
        mrp = _to_float(item.get("mrp") or item.get("market_price"))

        img_url = (
            item.get("image") or
            item.get("image_url") or
            item.get("product_image", "")
        )

        weight = str(
            item.get("weight") or item.get("unit") or item.get("pack_desc") or ""
        )

        pid = (
            str(item.get("product_id") or item.get("catalog_product_id") or "")
        )

        return Product(
            name=name, price=price, mrp=mrp,
            image_url=img_url, weight=weight,
            delivery_mins=15, platform="Instamart",
            deep_link=f"swiggy://instamart?pid={pid}",
            source_url=f"https://www.swiggy.com/instamart/product/{pid}" if pid else
                       "https://www.swiggy.com/instamart",
        )

    async def _parse_dom(self, page: Page, max_results: int) -> List[Product]:
        """Shared JS extractor -- correct price extraction, EMI/OFF lines excluded."""
        products: List[Product] = []
        try:
            raw_cards = await page.evaluate(CARD_EXTRACTOR_JS)
            print(f"  [Instamart DOM] {len(raw_cards)} raw cards")

            seen: set = set()
            for card in raw_cards:
                if len(products) >= max_results: break
                name = (card.get("name") or "").strip()
                if not name or len(name) < 3 or name in seen: continue
                seen.add(name)

                price = _to_float(card.get("price"))
                mrp   = _to_float(card.get("mrp"))
                if mrp and price and mrp <= price: mrp = None
                if price is None or price < 1: continue

                enc = name.replace(" ", "+")
                products.append(_make_product(
                    name, price, mrp,
                    card.get("imgSrc", ""), card.get("weight", ""),
                    enc, platform="Instamart", delivery=15,
                    source_url=f"https://www.swiggy.com/instamart/search?custom_back=true&query={enc}",
                ))
        except Exception as e:
            print(f"  [Instamart DOM] Error: {e}")
        return products
