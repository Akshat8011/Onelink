from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from scraper_service import QuickCommScraper
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="OneLink Quick-Comm API")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CompareRequest(BaseModel):
    query: str
    pincode: str

class ProductResult(BaseModel):
    name: str
    price: float
    size: str
    imageUrl: str
    platform: str
    deliveryTime: str
    deepLink: str

class ClusterResult(BaseModel):
    normalizedName: str
    products: List[ProductResult]
    bestPrice: float
    bestPlatform: str
    priceSpread: float


class CompareResponse(BaseModel):
    query: str
    pincode: str
    totalResults: int
    clusters: List[ClusterResult]
    bestOffer: Optional[ProductResult] = None

@app.post("/api/compare", response_model=CompareResponse)
async def compare_products(request: CompareRequest):
    if not request.query or not request.pincode:
        raise HTTPException(status_code=400, detail="Query and pincode are required.")
    
    scraper = QuickCommScraper(request.query, request.pincode)
    try:
        # We will run this synchronously since Selenium blocks, 
        # but in a real prod env with multiple headless instances, 
        # you'd use Celery or concurrent thread pools.
        results = await scraper.run_all_scrapers()
        
        # Normalize and cluster the results using FuzzyWuzzy
        clustered_data = scraper.normalize_and_cluster(results)

        best_offer = None
        if results:
            best_offer = min(results, key=lambda item: item["price"])

        return {
            "query": request.query,
            "pincode": request.pincode,
            "totalResults": len(results),
            "clusters": clustered_data,
            "bestOffer": best_offer,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
