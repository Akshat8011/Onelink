"""
BookMyShow Lucknow Events Scraper
Extracts live movie and event listings for the OneLink City Events module.
Runs headless with explicit WebDriverWait (no hardcoded sleeps).
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin

import pandas as pd
from selenium import webdriver
from selenium.common.exceptions import (
    StaleElementReferenceException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CITY = "Lucknow"
CITY_SLUG = "lucknow"
BASE_URL = "https://in.bookmyshow.com"
LISTING_PAGES = {
    "event": f"{BASE_URL}/explore/events-{CITY_SLUG}",
    "comedy": f"{BASE_URL}/explore/comedy-shows-{CITY_SLUG}",
    "music": f"{BASE_URL}/explore/concerts-{CITY_SLUG}",
    "activities": f"{BASE_URL}/explore/activities-{CITY_SLUG}",
    "sports": f"{BASE_URL}/explore/sports-{CITY_SLUG}",
    "plays": f"{BASE_URL}/explore/plays-{CITY_SLUG}",
}
# movies-* is intentionally omitted: the home page already returns the movie
# slate, and explore/movies-{city} frequently stalls behind bot challenges on CI
# (observed: ~2.5 min "Listing content not detected" then cascade failures).
HOME_URL = f"{BASE_URL}/explore/home/{CITY_SLUG}"

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "data"
CSV_PATH = DATA_DIR / "events_lucknow.csv"
JSON_PATH = DATA_DIR / "events_lucknow.json"

DEFAULT_WAIT_SECONDS = int(os.getenv("BMS_WAIT_SECONDS", "12"))
MAX_DETAIL_ITEMS = int(os.getenv("BMS_MAX_DETAIL_ITEMS", "0"))  # 0 = no limit
SKIP_DETAILS = os.getenv("BMS_SKIP_DETAILS", "0") == "1"
# Stop opening more listing pages once we have this many unique ET codes.
MIN_SUCCESS_COUNT = int(os.getenv("BMS_MIN_SUCCESS_COUNT", "15"))
# Soft per-category wall-clock budget (seconds). Prevents one stuck page from
# burning the whole GitHub Actions step.
CATEGORY_BUDGET_SEC = float(os.getenv("BMS_CATEGORY_BUDGET_SEC", "55"))

LANGUAGE_KEYWORDS = {
    "hindi": "Hindi",
    "english": "English",
    "tamil": "Tamil",
    "telugu": "Telugu",
    "kannada": "Kannada",
    "malayalam": "Malayalam",
    "bengali": "Bengali",
    "marathi": "Marathi",
    "punjabi": "Punjabi",
    "gujarati": "Gujarati",
}

CENSOR_PATTERN = re.compile(r"\b(UA\s*16\+|U/A\s*16\+|U/A|UA|U|A)\b", re.I)
ET_PATTERN = re.compile(r"(ET\d+)", re.I)
HEART_PATTERN = re.compile(r"(\d+(?:\.\d+)?[KkMm]?)\s*(?:likes|Likes|hearts)", re.I)
RATING_PATTERN = re.compile(r"(\d{1,3}(?:\.\d+)?%)\s*(?:liked|users|User)", re.I)
VENUE_PATTERN = re.compile(
    r"\b(PVR|INOX|Cinepolis|Crown|Cinépolis|Wave|Jagat|Ratnakar)[^\n]{0,80}",
    re.I,
)
RELEASE_DATE_PATTERN = re.compile(
    r"(?:Releasing on|Release Date:?)\s*(\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{4})",
    re.I,
)
BMS_DATE_FORMATS = (
    "%d %b, %Y",
    "%d %b %Y",
    "%b %d, %Y",
    "%d %B, %Y",
    "%d %B %Y",
    "%Y-%m-%d",
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("bms_scraper")


# ---------------------------------------------------------------------------
# WebDriver setup
# ---------------------------------------------------------------------------


def _chrome_options(binary: str = "") -> Options:
    options = Options()
    options.page_load_strategy = "eager"
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--lang=en-IN")
    options.add_argument(
        "--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    if binary:
        options.binary_location = binary
    return options


def create_driver() -> WebDriver:
    """Configure and return a headless Chrome WebDriver.

    Prefers CHROME_BIN when set (CI via browser-actions/setup-chrome). Falls back
    to Selenium Manager if the provided binary won't start (common when CHROME_BIN
    points at Ubuntu's broken chromium snap stub).
    """
    chrome_bin = (os.getenv("CHROME_BIN") or "").strip()
    last_error: Optional[Exception] = None
    candidates = [chrome_bin] if chrome_bin else []
    candidates.append("")  # Selenium Manager / system Chrome

    for binary in candidates:
        try:
            if binary:
                logger.info("Starting Chrome with binary: %s", binary)
            else:
                logger.info("Starting Chrome via Selenium Manager (no CHROME_BIN)")
            driver = webdriver.Chrome(options=_chrome_options(binary))
            driver.set_page_load_timeout(int(os.getenv("BMS_PAGE_TIMEOUT", "45")))
            driver.set_script_timeout(int(os.getenv("BMS_SCRIPT_TIMEOUT", "30")))
            driver.execute_cdp_cmd(
                "Page.addScriptToEvaluateOnNewDocument",
                {
                    "source": "Object.defineProperty(navigator, 'webdriver', "
                    "{get: () => undefined})"
                },
            )
            return driver
        except WebDriverException as exc:
            last_error = exc
            logger.warning("Chrome start failed (binary=%r): %s", binary or None, exc)

    raise WebDriverException(f"Unable to start Chrome WebDriver: {last_error}")


def safe_get(driver: WebDriver, wait: WebDriverWait, url: str) -> bool:
    """Navigate to a URL with timeout recovery."""
    try:
        driver.get(url)
        wait_for_page(driver, wait)
        return True
    except TimeoutException:
        logger.warning("Page load timeout for %s — continuing with partial DOM.", url)
        try:
            driver.execute_script("window.stop();")
        except WebDriverException:
            pass
        return True
    except WebDriverException as exc:
        logger.error("Failed to load %s: %s", url, exc)
        return False


def wait_for_page(driver: WebDriver, wait: WebDriverWait) -> None:
    """Wait until the document has a body (eager strategy already brings interactive)."""
    wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    try:
        # Prefer interactive/complete quickly; never burn the full wait on "complete".
        WebDriverWait(driver, min(5, DEFAULT_WAIT_SECONDS)).until(
            lambda d: d.execute_script("return document.readyState")
            in ("interactive", "complete")
        )
    except TimeoutException:
        pass


def dismiss_popups(driver: WebDriver, wait: WebDriverWait) -> None:
    """Dismiss common BookMyShow overlays without sleeping."""
    popup_xpaths = [
        '//button[contains(text(), "Not Now")]',
        '//button[contains(text(), "Got It")]',
        '//button[contains(text(), "Accept")]',
    ]
    for xpath in popup_xpaths:
        try:
            buttons = driver.find_elements(By.XPATH, xpath)
            if buttons:
                wait.until(EC.element_to_be_clickable(buttons[0]))
                buttons[0].click()
                wait_for_page(driver, wait)
                break
        except (WebDriverException, TimeoutException):
            continue


def wait_for_listings_content(driver: WebDriver, wait: WebDriverWait) -> None:
    """Wait until at least one BookMyShow event/movie link appears.

    IMPORTANT: Do NOT poll driver.page_source here. On BMS pages the HTML is huge;
    re-serializing it every poll turns a 12s wait into multi-minute stalls and is
    exactly what produced the CI log "Listing content not detected within wait
    window" ~2.5 minutes after opening movies-lucknow.
    """
    try:
        wait.until(
            lambda d: bool(
                d.find_elements(
                    By.CSS_SELECTOR,
                    "a[href*='/ET'], a[href*='ET0'], a[href*='ET1'], a[href*='ET2'], "
                    "a[href*='ET3'], a[href*='ET4'], a[href*='ET5'], a[href*='ET6'], "
                    "a[href*='ET7'], a[href*='ET8'], a[href*='ET9'], "
                    "script[type='application/ld+json']",
                )
            )
        )
    except TimeoutException:
        logger.warning("Listing content not detected within wait window.")


def scroll_page(driver: WebDriver, passes: int = 4) -> None:
    """Lightweight scroll to trigger lazy-loaded cards (no long readyState waits)."""
    last_height = 0
    for _ in range(passes):
        try:
            driver.execute_script(
                "window.scrollBy(0, Math.max(window.innerHeight, 900));"
            )
        except WebDriverException:
            break
        time.sleep(0.45)
        try:
            new_height = int(driver.execute_script("return document.body.scrollHeight") or 0)
        except WebDriverException:
            break
        if new_height == last_height:
            break
        last_height = new_height


# ---------------------------------------------------------------------------
# Listing extraction
# ---------------------------------------------------------------------------


def _merge_listings(
    merged: Dict[str, Dict[str, Any]],
    items: List[Dict[str, Any]],
) -> None:
    for item in items:
        key = item["event_code"]
        if key not in merged or (not merged[key]["booking_url"] and item["booking_url"]):
            merged[key] = item


def _parse_og_image_from_html(html: str) -> str:
    """Extract the real event poster from BookMyShow og:image meta tags."""
    patterns = [
        re.compile(r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', re.I),
        re.compile(r'content=["\']([^"\']+)["\']\s+property=["\']og:image["\']', re.I),
        re.compile(
            r'(https://assets-in\.bmscdn\.com/discovery-catalog/events/[^"\'\s>]+\.(?:jpg|jpeg|png|webp))',
            re.I,
        ),
    ]
    for pattern in patterns:
        match = pattern.search(html or "")
        if match:
            url = match.group(1).strip()
            if url and "discovery-catalog/events" in url:
                return _upgrade_image_url(url)
    return ""


def _upgrade_image_url(url: str) -> str:
    """Use ImageKit transformations for optimized poster display."""
    if not url:
        return url
    upgraded = url
    if "-portrait." in upgraded:
        upgraded = upgraded.replace("-portrait.", "-landscape.")
    if "tr:w-" in upgraded:
        upgraded = re.sub(r"tr:w-\d+,h-\d+[^/]*", "tr:w-600,h-400,fo-auto", upgraded)
    elif "bmscdn.com" in upgraded and "/events/" in upgraded:
        last_slash = upgraded.rfind("/")
        if last_slash != -1:
            upgraded = upgraded[:last_slash] + "/tr:w-600,h-400,fo-auto" + upgraded[last_slash:]
    return upgraded


def _parse_bms_date(raw: str) -> str:
    """Parse BookMyShow date strings to ISO format (YYYY-MM-DD)."""
    if not raw or not str(raw).strip():
        return ""
    text = str(raw).strip()
    cleaned = re.sub(r"\s+", " ", text.replace(",", ", "))
    for fmt in BMS_DATE_FORMATS:
        try:
            return datetime.strptime(cleaned, fmt).date().isoformat()
        except ValueError:
            continue
    # Fallback: extract dd Mon yyyy
    match = re.search(r"(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})", text)
    if match:
        try:
            return datetime.strptime(
                f"{match.group(1)} {match.group(2)} {match.group(3)}", "%d %b %Y"
            ).date().isoformat()
        except ValueError:
            try:
                return datetime.strptime(
                    f"{match.group(1)} {match.group(2)} {match.group(3)}", "%d %B %Y"
                ).date().isoformat()
            except ValueError:
                pass
    return ""


def _parse_prices_from_html(html: str) -> int:
    prices: List[int] = []
    for match in re.findall(r"₹\s*([\d,]+)", html):
        try:
            prices.append(int(match.replace(",", "")))
        except ValueError:
            continue
    return min(prices) if prices else 0


def _parse_showtimes_from_html(html: str) -> str:
    times = sorted(set(re.findall(r"\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b", html, re.I)))
    return ", ".join(times[:5])


def _format_time_from_raw(raw: str) -> str:
    """Convert BMS validFrom/startDate strings to a readable clock time."""
    if not raw:
        return ""
    match = re.search(r"(\d{1,2}):(\d{2})", raw)
    if not match:
        return ""
    hour = int(match.group(1))
    minute = match.group(2)
    suffix = "AM" if hour < 12 else "PM"
    display_hour = hour % 12 or 12
    return f"{display_hour}:{minute} {suffix}"


def _parse_date_from_raw(raw: str) -> str:
    if not raw:
        return ""
    iso_match = re.search(r"(\d{4}-\d{2}-\d{2})", raw)
    if iso_match:
        return iso_match.group(1)
    return _parse_bms_date(raw)


def _is_lucknow_location(location: Any) -> bool:
    if not isinstance(location, dict):
        return False
    name = str(location.get("name") or "").lower()
    if "lucknow" in name:
        return True
    address = location.get("address") or {}
    if isinstance(address, dict):
        locality = str(address.get("addressLocality") or "").lower()
        if locality == "lucknow":
            return True
    return False


def _collect_lucknow_json_ld(obj: Any, matches: List[Dict[str, Any]]) -> None:
    if isinstance(obj, dict):
        location = obj.get("location")
        offers = obj.get("offers")
        start_raw = obj.get("startDate") or obj.get("validFrom")
        prices: List[float] = []

        if isinstance(offers, dict):
            offers = [offers]
        if isinstance(offers, list):
            for offer in offers:
                if not isinstance(offer, dict):
                    continue
                price = offer.get("price")
                if price is not None:
                    try:
                        prices.append(float(str(price).replace(",", "")))
                    except ValueError:
                        pass
                if not start_raw:
                    start_raw = offer.get("validFrom") or offer.get("startDate")

        venue_name = ""
        if isinstance(location, dict):
            venue_name = str(location.get("name") or "").strip()

        if _is_lucknow_location(location) or (venue_name and "lucknow" in venue_name.lower()):
            entry: Dict[str, Any] = {}
            if venue_name:
                entry["venue"] = venue_name
            if start_raw:
                entry["event_date"] = _parse_date_from_raw(str(start_raw))
                entry["show_time"] = _format_time_from_raw(str(start_raw))
            if prices:
                entry["min_price"] = min(prices)
            if entry:
                matches.append(entry)

        for value in obj.values():
            _collect_lucknow_json_ld(value, matches)
    elif isinstance(obj, list):
        for item in obj:
            _collect_lucknow_json_ld(item, matches)


def _parse_movie_venues_from_html(html: str) -> List[str]:
    venues: List[str] = []
    patterns = [
        r"((?:PVR|INOX|Cinepolis|Cinépolis|Wave|Crown):\s*[^<\"\\]{3,80}?Lucknow)",
        r'"name":"((?:PVR|INOX|Cinepolis|Wave|Crown)[^"]{3,80}?Lucknow)"',
    ]
    for pattern in patterns:
        for match in re.findall(pattern, html, re.I):
            clean = re.sub(r"\s+", " ", match).strip(" ,")
            if len(clean) < 10 or clean in venues:
                continue
            venues.append(clean)
    return venues[:6]


def _parse_lucknow_offers_from_html(html: str) -> Dict[str, Any]:
    """Parse embedded Lucknow venue/date/price blocks from event detail HTML."""
    result: Dict[str, Any] = {}
    venue_match = re.search(
        r'"name":"([^"]*Lucknow[^"]*)".*?"offers":\[(.*?)\]\}',
        html,
        re.I | re.S,
    )
    if not venue_match:
        return result

    venue_name = venue_match.group(1).strip()
    offers_blob = venue_match.group(2)
    if venue_name:
        result["venues_list"] = [venue_name]

    valid_from = re.search(r'"validFrom":"([^"]+)"', offers_blob)
    if valid_from:
        raw = valid_from.group(1)
        result["event_date"] = _parse_date_from_raw(raw)
        result["show_time"] = _format_time_from_raw(raw)

    prices: List[float] = []
    for price in re.findall(r'"price":"([\d.]+)"', offers_blob):
        try:
            prices.append(float(price))
        except ValueError:
            continue
    if prices:
        result["min_price"] = min(prices)

    return result


def _extract_et_code(url: str, image_url: str = "") -> Optional[str]:
    for source in (url, image_url):
        if not source:
            continue
        match = ET_PATTERN.search(source)
        if match:
            return match.group(1).upper()
    return None


def _normalize_booking_url(url: str) -> str:
    """Rewrite legacy BMS paths to the current /movies/{city}/... format."""
    if not url:
        return url
    # Old: /lucknow/movies/slug/ETxxxx  →  /movies/lucknow/slug/ETxxxx
    updated = re.sub(
        rf"({re.escape(BASE_URL)})/{CITY_SLUG}/movies/",
        rf"\1/movies/{CITY_SLUG}/",
        url,
        flags=re.I,
    )
    return updated


def _build_booking_url(href: str, category: str, et_code: str, title: str) -> str:
    if href and href.startswith("http"):
        return _normalize_booking_url(href)
    if href:
        return _normalize_booking_url(urljoin(BASE_URL, href))

    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    if category == "movie":
        return f"{BASE_URL}/movies/{CITY_SLUG}/{slug}/{et_code}"
    return f"{BASE_URL}/events/{slug}/{et_code}"


def infer_language(url: str, title: str, explicit: str = "") -> str:
    if explicit:
        if isinstance(explicit, list):
            return ", ".join(str(x) for x in explicit)
        return str(explicit)

    combined = f"{url} {title}".lower()
    found = []
    for key, label in LANGUAGE_KEYWORDS.items():
        if key in combined and label not in found:
            found.append(label)
    return ", ".join(found) if found else ""


def infer_censor(text: str, explicit: str = "") -> str:
    if explicit:
        return str(explicit)
    match = CENSOR_PATTERN.search(text or "")
    return match.group(1).upper().replace(" ", "") if match else ""


def _is_lucknow_event(title: str) -> bool:
    """Skip nationally promoted events that are clearly for other cities."""
    other_cities = (
        "mumbai", "bengaluru", "bangalore", "delhi", "ncr", "hyderabad",
        "chennai", "kolkata", "pune", "ahmedabad", "goa", "jaipur",
    )
    lower = title.lower()
    if "lucknow" in lower:
        return True
    return not any(f"- {city}" in lower or f" {city}" in lower for city in other_cities)


def parse_json_ld_listings(html: str, category: str) -> List[Dict[str, Any]]:
    """Parse ItemList JSON-LD blocks for titles and booking URLs."""
    listings: List[Dict[str, Any]] = []

    for block in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try:
            data = json.loads(block.group(1))
        except json.JSONDecodeError:
            continue

        if not isinstance(data, dict) or data.get("@type") != "ItemList":
            continue

        for item in data.get("itemListElement", []):
            if not isinstance(item, dict):
                continue
            title = (item.get("name") or "").strip()
            if not title:
                continue
            if category == "event" and not _is_lucknow_event(title):
                continue

            url = (item.get("url") or "").strip()
            image = (item.get("image") or "").strip()
            et_code = _extract_et_code(url, image)
            if not et_code:
                continue

            listings.append(
                {
                    "title": title,
                    "language": infer_language(url or image, title),
                    "censor_rating": infer_censor(title),
                    "booking_url": _build_booking_url(url, category, et_code, title),
                    "heart_count": "",
                    "user_rating": "",
                    "venues": "",
                    "event_date": "",
                    "show_times": "",
                    "min_price": "",
                    "category": category,
                    "image_url": _upgrade_image_url(image),
                    "event_code": et_code,
                    "city": CITY,
                }
            )

    return listings


def parse_href_listings(html: str, category: str) -> List[Dict[str, Any]]:
    """Fallback: extract booking URLs from anchor href patterns."""
    listings: List[Dict[str, Any]] = []
    if category == "movie":
        pattern = re.compile(
            r'href="((?:/|https://in\.bookmyshow\.com/)[^"]*/movies/[^"]*ET\d+[^"]*)"',
            re.I,
        )
    else:
        # Events / comedy / activities / sports / plays share ET codes across
        # /events/, /activities/, /sports/, etc.
        pattern = re.compile(
            r'href="((?:/|https://in\.bookmyshow\.com/)[^"]*ET\d+[^"]*)"',
            re.I,
        )

    seen: Set[str] = set()
    for href in pattern.findall(html):
        full_url = urljoin(BASE_URL, href)
        et_code = _extract_et_code(full_url)
        if not et_code or et_code in seen:
            continue
        seen.add(et_code)

        slug_match = re.search(
            rf"/(?:movies/{CITY_SLUG}|{CITY_SLUG}/movies|events|activities|"
            rf"sports|plays|movies)/([^/]+)/",
            full_url,
            re.I,
        )
        title = (slug_match.group(1) if slug_match else et_code).replace("-", " ").title()

        listings.append(
            {
                "title": title,
                "language": infer_language(full_url, title),
                "censor_rating": "",
                "booking_url": _normalize_booking_url(full_url),
                "heart_count": "",
                "user_rating": "",
                "venues": "",
                "event_date": "",
                "show_times": "",
                "min_price": "",
                "category": category,
                "image_url": "",
                "event_code": et_code,
                "city": CITY,
            }
        )

    return listings


def extract_listings_from_current_page(
    driver: WebDriver,
    wait: WebDriverWait,
    category: str,
) -> List[Dict[str, Any]]:
    """Parse listing cards from the already-loaded page."""
    scroll_page(driver)
    # Cheap readiness check only — do not re-poll page_source.
    try:
        WebDriverWait(driver, min(6, DEFAULT_WAIT_SECONDS)).until(
            lambda d: bool(d.find_elements(By.CSS_SELECTOR, "a[href*='ET']"))
        )
    except TimeoutException:
        pass
    html = driver.page_source
    listings = parse_json_ld_listings(html, category)
    if not listings:
        listings = parse_href_listings(html, category)
    logger.info("Found %d %s items on %s", len(listings), category, driver.current_url)
    return listings


def _scrape_category_session(
    page_url: str,
    category: str,
    enrich_limit: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Scrape one category in an isolated browser session."""
    started = time.monotonic()
    driver = create_driver()
    # Short wait object — never use the full DEFAULT for popup clickable waits.
    wait = WebDriverWait(driver, DEFAULT_WAIT_SECONDS)

    try:
        logger.info("Opening %s listing: %s", category, page_url)
        if not safe_get(driver, wait, page_url):
            return []

        if time.monotonic() - started > CATEGORY_BUDGET_SEC:
            logger.warning("Category %s exceeded budget after navigation — skipping.", category)
            return []

        dismiss_popups(driver, WebDriverWait(driver, 3))
        wait_for_listings_content(driver, WebDriverWait(driver, min(10, DEFAULT_WAIT_SECONDS)))
        items = extract_listings_from_current_page(driver, wait, category)

        if not items:
            return items

        if SKIP_DETAILS:
            logger.info("Skipping %s detail enrichment.", category)
            return items

        limit = enrich_limit if enrich_limit is not None else len(items)
        to_enrich = items[:limit]
        remainder = items[limit:]

        enriched: List[Dict[str, Any]] = []
        for index, item in enumerate(to_enrich):
            if time.monotonic() - started > CATEGORY_BUDGET_SEC:
                logger.warning("Category %s budget hit mid-enrich — returning partial.", category)
                return enriched + to_enrich[index:] + remainder
            logger.info(
                "Enriching %s (%d/%d): %s",
                category,
                index + 1,
                len(to_enrich),
                item["title"],
            )
            enriched.append(scrape_item_details_on_listing(driver, wait, item))
            if index < len(to_enrich) - 1:
                try:
                    _return_to_listing(driver, wait)
                except WebDriverException:
                    logger.warning("Could not return to listing after %s", item["title"])

        return enriched + remainder

    finally:
        try:
            driver.quit()
        except Exception:
            pass


