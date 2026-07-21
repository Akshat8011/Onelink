#!/usr/bin/env python3
"""Scrape Blinkit for per-product verified Grofers CDN images."""

from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
QUICKCOMM = SCRIPT_DIR.parent
sys.path.insert(0, str(QUICKCOMM))
sys.path.insert(0, str(SCRIPT_DIR))

from thefuzz import fuzz
from scrapers.blinkit import BlinkitScraper
from product_images import grofers
from generate_shop_catalog import SEED, EXPAND
from shop_bulk_seed import BULK_SEED
from shop_extra_seed import EXTRA_SEED

OUT = SCRIPT_DIR / "verified_product_images.json"
MIN_SCORE = 58
MIN_SCORE_PRODUCE = 50

# Hand-tuned queries for products Blinkit search misses with full catalog names
QUERY_OVERRIDES: dict[tuple[str, str], list[str]] = {
    ("Vim", "Dishwash Liquid Lemon"): ["vim dishwash liquid lemon", "vim dishwash gel"],
    ("Pampers", "Baby Dry Diapers"): ["pampers baby dry pants", "pampers premium care diapers"],
    ("Nestle", "Cerelac Wheat Apple"): ["nestle cerelac wheat apple", "cerelac wheat apple"],
    ("McCain", "Smiles Potato"): ["mccain smiles", "mccain potato smiles"],
    ("ITC", "Master Chef Frozen Peas"): ["itc frozen green peas", "itc master chef peas"],
    ("Saffola", "Gold Refined Oil"): ["saffola gold oil", "saffola refined oil"],
    ("Ponds", "Light Moisturiser"): ["ponds light moisturiser", "ponds super light gel"],
    ("Kikkoman", "Soya Sauce"): ["kikkoman soya sauce", "kikkoman soy sauce"],
    ("Heinz", "Tomato Ketchup"): ["heinz tomato ketchup", "heinz ketchup"],
    ("Protinex", "Original Health Supplement"): ["protinex original", "protinex health supplement"],
    ("Harpic", "Power Plus 10x"): ["harpic power plus", "harpic toilet cleaner power plus"],
    ("Scotch Brite", "Scrub Pad"): ["scotch brite scrub pad", "scotch brite scrub"],
    ("Milton", "Stainless Steel Bottle"): ["milton steel bottle", "milton water bottle"],
    ("Prestige", "Non-Stick Tawa"): ["prestige non stick tawa", "prestige tawa"],
    ("Philips", "LED Bulb 9W"): ["philips led bulb 9w", "philips led bulb"],
    ("Duracell", "AA Batteries"): ["duracell aa batteries", "duracell ultra aa"],
    ("Fresho", "Apple Shimla"): ["apple shimla", "shimla apple 1kg"],
    ("Fresho", "Carrot Orange"): ["carrot orange", "orange carrot"],
    ("Fresho", "Capsicum Green"): ["green capsicum", "capsicum green"],
    ("Fresho", "Spinach"): ["spinach", "palak"],
    ("Fresho", "Coriander Leaves"): ["coriander leaves", "dhaniya patta"],
    ("Fresho", "Ginger"): ["ginger", "adrak"],
    ("Fresho", "Garlic"): ["garlic", "lahsun"],
    ("Fresho", "Lemon"): ["lemon", "nimbu"],
    ("Fresho", "Mango Alphonso"): ["alphonso mango", "mango alphonso"],
    ("Fresho", "Pomegranate"): ["pomegranate", "anaar"],
    ("Fresho", "Mushroom Button"): ["button mushroom", "mushroom"],
}


def product_key(brand: str, name: str) -> str:
    return f"{brand.strip()}|{name.strip()}"


def unique_products() -> list[tuple[str, str]]:
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for row in SEED:
        brand, name = row[0], row[1]
        k = product_key(brand, name)
        if k not in seen:
            seen.add(k)
            out.append((brand, name))
    for brand, name, *_ in EXPAND:
        k = product_key(brand, name)
        if k not in seen:
            seen.add(k)
            out.append((brand, name))
    for row in BULK_SEED:
        brand, name = row[0], row[1]
        k = product_key(brand, name)
        if k not in seen:
            seen.add(k)
            out.append((brand, name))
    for row in EXTRA_SEED:
        brand, name = row[0], row[1]
        k = product_key(brand, name)
        if k not in seen:
            seen.add(k)
            out.append((brand, name))
    return out


