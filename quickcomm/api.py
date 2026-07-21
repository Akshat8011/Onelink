"""
api.py -- QuickComm Aggregator FastAPI backend  v1.3
POST /api/compare       - single product comparison
POST /api/compare/cart  - multi-item cart comparison
GET  /api/health

Root cause fix (v1.3):
  Windows only allows ONE ProactorEventLoop per process (IOCP is process-wide).
  ThreadPoolExecutor + ProactorEventLoop in threads conflicts with uvicorn's own
  ProactorEventLoop, causing silent scraper crashes and demo-mode fallback.
  Solution: ProcessPoolExecutor -- each scraper runs in an ISOLATED OS process
  with its own ProactorEventLoop.  No IOCP conflicts.

Run:
    cd C:\\Users\\DELL\\Onelink\\quickcomm
    python -m uvicorn api:app --reload --port 8001
"""

import sys

# Force UTF-8 stdout/stderr -- Windows terminals default to cp1252 which
# crashes on any Unicode in scraper print statements.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import asyncio
import time
from concurrent.futures import ProcessPoolExecutor
from typing import List, Optional, Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from normalizer import group_products, ComparisonGroup
from demo_data import generate_demo_groups, to_mobile_format

LIVE_TIMEOUT_S = 90


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="QuickComm API", version="1.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────

class CompareRequest(BaseModel):
    query:                    str = Field(..., min_length=2, max_length=200)
    pincode:                  str = Field(..., min_length=6, max_length=6)
    max_results_per_platform: int = Field(default=6, ge=1, le=20)
    headless:                 bool = Field(default=True)
    mode: Literal["auto", "live", "demo"] = Field(default="auto")
    format: Literal["web", "mobile"]      = Field(default="web")


class CartItem(BaseModel):
    query: str = Field(..., min_length=2, max_length=200)
    qty:   int = Field(default=1, ge=1, le=99)


class CartCompareRequest(BaseModel):
    items:   List[CartItem] = Field(..., min_length=1, max_length=20)
    pincode: str = Field(..., min_length=6, max_length=6)
    headless: bool = Field(default=True)
    mode: Literal["auto", "live", "demo"] = Field(default="auto")
    format: Literal["web", "mobile"]      = Field(default="web")


class PlatformResult(BaseModel):
    platform:      str
    price:         Optional[float]
    mrp:           Optional[float]
    delivery_mins: Optional[int]
    image_url:     str
    weight:        str
    deep_link:     str
    source_url:    str


class ComparisonRow(BaseModel):
    canonical_name:   str
    canonical_weight: str
    best_price:       Optional[float]
    best_platform:    str
    platforms:        List[PlatformResult]


class CompareResponse(BaseModel):
    query:         str
    pincode:       str
    elapsed_ms:    int
    total_results: int
    demo_mode:     bool
    groups:        List[ComparisonRow]


class CartPlatformTotal(BaseModel):
    platform:      str
    subtotal:      float
    item_count:    int
    delivery_mins: int


class CartCompareResponse(BaseModel):
    pincode:           str
    elapsed_ms:        int
    demo_mode:         bool
    items:             List[ComparisonRow]
    platform_totals:   List[CartPlatformTotal]
    cheapest_platform: str
    cheapest_total:    float


class HealthResponse(BaseModel):
    status:  str
    version: str


# ── Process-pool worker (runs in an isolated OS process) ─────────────────────
#
# IMPORTANT: This function MUST be module-level (not nested / lambda) so it can
# be pickled by ProcessPoolExecutor on Windows (spawn start-method).

def _scrape_worker(scraper_name: str, query: str, max_results: int,
                   headless: bool, label: str) -> list:
    """
    Runs inside a dedicated subprocess.  Each subprocess gets its own
    ProactorEventLoop -- no conflict with uvicorn's loop or each other.
    Returns a list of plain dicts (pickleable).
    """
    import sys, asyncio

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    if sys.platform == "win32":
        loop = asyncio.ProactorEventLoop()
    else:
        loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        if scraper_name == "blinkit":
            from scrapers.blinkit import BlinkitScraper as Cls
        elif scraper_name == "zepto":
            from scrapers.zepto import ZeptoScraper as Cls
        else:
            from scrapers.instamart import InstamartScraper as Cls

        async def _inner():
            async with Cls(headless=headless) as s:
                return await s.search(query, max_results)

        products = loop.run_until_complete(_inner())
        print(f"  [{label}] {len(products)} products")
        return [p.to_dict() for p in products]

    except Exception as exc:
        print(f"  [{label}] ERROR: {type(exc).__name__}: {exc}")
        return []
    finally:
        loop.close()


# ── Scraper orchestrator ──────────────────────────────────────────────────────

