"""
Fetch real BookMyShow poster images (og:image) for events missing image_url.
Uses curl for reliable fetching (urllib gets 403 on BMS rate limits).
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
JSON_PATH = SCRIPT_DIR / "data" / "events_lucknow.json"
MOBILE_JSON = SCRIPT_DIR.parent / "mobile" / "src" / "data" / "events_lucknow.scraped.json"

# Linux CI has `curl`; Windows often has `curl.exe`. Pick whichever exists.
CURL_BIN = shutil.which("curl") or shutil.which("curl.exe") or "curl"

OG_IMAGE_RE = re.compile(
    r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']',
    re.I,
)
BMS_IMAGE_RE = re.compile(
    r'https://assets-in\.bmscdn\.com/discovery-catalog/events/[^"\'\s>]+\.(?:jpg|jpeg|png|webp)',
    re.I,
)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def upgrade_image_url(url: str) -> str:
    if not url:
        return url
    if "tr:w-" in url:
        return re.sub(r"tr:w-\d+,h-\d+", "tr:w-800,h-450", url)
    if "-portrait." in url:
        return url.replace("-portrait.", "-landscape.")
    return url


def fetch_html(booking_url: str) -> str:
    try:
        result = subprocess.run(
            [
                CURL_BIN, "-sL",
                "-A", USER_AGENT,
                "-H", "Accept: text/html",
                "--max-time", "30",
                booking_url,
            ],
            capture_output=True,
            text=True,
            timeout=35,
            check=False,
        )
        return result.stdout or ""
    except Exception as exc:
        print(f"  curl failed ({CURL_BIN}): {exc}")
        return ""


def parse_og_image(html: str) -> str:
    match = OG_IMAGE_RE.search(html)
    if match and match.group(1).strip():
        url = match.group(1).strip()
        if "discovery-catalog/events" in url:
            return upgrade_image_url(url)
    bms = BMS_IMAGE_RE.search(html)
    if bms:
        return upgrade_image_url(bms.group(0))
    return ""


def fetch_og_image(booking_url: str, retries: int = 3) -> str:
    for attempt in range(retries):
        html = fetch_html(booking_url)
        image = parse_og_image(html)
        if image:
            return image
        if attempt < retries - 1:
            time.sleep(1.5 * (attempt + 1))
    return ""


def merge_image_maps(paths: list[Path]) -> dict[str, str]:
    merged: dict[str, str] = {}
    for path in paths:
        if not path.exists():
            continue
        with path.open(encoding="utf-8") as fp:
            payload = json.load(fp)
        for event in payload.get("events", []):
            code = (event.get("event_code") or "").upper()
            img = (event.get("image_url") or "").strip()
            if code and img:
                merged[code] = img
    return merged


def enrich_payload(path: Path, known_images: dict[str, str]) -> int:
    with path.open(encoding="utf-8") as fp:
        payload = json.load(fp)

    events = payload.get("events", [])
    updated = 0

    for index, event in enumerate(events):
        code = (event.get("event_code") or "").upper()
        if event.get("image_url"):
            continue
        if code in known_images:
            event["image_url"] = known_images[code]
            updated += 1
            print(f"[{index + 1}/{len(events)}] {event.get('title')} -> cached")
            continue

        url = event.get("booking_url", "")
        title = event.get("title", code)
        print(f"[{index + 1}/{len(events)}] {title}")
        image = fetch_og_image(url)
        if image:
            event["image_url"] = image
            known_images[code] = image
            updated += 1
            print(f"  -> {image[:90]}...")
        else:
            print("  -> no image found")
        time.sleep(1.2)

    with path.open("w", encoding="utf-8") as fp:
        json.dump(payload, fp, indent=2, ensure_ascii=False)

    return updated


if __name__ == "__main__":
    paths = [JSON_PATH, MOBILE_JSON]
    known = merge_image_maps(paths)
    print(f"Starting with {len(known)} known images")

    total = 0
    for target in paths:
        if not target.exists():
            print(f"Skip missing: {target}")
            continue
        print(f"\nEnriching {target}")
        count = enrich_payload(target, known)
        total += count
        print(f"Updated {count} events in {target.name}")

    print(f"\nDone. {len(known)} total images mapped.")