def _norm(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def is_produce(brand: str) -> bool:
    return brand.lower() in {"fresho", "eggs"}


def search_queries(brand: str, name: str) -> list[str]:
    """Multiple query variants — Blinkit search is picky."""
    override = QUERY_OVERRIDES.get((brand, name))
    if override:
        queries = list(override)
    else:
        queries = []
    queries.append(f"{brand} {name}")

    if is_produce(brand):
        queries.insert(0, name)
        first = name.split()[0]
        if first.lower() not in name.lower():
            queries.append(first)

    # Shorter: drop filler words
    short_name = re.sub(
        r"\b(refined|original|classic|hybrid|robusta|shimla|toned|full cream|"
        r"packaged|anti dandruff|cream beauty|easy wash|master chef)\b",
        "",
        name,
        flags=re.I,
    ).strip()
    if short_name and short_name != name:
        queries.append(f"{brand} {short_name}")

    # Brand + first 2 words of product name
    name_words = _norm(name).split()
    if len(name_words) >= 2:
        queries.append(f"{brand} {' '.join(name_words[:2])}")
    if name_words:
        queries.append(f"{brand} {name_words[0]}")

    # Lay's / special apostrophe brands
    brand_alt = brand.replace("'", "").replace("-", " ")
    if brand_alt != brand:
        queries.append(f"{brand_alt} {name}")

    # Deduplicate preserving order
    seen: set[str] = set()
    out: list[str] = []
    for q in queries:
        q = re.sub(r"\s+", " ", q).strip()
        if q and q.lower() not in seen:
            seen.add(q.lower())
            out.append(q)
    return out


def match_score(brand: str, name: str, result_name: str) -> int:
    target = _norm(f"{brand} {name}")
    result = _norm(result_name)
    brand_n = _norm(brand)
    name_n = _norm(name)
    brand_tokens = [t for t in brand_n.split() if len(t) > 2]

    score = max(
        fuzz.token_set_ratio(target, result),
        fuzz.partial_ratio(target, result),
        fuzz.token_set_ratio(name_n, result),
    )

    if is_produce(brand):
        produce_key = _norm(name.split()[0])
        if produce_key and produce_key in result:
            score = max(score, 75)

    if brand_tokens and not any(t in result for t in brand_tokens):
        if not is_produce(brand):
            score -= 35

    name_head = name_n[:5]
    if name_head and name_head not in result and not is_produce(brand):
        score -= 12

    return score


def pick_best(brand: str, name: str, products: list) -> tuple[object | None, int]:
    best, best_score = None, 0
    min_score = MIN_SCORE_PRODUCE if is_produce(brand) else MIN_SCORE
    target = _norm(f"{brand} {name}")

    for p in products:
        if not p.image_url or not p.name:
            continue
        if p.name.lower().startswith("out of stock"):
            continue
        result = _norm(p.name)
        brand_n = _norm(brand)
        brand_tokens = [t for t in brand_n.split() if len(t) > 2]
        if brand_tokens and not is_produce(brand):
            if not any(t in result for t in brand_tokens):
                continue
        # Reject obvious product-type mismatches
        if "diaper" in target and "diaper" not in result:
            continue
        if "diaper" in target and any(w in result for w in ("wipe", "wet wipe")):
            continue
        if "milk" in target and "milk" not in result and "dairy" not in result:
            if not any(w in result for w in ("milk", "dahi", "curd", "butter", "paneer")):
                continue
        if "bread" in target and "bread" not in result:
            continue
        if "corn flake" in target and "corn" not in result:
            continue

        s = match_score(brand, name, p.name)
        if s > best_score:
            best_score, best = s, p
    if best_score < min_score:
        return None, best_score
    return best, best_score


async def fetch_all(headless: bool = True, force_missing: bool = True) -> dict:
    cache: dict = {}
    if OUT.exists():
        cache = json.loads(OUT.read_text(encoding="utf-8"))

    items = unique_products()
    print(f"Unique products: {len(items)}  (cached verified: {sum(1 for v in cache.values() if v.get('verified'))})")

    async with BlinkitScraper(headless=headless) as scraper:
        for i, (brand, name) in enumerate(items, 1):
            key = product_key(brand, name)
            if key in cache and cache[key].get("verified") and not force_missing:
                print(f"[{i}/{len(items)}] SKIP {key}")
                continue

            if cache.get(key, {}).get("verified"):
                print(f"[{i}/{len(items)}] SKIP verified {key}")
                continue

            best = None
            best_score = 0
            used_query = ""
            all_results = []

            for query in search_queries(brand, name):
                print(f"[{i}/{len(items)}] SEARCH {query}")
                try:
                    results = await scraper.search(query, max_results=10)
                except Exception as e:
                    print(f"  ERR {e}")
                    continue

                if not results:
                    continue

                all_results.extend(results)
                candidate, score = pick_best(brand, name, results)
                if candidate and score > best_score:
                    best, best_score, used_query = candidate, score, query
                if best_score >= 85:
                    break

            if best and best_score >= (MIN_SCORE_PRODUCE if is_produce(brand) else MIN_SCORE):
                cache[key] = {
                    "brand": brand,
                    "name": name,
                    "query": used_query,
                    "matched_name": best.name,
                    "image": grofers(best.image_url),
                    "score": best_score,
                    "verified": True,
                }
                print(f"  OK score={best_score} -> {best.name[:55]}")
            else:
                cache[key] = {
                    "brand": brand,
                    "name": name,
                    "query": used_query or search_queries(brand, name)[0],
                    "score": best_score,
                    "verified": False,
                    "candidates": [p.name for p in all_results[:6]],
                }
                print(f"  MISS score={best_score} candidates={[p.name[:28] for p in all_results[:3]]}")

            OUT.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")

    verified = sum(1 for v in cache.values() if v.get("verified"))
    print(f"Done: {verified}/{len(items)} verified images -> {OUT}")
    return cache


if __name__ == "__main__":
    asyncio.run(fetch_all())
