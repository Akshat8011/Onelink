/**
 * deepLinks.ts — construct deep links for quick-commerce apps
 */

export interface DeepLinkSet {
  native:  string
  web:     string
  android: string
  ios:     string
}

const enc = encodeURIComponent

export function blinkitLinks(query: string): DeepLinkSet {
  return {
    native:  `blinkit://search?q=${enc(query)}`,
    web:     `https://blinkit.com/s/?q=${enc(query)}`,
    android: `https://play.google.com/store/apps/details?id=com.grofers.customerapp`,
    ios:     `https://apps.apple.com/in/app/blinkit-grocery-in-10-minutes/id1467200582`,
  }
}

export function zeptoLinks(query: string): DeepLinkSet {
  return {
    native:  `zepto://search?q=${enc(query)}`,
    web:     `https://www.zeptonow.com/search?query=${enc(query)}`,
    android: `https://play.google.com/store/apps/details?id=com.zepto.app`,
    ios:     `https://apps.apple.com/in/app/zepto-10-min-grocery-delivery/id1640216547`,
  }
}

export function instamartLinks(query: string): DeepLinkSet {
  return {
    native:  `swiggy://instamart/search?query=${enc(query)}`,
    web:     `https://www.swiggy.com/instamart/search?custom_back=true&query=${enc(query)}`,
    android: `https://play.google.com/store/apps/details?id=in.swiggy.android`,
    ios:     `https://apps.apple.com/in/app/swiggy-food-grocery-delivery/id989540920`,
  }
}

const RESOLVERS: Record<string, (q: string) => DeepLinkSet> = {
  Blinkit:   blinkitLinks,
  Zepto:     zeptoLinks,
  Instamart: instamartLinks,
}

export function getDeepLinks(platform: string, query: string): DeepLinkSet {
  const fn = RESOLVERS[platform]
  if (!fn) return { native: "#", web: "#", android: "#", ios: "#" }
  return fn(query)
}

/** Open the web store page — works in desktop browsers. */
export function openStore(platform: string, query: string, sourceUrl?: string): void {
  const url = sourceUrl || getDeepLinks(platform, query).web
  window.open(url, "_blank", "noopener,noreferrer")
}