async def _scrape_live(query: str, max_results: int, headless: bool) -> list:
    """Submit scrapers to the process pool and gather results."""
    loop = asyncio.get_running_loop()
    pool = ProcessPoolExecutor(max_workers=3)

    tasks = [
        loop.run_in_executor(pool, _scrape_worker, "blinkit",   query, max_results, headless, "Blinkit"),
        loop.run_in_executor(pool, _scrape_worker, "zepto",     query, max_results, headless, "Zepto"),
        loop.run_in_executor(pool, _scrape_worker, "instamart", query, max_results, headless, "Instamart"),
    ]

    try:
        results = await asyncio.wait_for(
            asyncio.gather(*tasks, return_exceptions=True),
            timeout=LIVE_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        print(f"  [API] Scrapers timed out after {LIVE_TIMEOUT_S}s")
        pool.shutdown(wait=False)
        return []
    finally:
        pool.shutdown(wait=False)

    all_dicts: list = []
    for r in results:
        if isinstance(r, Exception):
            print(f"  [API] Worker exception: {type(r).__name__}: {r}")
        elif isinstance(r, list):
            all_dicts.extend(r)

    print(f"  [API] Total live products collected: {len(all_dicts)}")
    return all_dicts


def _dicts_to_products(raw: list):
    """Reconstruct Product objects from scraped dicts in the main process."""
    from scrapers.blinkit import Product
    products = []
    for d in raw:
        try:
            products.append(Product(
                name=d.get("name", ""),
                price=d.get("price"),
                mrp=d.get("mrp"),
                image_url=d.get("image_url", ""),
                weight=d.get("weight", ""),
                delivery_mins=d.get("delivery_mins"),
                platform=d.get("platform", ""),
                deep_link=d.get("deep_link", ""),
                source_url=d.get("source_url", ""),
                discount_pct=d.get("discount_pct", 0),
            ))
        except Exception:
            pass
    return products


async def _compare_core(query, pincode, max_results, headless, mode) -> tuple:
    if mode == "demo":
        return generate_demo_groups(query, pincode), True

    raw_dicts: list = []
    if mode in ("auto", "live"):
        raw_dicts = await _scrape_live(query, max_results, headless)

    if raw_dicts:
        products = _dicts_to_products(raw_dicts)
        return group_products(products), False

    if mode == "live":
        return [], False

    print(f"  [API] Falling back to demo for '{query}'")
    return generate_demo_groups(query, pincode), True


def _groups_to_rows(groups: List[ComparisonGroup]) -> List[ComparisonRow]:
    return [
        ComparisonRow(
            canonical_name=g.canonical_name,
            canonical_weight=g.canonical_weight,
            best_price=g.best_price,
            best_platform=g.best_platform,
            platforms=[PlatformResult(**p.to_dict()) for p in g.platforms],
        )
        for g in groups
    ]


def _cart_totals(all_groups: list) -> List[CartPlatformTotal]:
    totals: dict = {}
    for groups in all_groups:
        for g in groups:
            for p in g.platforms:
                if p.price is None:
                    continue
                if p.platform not in totals:
                    totals[p.platform] = {"subtotal": 0.0, "count": 0, "eta": p.delivery_mins or 10}
                totals[p.platform]["subtotal"] += p.price
                totals[p.platform]["count"] += 1

    result = [
        CartPlatformTotal(
            platform=plat,
            subtotal=round(d["subtotal"], 2),
            item_count=d["count"],
            delivery_mins=d["eta"],
        )
        for plat, d in totals.items()
    ]
    result.sort(key=lambda x: x.subtotal)
    return result


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", version="1.3.0")


@app.post("/api/compare")
async def compare(req: CompareRequest):
    print(f"\n[REQUEST] query='{req.query}' pincode={req.pincode} mode={req.mode}")
    t0 = time.time()
    groups, demo_mode = await _compare_core(
        req.query, req.pincode, req.max_results_per_platform, req.headless, req.mode,
    )
    elapsed_ms = int((time.time() - t0) * 1000)
    total = sum(len(g.platforms) for g in groups)
    print(f"[RESPONSE] groups={len(groups)} total_listings={total} demo={demo_mode} elapsed={elapsed_ms}ms")

    if req.format == "mobile":
        return to_mobile_format(groups, req.query, req.pincode, total, demo_mode)

    return CompareResponse(
        query=req.query, pincode=req.pincode,
        elapsed_ms=elapsed_ms, total_results=total,
        demo_mode=demo_mode, groups=_groups_to_rows(groups),
    )


@app.post("/api/compare/cart")
async def compare_cart(req: CartCompareRequest):
    print(f"\n[REQUEST CART] items={[i.query for i in req.items]} pincode={req.pincode}")
    t0 = time.time()
    all_groups: List[List[ComparisonGroup]] = []
    flat_groups: List[ComparisonGroup] = []
    demo_used = False

    for item in req.items:
        groups, demo_mode = await _compare_core(item.query, req.pincode, 3, req.headless, req.mode)
        demo_used = demo_used or demo_mode
        for g in groups:
            for p in g.platforms:
                if p.price is not None: p.price  = round(p.price  * item.qty, 2)
                if p.mrp   is not None: p.mrp    = round(p.mrp    * item.qty, 2)
            g.canonical_name = f"{g.canonical_name} x{item.qty}"
        all_groups.append(groups)
        flat_groups.extend(groups)

    platform_totals = _cart_totals(all_groups)
    cheapest = platform_totals[0] if platform_totals else None
    elapsed_ms = int((time.time() - t0) * 1000)

    if req.format == "mobile":
        clusters = []
        for i, groups in enumerate(all_groups):
            m = to_mobile_format(groups, req.items[i].query, req.pincode, len(groups), demo_used)
            clusters.extend(m["clusters"])
        return {
            "pincode": req.pincode, "elapsed_ms": elapsed_ms, "demo_mode": demo_used,
            "clusters": clusters,
            "platform_totals": [t.model_dump() for t in platform_totals],
            "cheapest_platform": cheapest.platform if cheapest else "",
            "cheapest_total": cheapest.subtotal if cheapest else 0,
        }

    return CartCompareResponse(
        pincode=req.pincode, elapsed_ms=elapsed_ms, demo_mode=demo_used,
        items=_groups_to_rows(flat_groups),
        platform_totals=platform_totals,
        cheapest_platform=cheapest.platform if cheapest else "",
        cheapest_total=cheapest.subtotal if cheapest else 0,
    )


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8001, reload=True)
