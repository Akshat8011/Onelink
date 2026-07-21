"""
_dom_extractor.py
Shared JavaScript card-extraction logic used by all three scrapers.
Inject CARD_EXTRACTOR_JS into page.evaluate() to get a list of raw card dicts.
"""

CARD_EXTRACTOR_JS = r"""
() => {
    /*
     * Universal product-card extractor
     * ─────────────────────────────────
     * For each <img> on the page we walk upward through the DOM looking for
     * the tightest ancestor that contains BOTH:
     *   • a product name  (non-numeric, non-symbol, > 5 chars)
     *   • a product price (number >= 10, from a non-EMI/OFF line)
     *
     * Price extraction rules
     * ──────────────────────
     * Lines that contain EMI / OFF / save / cashback / delivery / month
     * are EXCLUDED from price candidates — they carry savings amounts or
     * instalment figures, not the actual selling price.
     *
     * "K" suffix support: "₹2.3K OFF" → excluded anyway (has OFF).
     * But "₹1.27K" (a price without OFF) → 1270.
     *
     * Minimum price: ₹10 — avoids picking up small delivery-fee numbers.
     * Maximum price: ₹200,000 — safety cap.
     */

    const PRICE_EXCLUDE = /\b(OFF|EMI|month|cashback|delivery|Delivery|save|Save|FREE|free|Shipping)\b/i;
    const QTY_PATTERN   = /\d+\s*(g|gm|gms|kg|kgs|ml|l|ltr|lts|pack|pc|pcs|unit|units)\b/i;
    const MIN_PRICE     = 10;
    const MAX_PRICE     = 200000;

    function parseNum(line) {
        // Handle "K" / "k" suffix  (₹1.27K → 1270)
        const km = line.match(/(\d+(?:\.\d+)?)\s*[Kk]\b/);
        if (km) {
            const v = parseFloat(km[1]) * 1000;
            return (v >= MIN_PRICE && v <= MAX_PRICE) ? v : null;
        }
        const cleaned = line.replace(/[₹,\s]/g, '').replace(/[^\d.]/g, '');
        if (!cleaned) return null;
        const v = parseFloat(cleaned);
        return (!isNaN(v) && v >= MIN_PRICE && v <= MAX_PRICE) ? v : null;
    }

    function extractCard(img) {
        const src = img.src || img.getAttribute('src') || '';
        if (!src || src.startsWith('data:')) return null;
        if (/logo|icon|favicon|banner|svg|gif/i.test(src)) return null;
        const w = img.naturalWidth  || img.width  || 0;
        const h = img.naturalHeight || img.height || 0;
        if (w < 40 || h < 40) return null;

        let node = img.parentElement;
        for (let depth = 0; depth < 10 && node; depth++) {
            const raw = (node.innerText || '').trim();
            if (!raw || raw.length > 800) { node = node.parentElement; continue; }

            const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

            // --- Name candidates ---
            const nameLines = lines.filter(l =>
                l.length > 5 && l.length < 200 &&
                !l.match(/^[₹₹\d]/)   &&   // must not start with ₹ or digit
                !l.match(/^[\d\s%.₹,|]+$/)  &&  // not purely numeric
                !/^\d+%/.test(l)            &&
                !/%\s*(OFF|off)/.test(l)    &&
                !PRICE_EXCLUDE.test(l)      &&
                !l.match(/^(ADD|View|Buy|Shop|Order|Bestseller|New|Offer)\b/i) &&
                !l.match(/^[\d.]+\s*(GB|MB|RAM|ROM|inch|in|Hz|mAh|mW|W)\b/i)
            );

            // --- Price candidates (exclude EMI/OFF lines) ---
            const priceLines = lines.filter(l => !PRICE_EXCLUDE.test(l));
            const nums = priceLines.map(parseNum).filter(v => v !== null);

            if (nameLines.length === 0 || nums.length === 0) {
                node = node.parentElement; continue;
            }

            // Best price  = smallest value (the discounted price)
            // Best MRP    = largest value that is >= bestPrice
            const bestPrice = Math.min(...nums);
            const mrpCands  = nums.filter(n => n > bestPrice);
            const bestMrp   = mrpCands.length ? Math.max(...mrpCands) : null;

            // Sanity check: discount must not exceed 95%
            if (bestMrp && bestPrice / bestMrp < 0.05) {
                node = node.parentElement; continue;
            }

            // Weight / quantity
            const weightLine = lines.find(l => QTY_PATTERN.test(l)) || '';

            return {
                name:   nameLines[0],
                weight: weightLine,
                price:  bestPrice,
                mrp:    bestMrp,
                imgSrc: src,
            };
        }
        return null;
    }

    const results = [];
    const seen    = new Set();
    const imgs    = Array.from(document.querySelectorAll('img'));

    for (const img of imgs) {
        if (results.length >= 20) break;
        const card = extractCard(img);
        if (!card) continue;
        const key = card.name + '|' + card.price;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(card);
    }
    return results;
}
"""
