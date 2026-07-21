"""
normalizer.py — SKU matching and grouping across platforms
Uses thefuzz for fuzzy string matching to group similar products from
different platforms into a single comparison row.
"""

import re
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict, field

from thefuzz import fuzz

from scrapers.blinkit import Product


# ── Config ────────────────────────────────────────────────────────────────────

MATCH_THRESHOLD = 68      # min similarity score (0-100) to group products
QTY_PATTERN     = re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:g|gm|gms|kg|kgs|ml|l|ltr|ltrs|pc|pcs|pack|nos)\b", re.I)
STRIP_NOISE     = re.compile(r"\b(buy|online|free|shipping|offer|delivery|pack of|set of)\b", re.I)
MULTI_SPACE     = re.compile(r"\s{2,}")


# ── Data models ───────────────────────────────────────────────────────────────

@dataclass
class PlatformEntry:
    platform:      str
    price:         Optional[float]
    mrp:           Optional[float]
    delivery_mins: Optional[int]
    image_url:     str
    weight:        str
    deep_link:     str
    source_url:    str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ComparisonGroup:
    """One row in the comparison table — same product across platforms."""
    canonical_name: str
    canonical_weight: str
    best_price:     Optional[float]
    best_platform:  str
    platforms:      List[PlatformEntry] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "canonical_name":   self.canonical_name,
            "canonical_weight": self.canonical_weight,
            "best_price":       self.best_price,
            "best_platform":    self.best_platform,
            "platforms":        [p.to_dict() for p in self.platforms],
        }


# ── Normalisation helpers ─────────────────────────────────────────────────────

def _extract_qty(name: str) -> tuple[str, str]:
    """Return (name_without_qty, qty_string)."""
    m = QTY_PATTERN.search(name)
    qty = m.group(0) if m else ""
    clean = QTY_PATTERN.sub("", name).strip() if m else name
    return clean, qty


def _clean(name: str) -> str:
    """Normalise a product name for fuzzy comparison."""
    s = name.lower()
    s = STRIP_NOISE.sub("", s)
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = MULTI_SPACE.sub(" ", s).strip()
    return s


def _similarity(a: str, b: str) -> int:
    """Composite similarity: average of token-sort and partial ratios."""
    return int(
        0.6 * fuzz.token_sort_ratio(a, b) +
        0.4 * fuzz.partial_ratio(a, b)
    )


# ── Main grouping logic ───────────────────────────────────────────────────────

def group_products(all_products: List[Product]) -> List[ComparisonGroup]:
    """
    Given products from multiple platforms, group those that refer to the
    same SKU (by fuzzy name similarity) into ComparisonGroup objects.
    Sorted by best_price ascending.
    """
    if not all_products:
        return []

    # Convert every Product -> (clean_name, qty, PlatformEntry)
    annotated = []
    for p in all_products:
        clean, qty = _extract_qty(p.name)
        annotated.append({
            "clean": _clean(clean),
            "qty":   qty,
            "entry": PlatformEntry(
                platform=p.platform,
                price=p.price,
                mrp=p.mrp,
                delivery_mins=p.delivery_mins,
                image_url=p.image_url,
                weight=p.weight or qty,
                deep_link=p.deep_link,
                source_url=p.source_url,
            ),
            "original_name": p.name,
        })

    groups: List[dict] = []   # [{clean, qty, entries, original_name}]

    for item in annotated:
        placed = False
        for grp in groups:
            score = _similarity(item["clean"], grp["clean"])
            # Also require qty to match if both have one
            if grp["qty"] and item["qty"] and grp["qty"].lower() != item["qty"].lower():
                score = int(score * 0.6)   # penalise qty mismatch
            if score >= MATCH_THRESHOLD:
                grp["entries"].append(item["entry"])
                # Keep the longest / most descriptive name
                if len(item["original_name"]) > len(grp["original_name"]):
                    grp["original_name"] = item["original_name"]
                placed = True
                break
        if not placed:
            groups.append({
                "clean":         item["clean"],
                "qty":           item["qty"],
                "entries":       [item["entry"]],
                "original_name": item["original_name"],
            })

    # Build ComparisonGroup objects
    result: List[ComparisonGroup] = []
    for grp in groups:
        entries: List[PlatformEntry] = grp["entries"]
        priced  = [e for e in entries if e.price is not None]
        best    = min(priced, key=lambda e: e.price) if priced else None

        cg = ComparisonGroup(
            canonical_name=_title_case(grp["original_name"]),
            canonical_weight=grp["qty"],
            best_price=best.price if best else None,
            best_platform=best.platform if best else "",
            platforms=_sort_entries(entries),
        )
        result.append(cg)

    # Sort groups: those with prices first (cheapest best-price), then no-price groups
    result.sort(key=lambda g: (g.best_price is None, g.best_price or 0))
    return result


def _sort_entries(entries: List[PlatformEntry]) -> List[PlatformEntry]:
    """Sort platform entries: priced first (ascending price), then unpriced."""
    return sorted(entries, key=lambda e: (e.price is None, e.price or 0))


def _title_case(s: str) -> str:
    """Smart title-case that preserves abbreviations like 'ml', 'Amul'."""
    words = s.split()
    return " ".join(
        w if w.upper() in {"ML", "KG", "GM", "LTR", "PC"} else w.capitalize()
        for w in words
    )