def collect_all_listings() -> List[Dict[str, Any]]:
    """Gather movie and event listings using separate browser sessions.

    Strategy (tuned for GitHub Actions + BMS bot challenges):
      1. Scrape home first — reliably returns the movie slate (~10 items).
      2. Scrape event/activity verticals next.
      3. Skip explore/movies-{city} (known stall page on CI).
      4. Stop early once MIN_SUCCESS_COUNT unique listings are collected.
      5. Never let one category exception / hang wipe progress.
    """
    merged: Dict[str, Dict[str, Any]] = {}
    per_category_limit = MAX_DETAIL_ITEMS if MAX_DETAIL_ITEMS else None
    categories: List[Tuple[str, str]] = [("movie", HOME_URL)]
    categories.extend((key, url) for key, url in LISTING_PAGES.items())

    for key, url in categories:
        if key != "movie" and len(merged) >= MIN_SUCCESS_COUNT:
            logger.info(
                "Already have %d listings (>= %d) — skipping remaining categories.",
                len(merged),
                MIN_SUCCESS_COUNT,
            )
            break

        logger.info("Scraping category: %s", key)
        try:
            items = _scrape_category_session(url, key, enrich_limit=per_category_limit)
            _merge_listings(merged, items)
            logger.info("Running total after %s: %d unique listings", key, len(merged))
        except Exception as exc:
            logger.error("Category %s failed: %s", key, exc)

    return list(merged.values())


