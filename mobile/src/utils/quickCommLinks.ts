export type RetailPlatform = 'Blinkit' | 'Zepto' | 'Instamart' | 'DemoStore' | string;

const buildQuery = (query: string) => encodeURIComponent(query.trim());

export function buildRetailDeepLink(platform: RetailPlatform, query: string): string {
  const encodedQuery = buildQuery(query);

  switch (platform.toLowerCase()) {
    case 'blinkit':
      return `blinkit://search?q=${encodedQuery}`;
    case 'zepto':
      return `zepto://search?q=${encodedQuery}`;
    case 'instamart':
      return `swiggy://instamart/search?q=${encodedQuery}`;
    default:
      return `demostore://search?q=${encodedQuery}`;
  }
}

export function buildRetailWebFallback(platform: RetailPlatform, query: string): string {
  const encodedQuery = buildQuery(query);

  switch (platform.toLowerCase()) {
    case 'blinkit':
      return `https://blinkit.com/s/?q=${encodedQuery}`;
    case 'zepto':
      return `https://www.zeptonow.com/search?query=${encodedQuery}`;
    case 'instamart':
      return `https://www.swiggy.com/instamart/search?query=${encodedQuery}`;
    default:
      return `https://www.google.com/search?q=${encodedQuery}`;
  }
}