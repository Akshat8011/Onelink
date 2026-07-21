"""
scrapers/blinkit.py -- Blinkit stealth scraper  v3
Strategies (applied in order until products found):
  1. window.grofers.PRELOADED_STATE -- targeted paths for listing/search data
  2. Intercept XHR responses to /v6/listings or /v1/search
  3. Shared DOM extractor (immune to CSS class changes, handles EMI/OFF correctly)
"""

import asyncio
import json
import re
import random
from dataclasses import dataclass, asdict
from typing import Optional, List, Any

from playwright.async_api import Page, Response

from scrapers.browser_factory import build_context, new_stealth_page, human_scroll, screenshot
from scrapers._dom_extractor import CARD_EXTRACTOR_JS

BASE_URL   = "https://blinkit.com"
SEARCH_URL = "https://blinkit.com/s/?q={query}"

LOCATION = {
    "lat": 26.8505, "lng": 80.9413,
    "address": "Hazratganj, Lucknow, Uttar Pradesh 226001",
    "pincode": "226001",
}

IMG_CDN = "https://cdn.grofers.com"


# ── Data model ────────────────────────────────────────────────────────────────

@dataclass
class Product:
    name:          str
    price:         Optional[float]
    mrp:           Optional[float]
    image_url:     str
    weight:        str
    delivery_mins: Optional[int]
    platform:      str = "Blinkit"
    deep_link:     str = ""
    source_url:    str = ""
    discount_pct:  int = 0

    def to_dict(self) -> dict:
        return asdict(self)


def _to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        cleaned = re.sub(r"[^\d.]", "", str(v))
        m = re.search(r"\d+(?:\.\d+)?", cleaned)
        return float(m.group()) if m else None
    except Exception:
        return None


def _make_product(name, price, mrp, img, weight, enc_q="", platform="Blinkit",
                  delivery=8, source_url="") -> Product:
    disc = round((1 - price / mrp) * 100) if (price and mrp and mrp > price) else 0
    return Product(
        name=name, price=price, mrp=mrp,
        image_url=img, weight=weight,
        delivery_mins=delivery, discount_pct=disc,
        platform=platform,
        deep_link=f"blinkit://search?q={enc_q}",
        source_url=source_url or f"https://blinkit.com/s/?q={enc_q}",
    )


# ── Scraper ───────────────────────────────────────────────────────────────────