# ---------------------------------------------------------------------------
# Detail-page enrichment
# ---------------------------------------------------------------------------


def _parse_json_ld_detail(driver: WebDriver) -> Dict[str, Any]:
    details: Dict[str, Any] = {}
    lucknow_matches: List[Dict[str, Any]] = []

    for script in driver.find_elements(By.CSS_SELECTOR, 'script[type="application/ld+json"]'):
        try:
            data = json.loads(script.get_attribute("innerHTML") or "{}")
        except json.JSONDecodeError:
            continue

        _collect_lucknow_json_ld(data, lucknow_matches)

        if not isinstance(data, dict):
            continue
        if data.get("@type") not in ("Movie", "Event", "MusicEvent", "TheaterEvent"):
            continue

        details["title"] = data.get("name") or details.get("title")
        details["language"] = data.get("inLanguage") or details.get("language")
        details["censor_rating"] = data.get("contentRating") or details.get("censor_rating")

        raw_date = (
            data.get("datePublished")
            or data.get("releaseDate")
            or data.get("startDate")
            or data.get("endDate")
        )
        if raw_date and not details.get("event_date"):
            parsed = _parse_bms_date(str(raw_date))
            if not parsed and "T" in str(raw_date):
                parsed = str(raw_date).split("T")[0]
            if parsed:
                details["event_date"] = parsed

        if data.get("image"):
            details["image_url"] = _upgrade_image_url(str(data.get("image")))

        rating = data.get("aggregateRating") or {}
        if isinstance(rating, dict):
            if rating.get("ratingValue"):
                details["user_rating"] = f"{rating['ratingValue']}%"
            if rating.get("ratingCount"):
                details["heart_count"] = str(rating["ratingCount"])

        location = data.get("location") or {}
        if isinstance(location, dict) and location.get("name"):
            details.setdefault("venues_list", [])
            details["venues_list"].append(location["name"])

    if lucknow_matches:
        best = lucknow_matches[0]
        if best.get("venue"):
            details["venues_list"] = [best["venue"]]
        if best.get("event_date"):
            details["event_date"] = best["event_date"]
        if best.get("show_time"):
            details["show_time"] = best["show_time"]
        if best.get("min_price"):
            details["min_price"] = str(int(best["min_price"]))

    return details


