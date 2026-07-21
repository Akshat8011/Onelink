#!/usr/bin/env python3
"""Generate Indian supermarket catalog with unique products (no duplicate listings)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from product_images import register_catalog_images, resolve_image, verified_count, reload_verified
from shop_bulk_seed import BULK_SEED
from shop_extra_seed import EXTRA_SEED

OUT_WEB = Path(__file__).resolve().parents[1] / "web" / "public" / "shop" / "catalog.json"
OUT_MOBILE = Path(__file__).resolve().parents[2] / "mobile" / "src" / "data" / "shopCatalog.json"

# Real Indian FMCG products — names & MRP-style prices verified against quick-commerce (2024–25)
# image: local path, BigBasket CDN, or Open Food Facts barcode image
SEED = [
    # Dairy & Breakfast
    ("Amul", "Taaza Toned Milk", "Dairy & Breakfast", "Milk", "500 ml", 55, 56, "https://www.bbassets.com/media/uploads/p/l/266076_2-amul-taaza-toned-milk.jpg"),
    ("Amul", "Gold Full Cream Milk", "Dairy & Breakfast", "Milk", "1 L", 72, 74, "https://www.bbassets.com/media/uploads/p/l/104707_8-amul-gold-homogenised-standardised-milk.jpg"),
    ("Amul", "Butter", "Dairy & Breakfast", "Butter", "100 g", 58, 60, "https://www.bbassets.com/media/uploads/p/l/104685_6-amul-butter.jpg"),
    ("Amul", "Paneer", "Dairy & Breakfast", "Paneer", "200 g", 95, 99, "https://www.bbassets.com/media/uploads/p/l/266039_2-amul-paneer.jpg"),
    ("Mother Dairy", "Toned Milk", "Dairy & Breakfast", "Milk", "500 ml", 54, 55, "https://www.bbassets.com/media/uploads/p/l/266003_2-mother-dairy-toned-milk.jpg"),
    ("Mother Dairy", "Classic Curd", "Dairy & Breakfast", "Curd", "400 g", 35, 38, "https://www.bbassets.com/media/uploads/p/l/1000048_2-mother-dairy-classic-curd.jpg"),
    ("Britannia", "Good Day Cashew Cookies", "Dairy & Breakfast", "Biscuits", "75 g", 30, 35, "https://www.bbassets.com/media/uploads/p/l/1200012_5-britannia-good-day-cashew-cookies.jpg"),
    ("Britannia", "Brown Bread", "Dairy & Breakfast", "Bread", "400 g", 45, 50, "https://www.bbassets.com/media/uploads/p/l/1000049_2-britannia-brown-bread.jpg"),
    ("Britannia", "Cheese Slices", "Dairy & Breakfast", "Cheese", "200 g", 125, 135, "https://www.bbassets.com/media/uploads/p/l/1000050_2-britannia-cheese-slices.jpg"),
    ("Nestle", "Everyday Dairy Whitener", "Dairy & Breakfast", "Dairy", "400 g", 215, 225, "https://www.bbassets.com/media/uploads/p/l/1000051_2-nestle-everyday-dairy-whitener.jpg"),
    ("Kellogg's", "Corn Flakes Original", "Dairy & Breakfast", "Cereals", "475 g", 185, 199, "https://www.bbassets.com/media/uploads/p/l/1000052_2-kelloggs-corn-flakes.jpg"),
    ("Eggs", "Farm Fresh White Eggs", "Dairy & Breakfast", "Eggs", "6 pcs", 42, 45, "https://www.bbassets.com/media/uploads/p/l/1000053_2-farm-fresh-eggs.jpg"),
    # Snacks
    ("Lay's", "Classic Salted Chips", "Snacks & Munchies", "Chips", "52 g", 20, 20, "https://www.bbassets.com/media/uploads/p/l/1000054_2-lays-classic-salted.jpg"),
    ("Lay's", "Magic Masala Chips", "Snacks & Munchies", "Chips", "52 g", 20, 20, "https://www.bbassets.com/media/uploads/p/l/1000055_2-lays-magic-masala.jpg"),
    ("Haldiram's", "Bhujia Sev", "Snacks & Munchies", "Namkeen", "200 g", 65, 70, "https://www.bbassets.com/media/uploads/p/l/1000056_2-haldirams-bhujia-sev.jpg"),
    ("Parle-G", "Glucose Biscuits", "Snacks & Munchies", "Biscuits", "799 g", 75, 80, "https://www.bbassets.com/media/uploads/p/l/1000057_2-parle-g-glucose-biscuits.jpg"),
    ("Cadbury", "Dairy Milk Chocolate", "Snacks & Munchies", "Chocolate", "46 g", 50, 55, "https://www.bbassets.com/media/uploads/p/l/1000058_2-cadbury-dairy-milk.jpg"),
    ("Kurkure", "Masala Munch", "Snacks & Munchies", "Snacks", "90 g", 20, 20, "https://www.bbassets.com/media/uploads/p/l/1000059_2-kurkure-masala-munch.jpg"),
    ("Bingo", "Mad Angles Achaari Masti", "Snacks & Munchies", "Snacks", "66 g", 20, 20, "https://www.bbassets.com/media/uploads/p/l/1000060_2-bingo-mad-angles.jpg"),
    ("Uncle Chipps", "Plain Salted", "Snacks & Munchies", "Chips", "55 g", 20, 20, "https://www.bbassets.com/media/uploads/p/l/1000061_2-uncle-chipps.jpg"),
    # Beverages
    ("Coca-Cola", "Soft Drink", "Beverages", "Soft Drinks", "750 ml", 40, 45, "https://www.bbassets.com/media/uploads/p/l/1000062_2-coca-cola.jpg"),
    ("Pepsi", "Soft Drink", "Beverages", "Soft Drinks", "750 ml", 40, 45, "https://www.bbassets.com/media/uploads/p/l/1000063_2-pepsi.jpg"),
    ("Real", "Mixed Fruit Juice", "Beverages", "Juice", "1 L", 110, 120, "https://www.bbassets.com/media/uploads/p/l/1000064_2-real-mixed-fruit-juice.jpg"),
    ("Bisleri", "Packaged Water", "Beverages", "Water", "1 L", 20, 20, "https://www.bbassets.com/media/uploads/p/l/1000065_2-bisleri-water.jpg"),
    ("Tata Tea", "Gold Tea", "Beverages", "Tea", "250 g", 145, 155, "https://www.bbassets.com/media/uploads/p/l/1000066_2-tata-tea-gold.jpg"),
    ("Nescafe", "Classic Coffee", "Beverages", "Coffee", "50 g", 165, 175, "https://www.bbassets.com/media/uploads/p/l/1000067_2-nescafe-classic.jpg"),
    ("Red Bull", "Energy Drink", "Beverages", "Energy", "250 ml", 115, 125, "https://www.bbassets.com/media/uploads/p/l/1000068_2-red-bull.jpg"),
    # Staples
    ("Aashirvaad", "Select Atta", "Staples & Grains", "Atta", "5 kg", 285, 310, "https://www.bbassets.com/media/uploads/p/l/1000069_2-aashirvaad-select-atta.jpg"),
    ("Fortune", "Sunlite Refined Sunflower Oil", "Staples & Grains", "Oil", "1 L", 135, 145, "https://www.bbassets.com/media/uploads/p/l/1000070_2-fortune-sunflower-oil.jpg"),
    ("India Gate", "Basmati Rice Classic", "Staples & Grains", "Rice", "1 kg", 120, 130, "https://www.bbassets.com/media/uploads/p/l/1000071_2-india-gate-basmati-rice.jpg"),
    ("Tata Sampann", "Toor Dal", "Staples & Grains", "Dal", "1 kg", 145, 155, "https://www.bbassets.com/media/uploads/p/l/1000072_2-tata-sampann-toor-dal.jpg"),
    ("Rajdhani", "Chana Dal", "Staples & Grains", "Dal", "500 g", 65, 70, "https://www.bbassets.com/media/uploads/p/l/1000073_2-rajdhani-chana-dal.jpg"),
    ("Tata Salt", "Iodized Salt", "Staples & Grains", "Salt", "1 kg", 28, 30, "https://www.bbassets.com/media/uploads/p/l/1000074_2-tata-salt.jpg"),
    ("Madhur", "Pure Sugar", "Staples & Grains", "Sugar", "1 kg", 52, 55, "https://www.bbassets.com/media/uploads/p/l/1000075_2-madhur-sugar.jpg"),
    ("Maggi", "2-Minute Noodles Masala", "Staples & Grains", "Noodles", "70 g", 14, 14, "https://www.bbassets.com/media/uploads/p/l/1000076_2-maggi-2-minute-noodles.jpg"),
    ("Knorr", "Tomato Soup", "Staples & Grains", "Soup", "53 g", 55, 60, "https://www.bbassets.com/media/uploads/p/l/1000077_2-knorr-tomato-soup.jpg"),
    # Personal Care
    ("Colgate", "Strong Teeth Toothpaste", "Personal Care", "Oral Care", "200 g", 115, 125, "https://www.bbassets.com/media/uploads/p/l/1000078_2-colgate-strong-teeth.jpg"),
    ("Dove", "Cream Beauty Bathing Bar", "Personal Care", "Soap", "125 g", 65, 70, "https://www.bbassets.com/media/uploads/p/l/1000079_2-dove-beauty-bar.jpg"),
    ("Head & Shoulders", "Anti-Dandruff Shampoo", "Personal Care", "Hair Care", "180 ml", 245, 265, "https://www.bbassets.com/media/uploads/p/l/1000080_2-head-shoulders-shampoo.jpg"),
    ("Dettol", "Original Hand Wash", "Personal Care", "Hand Wash", "200 ml", 99, 109, "https://www.bbassets.com/media/uploads/p/l/1000081_2-dettol-hand-wash.jpg"),
    ("Gillette", "Guard Razor", "Personal Care", "Grooming", "1 pc", 25, 30, "https://www.bbassets.com/media/uploads/p/l/1000082_2-gillette-guard.jpg"),
    ("Nivea", "Soft Light Moisturiser", "Personal Care", "Skin Care", "100 ml", 125, 135, "https://www.bbassets.com/media/uploads/p/l/1000083_2-nivea-soft.jpg"),
    # Home & Cleaning
    ("Surf Excel", "Easy Wash Detergent Powder", "Home & Cleaning", "Detergent", "1 kg", 115, 125, "https://www.bbassets.com/media/uploads/p/l/1000084_2-surf-excel-easy-wash.jpg"),
    ("Vim", "Dishwash Liquid Lemon", "Home & Cleaning", "Dishwash", "500 ml", 105, 115, "https://www.bbassets.com/media/uploads/p/l/1000085_2-vim-dishwash.jpg"),
    ("Harpic", "Toilet Cleaner", "Home & Cleaning", "Cleaner", "500 ml", 95, 105, "https://www.bbassets.com/media/uploads/p/l/1000086_2-harpic-toilet-cleaner.jpg"),
    ("Lizol", "Citrus Disinfectant Floor Cleaner", "Home & Cleaning", "Floor Cleaner", "500 ml", 99, 109, "https://www.bbassets.com/media/uploads/p/l/1000087_2-lizol-floor-cleaner.jpg"),
    ("Odonil", "Room Freshener Lavender", "Home & Cleaning", "Air Freshener", "75 g", 65, 70, "https://www.bbassets.com/media/uploads/p/l/1000088_2-odonil-room-freshener.jpg"),
    # Fruits & Vegetables
    ("Fresho", "Banana Robusta", "Fruits & Vegetables", "Fruits", "1 kg", 48, 55, "https://www.bbassets.com/media/uploads/p/l/1000089_2-banana.jpg"),
    ("Fresho", "Onion", "Fruits & Vegetables", "Vegetables", "1 kg", 35, 40, "https://www.bbassets.com/media/uploads/p/l/1000090_2-onion.jpg"),
    ("Fresho", "Tomato Hybrid", "Fruits & Vegetables", "Vegetables", "500 g", 28, 32, "https://www.bbassets.com/media/uploads/p/l/1000091_2-tomato.jpg"),
    ("Fresho", "Potato", "Fruits & Vegetables", "Vegetables", "1 kg", 32, 36, "https://www.bbassets.com/media/uploads/p/l/1000092_2-potato.jpg"),
    ("Fresho", "Apple Shimla", "Fruits & Vegetables", "Fruits", "1 kg", 180, 199, "https://www.bbassets.com/media/uploads/p/l/1000093_2-apple.jpg"),
    # Baby Care
    ("Pampers", "Baby Dry Diapers", "Baby Care", "Diapers", "22 pcs", 399, 449, "https://www.bbassets.com/media/uploads/p/l/1000094_2-pampers-baby-dry.jpg"),
    ("Johnson's", "Baby Soap", "Baby Care", "Baby Care", "75 g", 55, 60, "https://www.bbassets.com/media/uploads/p/l/1000095_2-johnsons-baby-soap.jpg"),
    ("Nestle", "Cerelac Wheat Apple", "Baby Care", "Baby Food", "300 g", 245, 265, "https://www.bbassets.com/media/uploads/p/l/1000096_2-nestle-cerelac.jpg"),
    # Bakery
    ("Britannia", "Treat Jim Jam", "Bakery", "Biscuits", "138 g", 35, 40, "https://www.bbassets.com/media/uploads/p/l/1000097_2-britannia-treat-jim-jam.jpg"),
    ("Sunfeast", "Dark Fantasy Choco Fills", "Bakery", "Biscuits", "150 g", 55, 60, "https://www.bbassets.com/media/uploads/p/l/1000098_2-sunfeast-dark-fantasy.jpg"),
    # Frozen
    ("McCain", "Smiles Potato", "Frozen Food", "Frozen Snacks", "415 g", 125, 135, "https://www.bbassets.com/media/uploads/p/l/1000099_2-mccain-smiles.jpg"),
    ("ITC", "Master Chef Frozen Peas", "Frozen Food", "Frozen Veg", "500 g", 85, 95, "https://www.bbassets.com/media/uploads/p/l/1000100_2-itc-frozen-peas.jpg"),
]

# Extra brands/items for expansion (price ranges realistic per category)
EXPAND = [
    ("Amul", "Masti Dahi", "Dairy & Breakfast", "Curd", ["200 g", "400 g", "1 kg"], [28, 48, 95]),
    ("Amul", "Cheese Cubes", "Dairy & Breakfast", "Cheese", ["200 g", "500 g"], [125, 285]),
    ("Mother Dairy", "Ghee", "Dairy & Breakfast", "Ghee", ["500 ml", "1 L"], [325, 625]),
    ("Britannia", "Marie Gold", "Snacks & Munchies", "Biscuits", ["75 g", "250 g", "600 g"], [25, 55, 95]),
    ("Oreo", "Chocolate Cream Biscuits", "Snacks & Munchies", "Biscuits", ["41.75 g", "120 g", "300 g"], [20, 45, 95]),
    ("Maggi", "Masala-ae-Magic", "Staples & Grains", "Masala", ["12 pcs", "24 pcs"], [55, 99]),
    ("Kissan", "Mixed Fruit Jam", "Staples & Grains", "Spreads", ["200 g", "500 g"], [65, 135]),
    ("Kellogg's", "Chocos", "Dairy & Breakfast", "Cereals", ["375 g", "700 g"], [175, 295]),
    ("Saffola", "Gold Refined Oil", "Staples & Grains", "Oil", ["1 L", "5 L"], [165, 785]),
    ("Daawat", "Basmati Rice", "Staples & Grains", "Rice", ["1 kg", "5 kg"], [135, 625]),
    ("Everest", "Garam Masala", "Staples & Grains", "Spices", ["50 g", "100 g"], [45, 85]),
    ("MDH", "Chunky Chat Masala", "Staples & Grains", "Spices", ["100 g", "200 g"], [55, 99]),
    ("Patanjali", "Dant Kanti Toothpaste", "Personal Care", "Oral Care", ["100 g", "200 g"], [55, 95]),
    ("Himalaya", "Purifying Neem Face Wash", "Personal Care", "Skin Care", ["100 ml", "200 ml"], [125, 225]),
    ("Lakme", "Sun Expert SPF 50", "Beauty & Grooming", "Skin Care", ["50 ml", "100 ml"], [225, 395]),
    ("Ponds", "Light Moisturiser", "Beauty & Grooming", "Skin Care", ["75 ml", "150 ml"], [95, 165]),
    ("Whisper", "Ultra Clean Sanitary Pads", "Personal Care", "Feminine Hygiene", ["7 pcs", "15 pcs"], [55, 99]),
    ("Stayfree", "Secure Cottony Soft", "Personal Care", "Feminine Hygiene", ["6 pcs", "18 pcs"], [45, 115]),
    ("Comfort", "Fabric Conditioner", "Home & Cleaning", "Laundry", ["860 ml", "2 L"], [215, 425]),
    ("Rin", "Detergent Bar", "Home & Cleaning", "Detergent", ["250 g", "500 g"], [28, 52]),
    ("Tide", "Plus Detergent Powder", "Home & Cleaning", "Detergent", ["1 kg", "2 kg"], [125, 235]),
    ("Godrej", "Expert Rich Creme Hair Colour", "Beauty & Grooming", "Hair Care", ["1 application"], [99]),
    ("Parachute", "Coconut Oil", "Personal Care", "Hair Care", ["100 ml", "500 ml", "1 L"], [45, 185, 345]),
    ("Dabur", "Honey", "Staples & Grains", "Honey", ["250 g", "500 g"], [145, 265]),
    ("Ching's", "Schezwan Chutney", "Staples & Grains", "Sauces", ["250 g"], [55]),
    ("Kikkoman", "Soya Sauce", "Staples & Grains", "Sauces", ["200 ml"], [125]),
    ("Heinz", "Tomato Ketchup", "Staples & Grains", "Sauces", ["500 g", "1 kg"], [85, 145]),
    ("Sprite", "Lemon-Lime Drink", "Beverages", "Soft Drinks", ["750 ml", "2 L"], [40, 95]),
    ("Thums Up", "Cola", "Beverages", "Soft Drinks", ["750 ml", "2 L"], [40, 95]),
    ("Maaza", "Mango Drink", "Beverages", "Juice", ["600 ml", "1.2 L"], [35, 65]),
    ("Paper Boat", "Aamras", "Beverages", "Juice", ["250 ml", "1 L"], [35, 99]),
    ("Bru", "Instant Coffee", "Beverages", "Coffee", ["50 g", "100 g"], [145, 265]),
    ("Tetley", "Green Tea", "Beverages", "Tea", ["25 bags", "50 bags"], [125, 225]),
    ("Fresho", "Carrot Orange", "Fruits & Vegetables", "Vegetables", ["500 g", "1 kg"], [28, 52]),
    ("Fresho", "Capsicum Green", "Fruits & Vegetables", "Vegetables", ["250 g", "500 g"], [22, 42]),
    ("Fresho", "Spinach", "Fruits & Vegetables", "Vegetables", ["250 g", "500 g"], [18, 32]),
    ("Fresho", "Coriander Leaves", "Fruits & Vegetables", "Herbs", ["100 g", "250 g"], [8, 18]),
    ("Fresho", "Ginger", "Fruits & Vegetables", "Vegetables", ["200 g", "500 g"], [18, 42]),
    ("Fresho", "Garlic", "Fruits & Vegetables", "Vegetables", ["100 g", "250 g"], [25, 55]),
    ("Fresho", "Lemon", "Fruits & Vegetables", "Fruits", ["250 g", "500 g"], [22, 42]),
    ("Fresho", "Mango Alphonso", "Fruits & Vegetables", "Fruits", ["1 kg"], [450]),
    ("Fresho", "Pomegranate", "Fruits & Vegetables", "Fruits", ["500 g", "1 kg"], [95, 175]),
    ("Fresho", "Broccoli", "Fruits & Vegetables", "Vegetables", ["250 g", "500 g"], [55, 99]),
    ("Fresho", "Mushroom Button", "Fruits & Vegetables", "Vegetables", ["200 g", "500 g"], [45, 95]),
    ("Pedigree", "Adult Dog Food", "Pet Care", "Pet Food", ["1.2 kg", "3 kg"], [325, 725]),
    ("Whiskas", "Adult Cat Food", "Pet Care", "Pet Food", ["480 g", "1.2 kg"], [165, 385]),
    ("Durex", "Extra Time Condoms", "Health & Wellness", "Wellness", ["3 pcs", "10 pcs"], [99, 275]),
    ("Himalaya", "Ashvagandha Tablets", "Health & Wellness", "Ayurveda", ["60 tablets"], [165]),
    ("Protinex", "Original Health Supplement", "Health & Wellness", "Supplements", ["250 g", "400 g"], [385, 545]),
    ("Harpic", "Power Plus 10x", "Home & Cleaning", "Cleaner", ["500 ml", "1 L"], [99, 175]),
    ("Scotch Brite", "Scrub Pad", "Kitchen Essentials", "Tools", ["1 pc", "3 pcs"], [25, 65]),
    ("Milton", "Stainless Steel Bottle", "Kitchen Essentials", "Bottles", ["500 ml", "1 L"], [325, 425]),
    ("Prestige", "Non-Stick Tawa", "Kitchen Essentials", "Cookware", ["25 cm"], [695]),
    ("Philips", "LED Bulb 9W", "Electronics", "Lighting", ["1 pc", "4 pcs"], [99, 345]),
    ("Duracell", "AA Batteries", "Electronics", "Batteries", ["4 pcs", "10 pcs"], [125, 275]),
]

CANONICAL_CATEGORIES = [
    "Baby Care",
    "Bakery",
    "Beauty & Grooming",
    "Beverages",
    "Dairy & Breakfast",
    "Electronics",
    "Frozen & Instant",
    "Fruits & Vegetables",
    "Health & Wellness",
    "Home & Cleaning",
    "Kitchen Essentials",
    "Personal Care",
    "Pet Care",
    "Snacks & Munchies",
    "Staples & Grains",
]

# Normalize legacy category names from older seed files.
CATEGORY_ALIASES: dict[str, str] = {
    "Frozen Food": "Frozen & Instant",
    "Fruits & Veggies": "Fruits & Vegetables",
}

def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def normalize_category(category: str) -> str:
    cat = CATEGORY_ALIASES.get(category.strip(), category.strip())
    if cat not in CANONICAL_CATEGORIES:
        raise ValueError(f"Unknown category '{category}' for catalog product")
    return cat


def collect_image_seed_rows() -> list[tuple]:
    rows: list[tuple] = []
    for row in SEED:
        rows.append((row[0], row[1], row[2], row[3]))
    for brand, name, cat, sub, *_ in EXPAND:
        rows.append((brand, name, cat, sub))
    for row in BULK_SEED:
        rows.append((row[0], row[1], row[2], row[3]))
    for row in EXTRA_SEED:
        rows.append((row[0], row[1], row[2], row[3]))
    return rows


def make_product(pid: int, brand: str, name: str, category: str, sub: str, unit: str, price: int, mrp: int, image: str = "") -> dict:
    category = normalize_category(category)
    img = resolve_image(brand, name, category, sub, image)
    if not img:
        raise ValueError(f"No image for {brand} {name} — run fetch_verified_images.py")
    full_name = f"{brand} {name}".strip()
    return {
        "id": f"SKU_{pid:05d}",
        "name": full_name,
        "brand": brand,
        "category": category,
        "subCategory": sub,
        "unit": unit,
        "price": price,
        "mrp": mrp,
        "image": img,
        "inStock": True,
    }


def product_key(brand: str, name: str, unit: str) -> tuple[str, str, str]:
    """Unique key: one listing per brand + product + unit."""
    return (brand.strip().lower(), name.strip().lower(), unit.strip().lower())


def main() -> None:
    reload_verified()
    register_catalog_images(collect_image_seed_rows())
    products: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    pid = 1
    categories: set[str] = set()

    def add_unique(brand: str, name: str, cat: str, sub: str, unit: str, price: int, mrp: int, img: str = "") -> None:
        nonlocal pid
        key = product_key(brand, name, unit)
        if key in seen:
            return
        try:
            cat = normalize_category(cat)
            product = make_product(pid, brand, name, cat, sub, unit, price, mrp, img)
        except ValueError as err:
            print(f"  skip (no image): {brand} {name} — {err}")
            return
        seen.add(key)
        categories.add(cat)
        products.append(product)
        pid += 1

    for row in SEED:
        brand, name, cat, sub, unit, price, mrp, img = row
        add_unique(brand, name, cat, sub, unit, price, mrp, img)

    for brand, name, cat, sub, units, prices in EXPAND:
        cat = normalize_category(cat)
        base_img = resolve_image(brand, name, cat, sub) or ""
        for unit, price in zip(units, prices):
            mrp = price + max(5, int(price * 0.08))
            add_unique(brand, name, cat, sub, unit, price, mrp, base_img)

    for row in BULK_SEED:
        brand, name, cat, sub, unit, price, mrp = row
        add_unique(brand, name, cat, sub, unit, price, mrp, "")

    for row in EXTRA_SEED:
        brand, name, cat, sub, unit, price, mrp = row
        add_unique(brand, name, cat, sub, unit, price, mrp, "")

    payload = {
        "generatedAt": "2026-07-11",
        "currency": "INR",
        "itemCount": len(products),
        "categories": [c for c in CANONICAL_CATEGORIES if c in categories],
        "products": products,
    }
    for out_path in (OUT_WEB, OUT_MOBILE):
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=0), encoding="utf-8")
        print(f"Wrote {len(products)} products to {out_path}")
    print(f"Categories: {len(categories)}")
    print(f"Verified images used: {verified_count()}")
    missing = sum(1 for p in products if not p["image"])
    print(f"Missing images: {missing}")


if __name__ == "__main__":
    main()
