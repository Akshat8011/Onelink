"""
poc_blinkit.py — Phase 1 smoke test
Run:
    cd quickcomm
    python poc_blinkit.py
"""

import asyncio
import json
from scrapers.blinkit import BlinkitScraper

QUERY   = "Amul Taaza Milk 500ml"
PINCODE = "226001"          # Lucknow Hazratganj

async def main() -> None:
    print(f"\n{'='*55}")
    print(f"  QuickComm · Blinkit POC")
    print(f"  Query   : {QUERY}")
    print(f"  Pincode : {PINCODE}")
    print(f"{'='*55}\n")

    async with BlinkitScraper(headless=False) as scraper:
        products = await scraper.search(QUERY, max_results=5)

    if not products:
        print("\n⚠  No products found. Check debug_shots/ for screenshots.")
        return

    print(f"\n✅  Found {len(products)} products:\n")
    for i, p in enumerate(products, 1):
        price = f"₹{p.price:.0f}" if p.price else "N/A"
        mrp   = f" (MRP ₹{p.mrp:.0f})" if p.mrp else ""
        print(f"  {i}. {p.name}")
        print(f"     Price : {price}{mrp}   Weight: {p.weight or '—'}")
        print(f"     ETA   : {p.delivery_mins} min   Deep-link: {p.deep_link}")
        print()

    # Save to JSON for downstream use
    out = [p.to_dict() for p in products]
    with open("debug_shots/poc_result.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("  💾  Results saved to debug_shots/poc_result.json")

if __name__ == "__main__":
    asyncio.run(main())