def _parse_ratings_from_html(html: str) -> Dict[str, str]:
    result: Dict[str, str] = {}
    hearts = HEART_PATTERN.findall(html)
    ratings = RATING_PATTERN.findall(html)
    if hearts:
        result["heart_count"] = hearts[0]
    if ratings:
        result["user_rating"] = ratings[0]
    return result


def _parse_venues_from_page(driver: WebDriver) -> List[str]:
    venues: List[str] = []
    body_text = driver.find_element(By.TAG_NAME, "body").text
    for line in body_text.split("\n"):
        line = line.strip()
        if VENUE_PATTERN.search(line) and 5 < len(line) < 120:
            if line not in venues:
                venues.append(line)

    html = driver.page_source
    for match in re.findall(r'"(?:cinemaName|venueName|theatreName)":"([^"]+)"', html, re.I):
        if match not in venues:
            venues.append(match)

    return venues


def _slug_from_booking_url(url: str) -> str:
    # Supports /movies/lucknow/slug/ET…, /lucknow/movies/slug/ET…, /events/slug/ET…
    match = re.search(
        rf"/(?:movies/{CITY_SLUG}|{CITY_SLUG}/movies|events)/([^/]+)/",
        url,
        re.I,
    )
    return match.group(1).lower() if match else ""


