"""
scrapers/zepto.py — Zepto stealth scraper
Strategy: Intercept Zepto's internal search API calls (v1/search or v2/search).
Zepto is a React SPA; all product data flows through XHR — we capture it.
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

BASE_URL   = "https://www.zeptonow.com"
SEARCH_URL = "https://www.zeptonow.com/search?query={query}"

# Lucknow — Zepto uses lat/lng to pick the nearest store
LOCATION = {
    "lat": 26.8505, "lng": 80.9413,
    "city": "Lucknow",
    "pincode": "226001",
}

ZEPTO_STORE_ID = "53da3c34-9e07-4b41-aef3-2bc55d11e405"  # Lucknow Hazratganj


class ZeptoScraper:
    def __init__(self, headless: bool = False):
        self.headless = headless
        self._pw  = None
        self._ctx = None

    async def __aenter__(self) -> "ZeptoScraper":
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
        print("  [Zepto] Priming location...")
        await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30_000)
        await asyncio.sleep(random.uniform(1.0, 2.0))

        await page.evaluate(f"""() => {{
            const loc = {{
                lat: {LOCATION["lat"]},
                lng: {LOCATION["lng"]},
                city: '{LOCATION["city"]}',
                pincode: '{LOCATION["pincode"]}',
                storeId: '{ZEPTO_STORE_ID}'
            }};
            localStorage.setItem('zepto_user_location', JSON.stringify(loc));
            localStorage.setItem('zepto_store_id',      '{ZEPTO_STORE_ID}');
            localStorage.setItem('store_id',            '{ZEPTO_STORE_ID}');
            localStorage.setItem('userLat',             '{LOCATION["lat"]}');
            localStorage.setItem('userLng',             '{LOCATION["lng"]}');
        }}""")

        await self._ctx.add_cookies([
            {"name": "store_id", "value": ZEPTO_STORE_ID,
             "domain": ".zeptonow.com", "path": "/"},
            {"name": "userLat", "value": str(LOCATION["lat"]),
             "domain": ".zeptonow.com", "path": "/"},
            {"name": "userLng", "value": str(LOCATION["lng"]),
             "domain": ".zeptonow.com", "path": "/"},
        ])
        print("  [Zepto] Location injected [ok]")

    # ── Scrape ────────────────────────────────────────────────────────────────

    async def _scrape(self, page: Page, query: str, max_results: int) -> List[Product]:
        captured: list = []

        async def capture_response(response: Response):
            url = response.url
            if "zeptonow.com/api" in url or "zepto.in/api" in url:
                ct = response.headers.get("content-type", "")
                if "json" in ct:
                    try:
                        captured.append(await response.json())
                    except Exception:
                        pass

        page.on("response", capture_response)

        search_url = SEARCH_URL.format(query=query.replace(" ", "+"))
        print(f"  [Zepto] Searching: {search_url}")

        await page.goto(search_url, wait_until="networkidle", timeout=45_000)
        await asyncio.sleep(random.uniform(2.0, 3.0))
        await human_scroll(page, 300, 4)
        await screenshot(page, "zepto_search_results")

        # Try XHR interception first
        for body in captured:
            products = self._parse_response(body, max_results)
            if products:
                print(f"  [Zepto] Found {len(products)} products via XHR [ok]")
                return products

        # Fallback: scrape DOM — Zepto renders product cards server-side too
        products = await self._parse_dom(page, max_results)
        if products:
            print(f"  [Zepto] Found {len(products)} products via DOM [ok]")
        else:
            print("  [Zepto] [!] No products found")
        return products

    def _parse_response(self, body: Any, max_results: int) -> List[Product]:
        """Parse Zepto's search API response."""
        products: List[Product] = []

        # Zepto v2 search returns {data: {sections: [{items: [...]}]}}
        sections = (
            (body.get("data") or {}).get("sections") or
            (body.get("data") or {}).get("items") or
            body.get("sections") or
            body.get("items") or
            []
        )

        for section in sections:
            items = section.get("items") or section.get("products") or (
                [section] if "product_id" in section or "sku_id" in section else []
            )
            for item in items:
                p = self._item_to_product(item)
                if p:
                    products.append(p)
                    if len(products) >= max_results:
                        return products
        return products

    def _item_to_product(self, item: dict) -> Optional[Product]:
        prod = item.get("product") or item

        name  = prod.get("name") or prod.get("product_name") or prod.get("title", "")
        if not name:
            return None

        price = _to_float(prod.get("discounted_selling_price") or prod.get("price"))
        mrp   = _to_float(prod.get("mrp") or prod.get("market_price"))

        img_url = ""
        images = prod.get("images") or []
        if isinstance(images, list) and images:
            img_url = images[0].get("url") or images[0].get("path") or ""
        elif isinstance(images, str):
            img_url = images
        if not img_url:
            img_url = prod.get("image_url") or prod.get("image", "")

        weight = str(prod.get("unit_quantity") or prod.get("pack_desc") or prod.get("weight") or "")
        pid    = prod.get("product_id") or prod.get("sku_id") or ""

        return Product(
            name=name, price=price, mrp=mrp,
            image_url=img_url, weight=weight,
            delivery_mins=10, platform="Zepto",
            deep_link=f"zepto://search?q={name}",
            source_url=f"https://www.zeptonow.com/pn/{pid}" if pid else SEARCH_URL.format(query=name),
        )

    async def _parse_dom(self, page: Page, max_results: int) -> List[Product]:
        """Shared JS extractor -- correct price extraction, EMI/OFF lines excluded."""
        products: List[Product] = []
        try:
            raw_cards = await page.evaluate(CARD_EXTRACTOR_JS)
            print(f"  [Zepto DOM] {len(raw_cards)} raw cards")

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
                    enc, platform="Zepto", delivery=10,
                    source_url=f"https://www.zeptonow.com/search?query={enc}",
                ))
        except Exception as e:
            print(f"  [Zepto DOM] Error: {e}")
        return products
