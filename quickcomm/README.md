# QuickComm — Live Grocery Price Aggregator

Compare real-time prices from **Blinkit**, **Zepto**, and **Swiggy Instamart** in one search.

---

## Architecture

```
quickcomm/
├── scrapers/
│   ├── browser_factory.py  ← Stealth Playwright context (system Chrome)
│   ├── blinkit.py          ← Blinkit scraper (PRELOADED_STATE + XHR interception)
│   ├── zepto.py            ← Zepto scraper (XHR interception + DOM fallback)
│   └── instamart.py        ← Swiggy Instamart scraper
├── utils/
│   └── user_agents.py      ← Fingerprint rotation pool
├── normalizer.py           ← FuzzyWuzzy SKU grouping
├── api.py                  ← FastAPI  POST /api/compare
├── poc_blinkit.py          ← Phase 1 smoke test
└── web/                    ← Next.js 14 comparison UI (Phase 3)
    ├── src/app/page.tsx
    ├── src/components/SearchBar.tsx
    ├── src/components/ComparisonGrid.tsx
    └── src/utils/deepLinks.ts
```

---

## Quick Start

### 1 — Install Python deps

```powershell
cd quickcomm
python setup.py
```

### 2 — Phase 1: Blinkit POC

```powershell
python poc_blinkit.py
```

Launches a visible Chrome window, injects Lucknow location, searches for  
"Amul Taaza Milk 500ml", and prints prices + saves `debug_shots/poc_result.json`.

### 3 — Phase 2: FastAPI server

```powershell
uvicorn api:app --reload --port 8001
```

Then open **http://localhost:8001/docs** for the Swagger UI.

**Example cURL:**

```bash
curl -X POST http://localhost:8001/api/compare \
  -H "Content-Type: application/json" \
  -d '{"query": "Amul Taaza Milk 500ml", "pincode": "226001", "headless": true}'
```

### 4 — Phase 3: Next.js UI

```powershell
cd web
npm install
npm run dev
```

Open **http://localhost:3001** — search for any product and get a live comparison grid.

---

## API Reference

### `POST /api/compare`

| Field | Type | Default | Description |
|---|---|---|---|
| `query` | string | required | Product to search |
| `pincode` | string | required | 6-digit PIN code |
| `max_results_per_platform` | int | 5 | Scraped results per platform |
| `headless` | bool | true | Run browsers headlessly |

**Response** (`CompareResponse`):

```json
{
  "query": "Amul Taaza Milk 500ml",
  "pincode": "226001",
  "elapsed_ms": 42300,
  "total_results": 12,
  "groups": [
    {
      "canonical_name": "Amul Taaza Milk",
      "canonical_weight": "500ml",
      "best_price": 29.0,
      "best_platform": "Blinkit",
      "platforms": [
        {
          "platform": "Blinkit",
          "price": 29.0,
          "mrp": 32.0,
          "delivery_mins": 10,
          "image_url": "https://cdn.grofers.com/...",
          "weight": "500 ml",
          "deep_link": "blinkit://product?slug=amul-taaza-milk-500ml",
          "source_url": "https://blinkit.com/prd/..."
        },
        ...
      ]
    }
  ]
}
```

---

## Anti-Bot Measures

| Layer | Technique |
|---|---|
| User-Agent | Rotates across 6 real Chrome fingerprints |
| WebGL | Renderer + Vendor spoofed per fingerprint |
| Navigator | `hardwareConcurrency`, `deviceMemory`, `plugins` overridden |
| Geolocation | Lucknow lat/lng injected via Playwright permissions |
| Location | localStorage + cookies pre-loaded before SPA render |
| Scroll | Randomised human-like scroll distance + timing |
| Typing | Per-character delay with occasional mid-word pauses |
| Persistent Profile | Reuses the same Chrome profile across runs (no fresh cookies) |

---

## Deep Link Format

| Platform | Native | Web |
|---|---|---|
| Blinkit | `blinkit://search?q=...` | `https://blinkit.com/s/?q=...` |
| Zepto | `zepto://search?q=...` | `https://www.zeptonow.com/search?query=...` |
| Instamart | `swiggy://instamart?query=...` | `https://www.swiggy.com/instamart/search?query=...` |
| BigBasket | `bigbasket://search?q=...` | `https://www.bigbasket.com/ps/?q=...` |