def _click_et_on_current_page(
    driver: WebDriver,
    wait: WebDriverWait,
    et_code: str,
    booking_url: str = "",
) -> bool:
    """Click a listing card for the given ET code or URL slug on the current page."""
    slug = _slug_from_booking_url(booking_url)
    selectors: List[str] = []
    if et_code:
        selectors.extend([f'a[href*="{et_code}"]', f'a[href*="{et_code.lower()}"]'])
    if slug:
        selectors.append(f'a[href*="{slug}"]')

    for selector in selectors:
        try:
            anchors = driver.find_elements(By.CSS_SELECTOR, selector)
            # Prefer Lucknow-specific links, then any non-explore link
            anchors.sort(
                key=lambda a: (
                    0 if "lucknow" in (a.get_attribute("href") or "").lower() else 1,
                    0 if (a.get_attribute("href") or "").count("/") else 1,
                )
            )
            for anchor in anchors:
                href = anchor.get_attribute("href") or ""
                if "explore" in href or not href:
                    continue
                wait.until(EC.element_to_be_clickable(anchor))
                driver.execute_script("arguments[0].click();", anchor)
                wait_for_page(driver, wait)
                if "blocked" not in driver.title.lower():
                    return True
        except (StaleElementReferenceException, WebDriverException, TimeoutException):
            continue
    return False