class BlinkitScraper:
    def __init__(self, headless: bool = False):
        self.headless = headless
        self._pw  = None
        self._ctx = None

    async def __aenter__(self):
        self._pw, self._ctx = await build_context(headless=self.headless)
        return self

    async def __aexit__(self, *_):
        if self._ctx: await self._ctx.close()
        if self._pw:  await self._pw.stop()

    async def search(self, query: str, max_results: int = 6) -> List[Product]:
        page = await new_stealth_page(self._ctx)
        try:
            await self._inject_location(page)
            return await self._scrape(page, query, max_results)
        finally:
            await page.close()

    async def _inject_location(self, page: Page) -> None:
        print("  [Blinkit] Priming location...")
        await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30_000)
        await asyncio.sleep(random.uniform(1.5, 2.5))
        await page.evaluate(f"""() => {{
            localStorage.setItem('gr_1_lat',     '{LOCATION["lat"]}');
            localStorage.setItem('gr_1_lng',     '{LOCATION["lng"]}');
            localStorage.setItem('gr_1_address', '{LOCATION["address"]}');
            localStorage.setItem('userCity',     'Lucknow');
            localStorage.setItem('userPincode',  '{LOCATION["pincode"]}');
            localStorage.setItem('appLocation', JSON.stringify({{
                lat: {LOCATION["lat"]}, lng: {LOCATION["lng"]}, address: '{LOCATION["address"]}'
            }}));
            localStorage.setItem('selected_store', JSON.stringify({{
                lat: {LOCATION["lat"]}, lng: {LOCATION["lng"]},
                address: '{LOCATION["address"]}', store_id: 2286
            }}));
        }}""")
        await self._ctx.add_cookies([
            {"name": "userLat", "value": str(LOCATION["lat"]), "domain": ".blinkit.com", "path": "/"},
            {"name": "userLng", "value": str(LOCATION["lng"]), "domain": ".blinkit.com", "path": "/"},
        ])
        print("  [Blinkit] Location injected")

    async def _scrape(self, page: Page, query: str, max_results: int) -> List[Product]:
        captured: list = []

        async def on_response(response: Response):
            url = response.url
            if "blinkit.com" in url and ("listings" in url or "/s/" in url or "search" in url):
                if "json" in response.headers.get("content-type", ""):
                    try:
                        captured.append(await response.json())
                    except Exception:
                        pass

        page.on("response", on_response)

        search_url = SEARCH_URL.format(query=query.replace(" ", "+"))
        print(f"  [Blinkit] Searching: {search_url}")
        await page.goto(search_url, wait_until="networkidle", timeout=50_000)
        await asyncio.sleep(random.uniform(2.0, 3.5))
        await human_scroll(page, 600, 8)
        await asyncio.sleep(1.5)
        await screenshot(page, "blinkit_search")

        # Strategy 1: PRELOADED_STATE
        products = await self._from_preloaded_state(page, max_results)
        if products:
            return products

        # Strategy 2: XHR
        for body in captured:
            products = self._from_xhr(body, max_results)
            if products:
                print("  [Blinkit] products via XHR")
                return products

        # Strategy 3: DOM (shared extractor)
        products = await self._from_dom(page, max_results)
        if products:
            print("  [Blinkit] products via DOM")
            return products

        print("  [Blinkit] No products found")
        return []

    # ── Strategy 1: PRELOADED_STATE ───────────────────────────────────────────

    async def _from_preloaded_state(self, page: Page, max_results: int) -> List[Product]:
        try:
            raw = await page.evaluate(
                "() => { try { return JSON.stringify(window.grofers && window.grofers.PRELOADED_STATE || null); } catch(e) { return null; } }"
            )
            if not raw or raw == "null":
                return []
            state = json.loads(raw)
        except Exception as e:
            print(f"  [Blinkit] PRELOADED_STATE error: {e}")
            return []

        products: List[Product] = []
        self._walk(state, products, max_results, depth=0)
        if products:
            print(f"  [Blinkit] {len(products)} products via PRELOADED_STATE")
        return products

    def _walk(self, node: Any, out: List[Product], max_results: int, depth: int) -> None:
        if depth > 12 or len(out) >= max_results:
            return
        if isinstance(node, dict):
            price_key = next((k for k in ("selling_price", "price", "mrp_price", "discounted_price") if k in node), None)
            if "name" in node and price_key and isinstance(node.get("name"), str) and len(node["name"]) > 2:
                p = self._node_to_product(node)
                if p and p.name and p.price:
                    out.append(p)
                    return
            for v in node.values():
                self._walk(v, out, max_results, depth + 1)
        elif isinstance(node, list):
            for item in node:
                if len(out) >= max_results:
                    return
                self._walk(item, out, max_results, depth + 1)

    def _node_to_product(self, d: dict) -> Optional[Product]:
        name = (d.get("name") or d.get("product_name") or "").strip()
        if not name or len(name) < 2:
            return None
        price = _to_float(d.get("selling_price") or d.get("price"))
        mrp   = _to_float(d.get("mrp_price") or d.get("mrp") or d.get("market_price"))
        if price is None:
            return None
        img = d.get("images") or {}
        if isinstance(img, dict):
            img_url = img.get("default") or img.get("low") or img.get("high") or ""
        elif isinstance(img, list) and img:
            first = img[0]
            img_url = first if isinstance(first, str) else (first.get("url") or first.get("path") or "")
        else:
            img_url = str(img) if img else ""
        if img_url and not img_url.startswith("http"):
            img_url = IMG_CDN + ("" if img_url.startswith("/") else "/") + img_url
        weight = str(d.get("unit") or d.get("pack_desc") or d.get("net_quantity") or d.get("weight") or "").strip()
        enc = name.replace(" ", "+")
        return _make_product(name, price, mrp, img_url, weight, enc)

    # ── Strategy 2: XHR ───────────────────────────────────────────────────────

    def _from_xhr(self, body: Any, max_results: int) -> List[Product]:
        products: List[Product] = []
        try:
            widgets = (body.get("data") or {}).get("widgets") or body.get("widgets") or []
            for w in widgets:
                items = w.get("data") or w.get("products") or []
                if isinstance(items, list):
                    for item in items:
                        p = self._node_to_product(item)
                        if p:
                            products.append(p)
                            if len(products) >= max_results:
                                return products
        except Exception:
            pass
        return products

    # ── Strategy 3: DOM (shared extractor) ────────────────────────────────────

    async def _from_dom(self, page: Page, max_results: int) -> List[Product]:
        products: List[Product] = []
        try:
            raw_cards = await page.evaluate(CARD_EXTRACTOR_JS)
            print(f"  [Blinkit DOM] {len(raw_cards)} raw cards")

            seen: set = set()
            for card in raw_cards:
                if len(products) >= max_results:
                    break
                name = (card.get("name") or "").strip()
                if not name or len(name) < 3 or name in seen:
                    continue
                seen.add(name)

                price = _to_float(card.get("price"))
                mrp   = _to_float(card.get("mrp"))
                if mrp and price and mrp <= price:
                    mrp = None
                if price is None or price < 1:
                    continue

                enc = name.replace(" ", "+")
                products.append(_make_product(
                    name, price, mrp,
                    card.get("imgSrc", ""), card.get("weight", ""),
                    enc, delivery=8,
                ))
        except Exception as e:
            print(f"  [Blinkit DOM] error: {e}")
        return products
