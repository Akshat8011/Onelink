import axios from 'axios';

export interface QuickCommProductResult {
  name: string;
  price: number;
  size: string;
  imageUrl: string;
  platform: string;
  deliveryTime: string;
  deepLink: string;
}

export interface QuickCommClusterResult {
  normalizedName: string;
  bestPrice: number;
  bestPlatform: string;
  priceSpread: number;
  products: QuickCommProductResult[];
}

export interface QuickCommCompareResponse {
  query: string;
  pincode: string;
  totalResults: number;
  clusters: QuickCommClusterResult[];
  bestOffer?: QuickCommProductResult | null;
  demoMode?: boolean;
}

// QuickComm FastAPI runs on port 8001 (not 8000)
const QUICKCOMM_API_BASE_URL =
  process.env.EXPO_PUBLIC_QUICKCOMM_API_URL ??
  (__DEV__ ? 'http://localhost:8001/api' : 'https://onelink-quickcomm.example.com/api');

const REQUEST_TIMEOUT_MS = 120_000;

/** Demo fallback when the API is unreachable */
function buildDemoResponse(query: string, pincode: string): QuickCommCompareResponse {
  const base = 29 + (query.length % 50);
  const platforms: Array<{ name: string; delta: number; eta: string }> = [
    { name: 'Blinkit',   delta: 0,  eta: '10 min' },
    { name: 'Zepto',     delta: -2, eta: '8 min'  },
    { name: 'Instamart', delta: 2,  eta: '12 min' },
  ];

  const products: QuickCommProductResult[] = platforms.map(p => ({
    name:         query,
    price:        base + p.delta,
    size:         '',
    imageUrl:     'https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,w=270/da/cms-assets/cms/product/80a7c842bcd042728cd0d1030e842015.png',
    platform:     p.name,
    deliveryTime: p.eta,
    deepLink:     `blinkit://search?q=${encodeURIComponent(query)}`,
  }));

  const best = products.reduce((a, b) => (a.price < b.price ? a : b));
  const spread = Math.max(...products.map(p => p.price)) - Math.min(...products.map(p => p.price));

  return {
    query,
    pincode,
    totalResults: products.length,
    demoMode: true,
    bestOffer: best,
    clusters: [{
      normalizedName: query,
      bestPrice:      best.price,
      bestPlatform:   best.platform,
      priceSpread:    spread,
      products,
    }],
  };
}

export async function compareProducts(
  query: string,
  pincode: string,
): Promise<QuickCommCompareResponse> {
  try {
    const response = await axios.post<QuickCommCompareResponse>(
      `${QUICKCOMM_API_BASE_URL}/compare`,
      {
        query,
        pincode,
        max_results_per_platform: 5,
        headless: true,
        mode: 'auto',
        format: 'mobile',
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: REQUEST_TIMEOUT_MS,
      },
    );

    return {
      ...response.data,
      demoMode: (response.data as QuickCommCompareResponse & { demoMode?: boolean }).demoMode ?? false,
    };
  } catch {
    // API offline or timed out — return demo data so the UI always works
    return buildDemoResponse(query, pincode);
  }
}