def _return_to_listing(driver: WebDriver, wait: WebDriverWait) -> None:
    """Navigate back to the listing page after visiting a detail or venue page."""
    for _ in range(3):
        if "explore" in driver.current_url.lower():
            break
        try:
            driver.back()
            wait_for_page(driver, wait)
        except WebDriverException:
            break
    scroll_page(driver, passes=2)
    wait_for_listings_content(driver, WebDriverWait(driver, min(6, DEFAULT_WAIT_SECONDS)))


def scrape_item_details_on_listing(
    driver: WebDriver,
    wait: WebDriverWait,
    item: Dict[str, Any],
) -> Dict[str, Any]:
    """Enrich a single item by clicking it on the already-open listing page."""
    enriched = dict(item)
    et_code = item["event_code"]

    try:
        opened = _click_et_on_current_page(driver, wait, et_code, item.get("booking_url", ""))
        if not opened or "blocked" in driver.title.lower():
            logger.warning("Could not open detail page for %s", item["title"])
            return enriched

        enriched = _extract_detail_fields(driver, wait, enriched)

    except WebDriverException as exc:
        logger.warning("Detail scrape failed for %s: %s", item["title"], exc)

    return enriched


def _extract_detail_fields(
    driver: WebDriver,
    wait: WebDriverWait,
    enriched: Dict[str, Any],
) -> Dict[str, Any]:
    """Parse ratings and venues from the current detail / venue page."""
    json_ld = _parse_json_ld_detail(driver)
    html = driver.page_source
    html_ratings = _parse_ratings_from_html(html)
    body_text = driver.find_element(By.TAG_NAME, "body").text

    if json_ld.get("title"):
        enriched["title"] = json_ld["title"]
    if json_ld.get("language"):
        enriched["language"] = infer_language(
            enriched["booking_url"], enriched["title"], json_ld["language"]
        )
    if json_ld.get("censor_rating"):
        enriched["censor_rating"] = infer_censor(body_text, json_ld["censor_rating"])
    elif not enriched.get("censor_rating"):
        enriched["censor_rating"] = infer_censor(body_text)

    enriched["heart_count"] = (
        json_ld.get("heart_count")
        or html_ratings.get("heart_count")
        or enriched.get("heart_count", "")
    )
    enriched["user_rating"] = (
        json_ld.get("user_rating")
        or html_ratings.get("user_rating")
        or enriched.get("user_rating", "")
    )

    if json_ld.get("image_url"):
        enriched["image_url"] = json_ld["image_url"]
    elif not enriched.get("image_url"):
        og_image = _parse_og_image_from_html(html)
        if og_image:
            enriched["image_url"] = og_image
    elif enriched.get("image_url"):
        enriched["image_url"] = _upgrade_image_url(enriched["image_url"])

    release_match = RELEASE_DATE_PATTERN.search(html)
    if release_match:
        parsed_release = _parse_bms_date(release_match.group(1))
        if parsed_release:
            enriched["event_date"] = parsed_release
    elif json_ld.get("event_date"):
        enriched["event_date"] = json_ld["event_date"]

    lucknow_html = _parse_lucknow_offers_from_html(html)
    if lucknow_html.get("event_date"):
        enriched["event_date"] = lucknow_html["event_date"]
    if lucknow_html.get("show_time"):
        json_ld["show_time"] = lucknow_html["show_time"]
    if lucknow_html.get("min_price"):
        enriched["min_price"] = str(int(lucknow_html["min_price"]))
    if lucknow_html.get("venues_list"):
        json_ld["venues_list"] = lucknow_html["venues_list"]

    venues: List[str] = list(json_ld.get("venues_list") or [])
    showtimes = json_ld.get("show_time") or ""

    if enriched.get("category") == "movie" and not venues:
        venues.extend(_parse_movie_venues_from_html(html))

    if not showtimes:
        showtimes = _parse_showtimes_from_html(html)

    # Only trust loose HTML ₹ scraping for non-movie events. Movie pages often
    # contain unrelated ₹ amounts (promos, gift cards) that look like ticket prices.
    if not enriched.get("min_price") and enriched.get("category") != "movie":
        min_price = _parse_prices_from_html(html)
        if min_price:
            enriched["min_price"] = str(min_price)

    if venues:
        seen: Set[str] = set()
        unique_venues = []
        for venue in venues:
            if venue not in seen:
                seen.add(venue)
                unique_venues.append(venue)
        enriched["venues"] = "; ".join(unique_venues[:8])

    if showtimes:
        enriched["show_times"] = showtimes

    if enriched.get("category") == "movie":
        has_real_showtimes = bool(
            enriched.get("show_times")
            and "releasing" not in str(enriched.get("show_times", "")).lower()
        )
        # Movies without bookable showtimes must not show a guessed price.
        if not has_real_showtimes:
            enriched["min_price"] = ""
        if enriched.get("event_date"):
            try:
                release_day = datetime.strptime(enriched["event_date"], "%Y-%m-%d").date()
                today = datetime.now(timezone.utc).date()
                if release_day > today:
                    enriched["min_price"] = ""
                    if not enriched.get("show_times"):
                        enriched["show_times"] = "Releasing soon"
            except ValueError:
                pass

    return enriched


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


