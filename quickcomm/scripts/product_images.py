"""Per-product verified image URLs from Blinkit/Grofers CDN."""

from __future__ import annotations

import json
import re
from pathlib import Path

GROFERS_CDN = (
    "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270"
)

_VERIFIED_PATH = Path(__file__).resolve().parent / "verified_product_images.json"
_VERIFIED: dict[str, str] = {}
_RAW_CACHE: dict = {}
_CATEGORY_IMAGES: dict[str, list[str]] = {}
_SUBCATEGORY_IMAGES: dict[tuple[str, str], list[str]] = {}
_CATEGORY_NAME_IMAGES: dict[str, list[tuple[str, str]]] = {}

_STOPWORDS = {
    "and", "the", "with", "for", "pack", "original", "classic", "premium",
    "extra", "fresh", "natural", "pure", "family", "value", "mini", "jumbo",
}


def _norm_name(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _name_tokens(text: str) -> set[str]:
    return {t for t in _norm_name(text).split() if len(t) > 2 and t not in _STOPWORDS}


def _name_similarity(a: str, b: str) -> int:
    ta, tb = _name_tokens(a), _name_tokens(b)
    if not ta or not tb:
        return 0
    overlap = len(ta & tb)
    if overlap == 0:
        return 0
    return int(100 * overlap / len(ta | tb))


def _load_cache() -> None:
    global _VERIFIED, _RAW_CACHE
    _VERIFIED.clear()
    _RAW_CACHE.clear()
    if not _VERIFIED_PATH.exists():
        return
    _RAW_CACHE = json.loads(_VERIFIED_PATH.read_text(encoding="utf-8"))
    for key, entry in _RAW_CACHE.items():
        if isinstance(entry, dict) and entry.get("verified") and entry.get("image"):
            _VERIFIED[key] = entry["image"]


_load_cache()


def grofers(asset: str) -> str:
    if asset.startswith("http"):
        url = re.sub(r"w=\d+", "w=270", asset)
        return url.split("?")[0]
    asset = asset.lstrip("/")
    if not asset.startswith("da/"):
        asset = f"da/cms-assets/cms/product/{asset}"
    return f"{GROFERS_CDN}/{asset}"


def product_key(brand: str, name: str) -> str:
    return f"{brand.strip()}|{name.strip()}"


def _is_grofers_url(url: str) -> bool:
    return "grofers.com" in url or "cdn.grofers" in url


def _is_zepto_url(url: str) -> bool:
    return "zeptonow.com" in url


def _pick_varied(images: list[str], seed: str) -> str:
    if not images:
        return ""
    if len(images) == 1:
        return images[0]
    idx = sum(ord(c) for c in seed) % len(images)
    return images[idx]


def register_catalog_images(rows: list[tuple]) -> None:
    """Build category/subcategory image pools from seed rows with verified images."""
    global _CATEGORY_IMAGES, _SUBCATEGORY_IMAGES, _CATEGORY_NAME_IMAGES
    _CATEGORY_IMAGES = {}
    _SUBCATEGORY_IMAGES = {}
    _CATEGORY_NAME_IMAGES = {}

    for row in rows:
        brand, name = row[0], row[1]
        category = row[2] if len(row) > 2 else ""
        sub_category = row[3] if len(row) > 3 else ""
        img = resolve_image(brand, name, category, sub_category, allow_fallback=False)
        if not img:
            continue
        cat = category.strip()
        sub = sub_category.strip()
        label = _norm_name(f"{brand} {name}")
        if cat:
            _CATEGORY_IMAGES.setdefault(cat, [])
            if img not in _CATEGORY_IMAGES[cat]:
                _CATEGORY_IMAGES[cat].append(img)
            _CATEGORY_NAME_IMAGES.setdefault(cat, [])
            _CATEGORY_NAME_IMAGES[cat].append((label, img))
        if cat and sub:
            key = (cat, sub)
            _SUBCATEGORY_IMAGES.setdefault(key, [])
            if img not in _SUBCATEGORY_IMAGES[key]:
                _SUBCATEGORY_IMAGES[key].append(img)


def _similar_name_fallback(category: str, brand: str, name: str) -> str:
    cat = category.strip()
    target = _norm_name(f"{brand} {name}")
    candidates = _CATEGORY_NAME_IMAGES.get(cat, [])
    best_img = ""
    best_score = 0
    for label, img in candidates:
        score = _name_similarity(target, label)
        if score > best_score:
            best_score, best_img = score, img
    if best_score >= 35:
        return best_img
    return ""


def _subcategory_fallback(category: str, sub_category: str, name: str) -> str:
    cat = category.strip()
    sub = sub_category.strip()
    if cat and sub:
        images = _SUBCATEGORY_IMAGES.get((cat, sub), [])
        if images:
            return _pick_varied(images, f"{cat}|{sub}|{name}")
    return ""


def _category_fallback(category: str, name: str) -> str:
    cat = (category or "").strip()
    if not cat:
        return ""
    images = _CATEGORY_IMAGES.get(cat, [])
    if images:
        return _pick_varied(images, f"{cat}|{name}")
    return ""


def resolve_image(
    brand: str,
    name: str,
    category: str = "",
    sub_category: str = "",
    explicit: str = "",
    *,
    allow_fallback: bool = True,
) -> str:
    """Return a Grofers/Zepto CDN image for the product.

    Priority: exact verified match -> base-name match -> high-confidence cache
    -> explicit Grofers URL -> same subcategory pool -> same category pool.
    Never reuses another brand's product image.
    """
    key = product_key(brand, name)
    if key in _VERIFIED:
        return _VERIFIED[key]

    base_name = re.sub(r"\s+(family pack|value pack|combo)$", "", name, flags=re.I).strip()
    base_key = product_key(brand, base_name)
    if base_key in _VERIFIED:
        return _VERIFIED[base_key]

    for lookup in (key, base_key):
        entry = _RAW_CACHE.get(lookup)
        if isinstance(entry, dict) and entry.get("image") and entry.get("score", 0) >= 70:
            return entry["image"]

    if explicit:
        if _is_grofers_url(explicit):
            return explicit
        if _is_zepto_url(explicit):
            return explicit

    if not allow_fallback:
        return ""

    similar_img = _similar_name_fallback(category, brand, name)
    if similar_img:
        return similar_img

    sub_img = _subcategory_fallback(category, sub_category, name)
    if sub_img:
        return sub_img

    return _category_fallback(category, name)


def verified_count() -> int:
    return len(_VERIFIED)


def reload_verified() -> None:
    _load_cache()
