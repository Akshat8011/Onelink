import asyncio
import os
import random
import re
from pathlib import Path
from typing import Dict, List
from thefuzz import fuzz


class QuickCommScraper:
    DEFAULT_PINCODE = "226010"
    DEFAULT_QUERY = "Amul Taaza Milk 500ml"
    PLATFORM_PROFILES = (
        {
            "platform": "Blinkit",
            "eta": "10 MINS",
            "price_delta": 0.0,
            "title_suffix": "Fresh",
            "deep_link_prefix": "blinkit://search?q=",
        },
        {
            "platform": "Zepto",
            "eta": "8 MINS",
            "price_delta": -1.0,
            "title_suffix": "Store Pack",
            "deep_link_prefix": "zepto://search?q=",
        },
        {
            "platform": "Instamart",
            "eta": "12 MINS",
            "price_delta": 1.5,
            "title_suffix": "Quick Cart",
            "deep_link_prefix": "swiggy://instamart/search?q=",
        },
    )

    def __init__(self, query: str, pincode: str):
        self.query = query or self.DEFAULT_QUERY
        self.pincode = pincode or self.DEFAULT_PINCODE
        self._fixture_path = Path(__file__).resolve().parent / "fixtures" / "product_search_demo.html"

    def _build_user_agent(self) -> str:
        candidates = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        ]
        return random.choice(candidates)

    def _resolve_source_url(self) -> str:
        override = os.getenv("QUICKCOMM_DEMO_URL")
        if override:
            return override
        return self._fixture_path.as_uri()

    async def _scrape_demo_card(self) -> Dict[str, object]:
        await asyncio.sleep(random.uniform(0.12, 0.28))

        source_html = Path(self._resolve_source_url().replace("file:///", "")).read_text(encoding="utf-8")

        title_match = re.search(r"data-testid=\"product-title\"[^>]*>([^<]+)<", source_html)
        price_match = re.search(r"data-testid=\"product-price\"[^>]*>([^<]+)<", source_html)
        delivery_match = re.search(r"data-testid=\"delivery-time\"[^>]*>([^<]+)<", source_html)
        image_match = re.search(r"<img[^>]*src=\"([^\"]+)\"", source_html)

        if not title_match or not price_match or not delivery_match:
            raise RuntimeError("Could not parse the demo catalog fixture")

        return {
            "name": title_match.group(1).strip(),
            "size": "500ml",
            "price": float(price_match.group(1).replace("₹", "").replace(",", "").strip()),
            "imageUrl": image_match.group(1).strip() if image_match else "",
            "deliveryTime": delivery_match.group(1).strip(),
        }

    async def _scrape_platform(self, profile: Dict[str, object]) -> Dict[str, object]:
        base_card = await self._scrape_demo_card()
        safe_query = self.query.replace(" ", "+")
        platform = str(profile["platform"])
        title = f"{base_card['name']} {profile['title_suffix']}"

        return {
            "name": title,
            "size": base_card["size"],
            "price": round(float(base_card["price"]) + float(profile["price_delta"]), 2),
            "imageUrl": base_card["imageUrl"],
            "platform": platform,
            "deliveryTime": str(profile["eta"]),
            "deepLink": f"{profile['deep_link_prefix']}{safe_query}",
        }

    async def run_all_scrapers(self):
        results = await asyncio.gather(*(self._scrape_platform(profile) for profile in self.PLATFORM_PROFILES))

        seen = set()
        unique_results = []
        for result in results:
            key = f"{result['platform']}::{result['name']}"
            if key in seen:
                continue
            seen.add(key)
            unique_results.append(result)

        return unique_results

    def normalize_and_cluster(self, raw_data):
        clusters = []

        for item in raw_data:
            matched_cluster = None

            for cluster in clusters:
                score = fuzz.token_sort_ratio(item["name"].lower(), cluster["normalizedName"].lower())
                if item.get("size") and cluster["products"][0].get("size"):
                    if item["size"].lower().replace(" ", "") != cluster["products"][0]["size"].lower().replace(" ", ""):
                        score -= 20

                if score > 70:
                    matched_cluster = cluster
                    break

            if matched_cluster:
                matched_cluster["products"].append(item)
                if item["price"] < matched_cluster["bestPrice"]:
                    matched_cluster["bestPrice"] = item["price"]
                    matched_cluster["bestPlatform"] = item["platform"]
            else:
                clusters.append(
                    {
                        "normalizedName": item["name"],
                        "products": [item],
                        "bestPrice": item["price"],
                        "bestPlatform": item["platform"],
                    }
                )

        for cluster in clusters:
            cluster["products"] = sorted(cluster["products"], key=lambda x: x["price"])
            cluster["priceSpread"] = round(cluster["products"][-1]["price"] - cluster["products"][0]["price"], 2)

        return clusters