def build_dataframe(records: List[Dict[str, Any]]) -> pd.DataFrame:
    """Create a clean Pandas DataFrame from scraped records."""
    columns = [
        "title",
        "language",
        "censor_rating",
        "booking_url",
        "heart_count",
        "user_rating",
        "venues",
        "event_date",
        "show_times",
        "min_price",
        "category",
        "image_url",
        "event_code",
        "city",
        "scraped_at",
    ]

    scraped_at = datetime.now(timezone.utc).isoformat()
    for record in records:
        record["scraped_at"] = scraped_at
        for col in columns:
            record.setdefault(col, "")

    df = pd.DataFrame(records, columns=columns)
    df = df.drop_duplicates(subset=["event_code"], keep="first")
    df = df.sort_values(by=["category", "title"]).reset_index(drop=True)
    return df


def _merge_event_record(previous: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    """Union two listings for the same event_code without destroying good fields.

    Empty/blank incoming values (especially image_url) must NOT overwrite a real
    previous value — that is what wiped posters when a partial CI scrape
    replaced the 55-event catalog with 17 blank-image rows.
    """
    merged = dict(previous)
    for key, value in incoming.items():
        if key == "scraped_at":
            continue
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        merged[key] = value
    prev_img = (previous.get("image_url") or "").strip()
    new_img = (incoming.get("image_url") or "").strip()
    if prev_img and not new_img:
        merged["image_url"] = previous["image_url"]
    return merged


def export_dataset(df: pd.DataFrame) -> None:
    """Export the DataFrame to CSV and JSON.

    Always union with the previous on-disk catalog by event_code:
      - New ET codes are ADDED
      - Existing live events are KEPT (never dropped just because this scrape
        missed their category page)
      - Blank image_url from a shallow scrape never erases a real poster
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    preserve = os.getenv("BMS_PRESERVE_ON_EMPTY", "1") == "1"
    previous_events: List[Dict[str, Any]] = []
    if JSON_PATH.exists():
        try:
            with JSON_PATH.open(encoding="utf-8") as fp:
                previous = json.load(fp)
            previous_events = list(previous.get("events") or [])
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("Could not read previous dataset: %s", exc)

    if df.empty and preserve and previous_events:
        logger.warning(
            "New scrape returned 0 events — keeping previous dataset (%d events).",
            len(previous_events),
        )
        return

    incoming = df.to_dict(orient="records") if not df.empty else []
    if preserve and previous_events:
        by_code: Dict[str, Dict[str, Any]] = {}
        for event in previous_events:
            code = str(event.get("event_code") or "").upper()
            if code:
                by_code[code] = dict(event)

        added = 0
        updated = 0
        for record in incoming:
            code = str(record.get("event_code") or "").upper()
            if not code:
                continue
            if code in by_code:
                by_code[code] = _merge_event_record(by_code[code], record)
                updated += 1
            else:
                by_code[code] = dict(record)
                added += 1

        logger.info(
            "Catalog union: previous=%d incoming=%d updated=%d added=%d → total=%d",
            len(previous_events),
            len(incoming),
            updated,
            added,
            len(by_code),
        )
        df = build_dataframe(list(by_code.values()))
    elif incoming:
        df = build_dataframe(incoming)

    # Safety rail: never shrink the live catalog by more than half unless
    # explicitly forced (guards against another partial-scrape wipe).
    force_shrink = os.getenv("BMS_ALLOW_SHRINK", "0") == "1"
    if (
        preserve
        and previous_events
        and not force_shrink
        and len(df) < max(10, int(len(previous_events) * 0.6))
    ):
        logger.error(
            "Refusing to write shrunken catalog (%d → %d). Keeping previous %d events.",
            len(previous_events),
            len(df),
            len(previous_events),
        )
        return

    df.to_csv(CSV_PATH, index=False, encoding="utf-8")
    logger.info("Wrote CSV: %s (%d rows)", CSV_PATH, len(df))

    payload = {
        "city": CITY,
        "scraped_at": df["scraped_at"].iloc[0] if not df.empty else datetime.now(timezone.utc).isoformat(),
        "source": "bookmyshow",
        "total_count": len(df),
        "events": df.to_dict(orient="records"),
    }

    with JSON_PATH.open("w", encoding="utf-8") as fp:
        json.dump(payload, fp, indent=2, ensure_ascii=False)

    logger.info("Wrote JSON: %s (%d events, %d with images)", JSON_PATH, len(df), int((df["image_url"].astype(str).str.len() > 0).sum()) if not df.empty else 0)


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


def enrich_item_from_url(item: Dict[str, Any]) -> Dict[str, Any]:
    """Open a single booking URL in an isolated session and enrich metadata."""
    driver = create_driver()
    wait = WebDriverWait(driver, DEFAULT_WAIT_SECONDS)
    enriched = dict(item)

    try:
        url = _normalize_booking_url(item.get("booking_url") or "")
        if not url:
            return enriched
        enriched["booking_url"] = url

        logger.info("Opening detail page: %s", item.get("title", url))
        if not safe_get(driver, wait, url):
            return enriched

        dismiss_popups(driver, wait)
        wait_for_page(driver, wait)
        if "blocked" in driver.title.lower():
            logger.warning("Blocked while enriching %s", item.get("title"))
            return enriched

        html = driver.page_source
        og_image = _parse_og_image_from_html(html)
        if og_image:
            enriched["image_url"] = og_image

        enriched = _extract_detail_fields(driver, wait, enriched)
    except WebDriverException as exc:
        logger.warning("URL enrich failed for %s: %s", item.get("title"), exc)
    finally:
        driver.quit()

    return enriched


def enrich_existing_dataset() -> pd.DataFrame:
    """Re-enrich an existing JSON export (one browser session per item)."""
    if not JSON_PATH.exists():
        raise FileNotFoundError(f"Missing dataset: {JSON_PATH}")

    with JSON_PATH.open(encoding="utf-8") as fp:
        payload = json.load(fp)

    events = payload.get("events", [])
    if not events:
        logger.error("No events in %s", JSON_PATH)
        return build_dataframe([])

    enriched_items: List[Dict[str, Any]] = []
    for index, item in enumerate(events):
        logger.info("Enriching %d/%d: %s", index + 1, len(events), item.get("title"))
        enriched_items.append(enrich_item_from_url(item))

    df = build_dataframe(enriched_items)
    export_dataset(df)
    return df


def run_scraper() -> pd.DataFrame:
    """Execute the full scrape pipeline."""
    listings = collect_all_listings()

    if not listings:
        logger.error("No listings found for %s.", CITY)
    else:
        logger.info("Collected %d unique listings for %s.", len(listings), CITY)

    df = build_dataframe(listings)
    export_dataset(df)
    return df


def _dataset_event_count() -> int:
    if not JSON_PATH.exists():
        return 0
    try:
        with JSON_PATH.open(encoding="utf-8") as fp:
            payload = json.load(fp)
        return len(payload.get("events") or [])
    except (OSError, json.JSONDecodeError):
        return 0


if __name__ == "__main__":
    import sys

    mode = sys.argv[1] if len(sys.argv) > 1 else "scrape"
    logger.info("Starting BookMyShow scraper for %s (mode=%s)...", CITY, mode)

    exit_code = 0
    try:
        if mode == "enrich":
            result = enrich_existing_dataset()
        else:
            result = run_scraper()
        logger.info("Done. %d events exported this run.", len(result))
    except Exception as exc:
        logger.exception("Scraper crashed: %s", exc)
        exit_code = 1
        result = build_dataframe([])

    # Partial / preserved success: if the on-disk dataset still has listings,
    # the daily pipeline must NOT fail (that left the events tally stale for days).
    final_count = _dataset_event_count()
    if final_count > 0:
        logger.info("On-disk dataset has %d events — treating run as SUCCESS.", final_count)
        sys.exit(0)

    logger.error("No events available on disk after scrape — FAILING the run.")
    sys.exit(exit_code or 1)
