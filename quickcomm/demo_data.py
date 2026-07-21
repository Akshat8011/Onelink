"""
demo_data.py — Instant fallback comparison data when live scrapers are slow/unavailable.
Generates realistic, query-aware prices for Blinkit, Zepto, and Instamart.
"""

import hashlib
import re
from typing import List, Optional

from scrapers.blinkit import Product
from normalizer import group_products, ComparisonGroup


# Base price catalogue keyed by keyword fragments
_PRICE_TABLE = [
    (["milk", "amul", "taaza"], 29, 32),
    (["maggi", "noodle"], 14, 16),
    (["parle", "biscuit"], 35, 40),
    (["dettol", "soap"], 45, 52),
    (["surf", "detergent", "excel"], 189, 210),
    (["atta", "aashirvaad"], 52, 58),
    (["bread"], 40, 45),
    (["egg"], 90, 95),
    (["rice"], 65, 72),
    (["oil", "sunflower"], 145, 160),
    (["onion"], 35, 40),
    (["potato"], 30, 35),
    (["tomato"], 28, 32),
    (["banana"], 48, 55),
    (["curd", "dahi"], 28, 32),
    (["butter", "amul"], 55, 60),
    (["paneer"], 90, 98),
    (["coke", "cola", "pepsi"], 40, 45),
    (["water", "bisleri"], 20, 22),
]

_PLATFORM_DELTAS = {
    "Blinkit":   {"price": 0.0,  "eta": 10},
    "Zepto":     {"price": -2.0, "eta": 8},
    "Instamart": {"price": 1.5,  "eta": 12},
}

_IMAGE = "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,w=270/da/cms-assets/cms/product/80a7c842bcd042728cd0d1030e842015.png"


def _seed_price(query: str) -> tuple[float, float]:
    """Derive a stable base price from the query string."""
    q = query.lower()
    for keywords, price, mrp in _PRICE_TABLE:
        if any(kw in q for kw in keywords):
            return float(price), float(mrp)

    # Hash-based fallback so same query always gets same price
    h = int(hashlib.md5(q.encode()).hexdigest()[:6], 16)
    base = 20 + (h % 180)
    return float(base), float(base + 5 + (h % 20))


def _extract_weight(query: str) -> str:
    m = re.search(
        r"\b(\d+(?:\.\d+)?)\s*(?:g|gm|gms|kg|kgs|ml|l|ltr|ltrs|pc|pcs|pack|nos)\b",
        query, re.I,
    )
    return m.group(0) if m else ""


def generate_demo_products(query: str, pincode: str = "226001") -> List[Product]:
    """Build demo Product objects for all three platforms."""
    base_price, base_mrp = _seed_price(query)
    weight = _extract_weight(query)
    display_name = query.strip().title()

    products: List[Product] = []
    for platform, delta in _PLATFORM_DELTAS.items():
        price = round(base_price + delta["price"], 2)
        mrp   = round(base_mrp + delta["price"], 2)
        slug  = query.lower().replace(" ", "-")
        enc   = query.replace(" ", "+")

        if platform == "Blinkit":
            deep  = f"blinkit://search?q={enc}"
            src   = f"https://blinkit.com/s/?q={enc}"
        elif platform == "Zepto":
            deep  = f"zepto://search?q={enc}"
            src   = f"https://www.zeptonow.com/search?query={enc}"
        else:
            deep  = f"swiggy://instamart/search?query={enc}"
            src   = f"https://www.swiggy.com/instamart/search?custom_back=true&query={enc}"

        products.append(Product(
            name=display_name,
            price=price,
            mrp=mrp,
            image_url=_IMAGE,
            weight=weight,
            delivery_mins=delta["eta"],
            platform=platform,
            deep_link=deep,
            source_url=src,
        ))

    return products


def generate_demo_groups(query: str, pincode: str = "226001") -> List[ComparisonGroup]:
    return group_products(generate_demo_products(query, pincode))


def to_mobile_format(
    groups: List[ComparisonGroup],
    query: str,
    pincode: str,
    total: int,
    demo_mode: bool = False,
) -> dict:
    """Convert ComparisonGroup list to the camelCase format the OneLink mobile app expects."""
    clusters = []
    best_offer = None

    for g in groups:
        products = []
        prices = []
        for p in g.platforms:
            if p.price is not None:
                prices.append(p.price)
            prod = {
                "name":         g.canonical_name,
                "price":        p.price or 0,
                "size":         p.weight or g.canonical_weight or "",
                "imageUrl":     p.image_url,
                "platform":     p.platform,
                "deliveryTime": f"{p.delivery_mins or 10} min",
                "deepLink":     p.deep_link,
            }
            products.append(prod)
            if best_offer is None or (p.price and p.price < best_offer["price"]):
                best_offer = prod

        spread = round(max(prices) - min(prices), 2) if len(prices) >= 2 else 0.0
        clusters.append({
            "normalizedName": g.canonical_name,
            "products":       sorted(products, key=lambda x: x["price"]),
            "bestPrice":      g.best_price or 0,
            "bestPlatform":   g.best_platform,
            "priceSpread":    spread,
        })

    return {
        "query":        query,
        "pincode":      pincode,
        "totalResults": total,
        "clusters":     clusters,
        "bestOffer":    best_offer,
        "demoMode":     demo_mode,
    }
