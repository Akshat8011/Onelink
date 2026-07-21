"""
browser_factory.py
──────────────────
Creates a stealth-hardened Playwright browser context that passes the
most common bot-detection checks used by Cloudflare, PerimeterX, and
Blinkit's own anti-scraping layer.

Key evasions applied
────────────────────
1. playwright-stealth  — patches navigator.webdriver, plugins, mimeTypes,
                         chrome runtime, iframe contentWindow, etc.
2. Custom JS overrides — WebGL vendor/renderer, screen dimensions,
                         navigator.hardwareConcurrency, navigator.languages
3. Realistic HTTP headers — Accept-Language, Sec-CH-UA matching the UA
4. Uses system Google Chrome (no Playwright binary download needed)
"""

import asyncio
import random
from pathlib import Path
from playwright.async_api import async_playwright, BrowserContext, Page
from playwright_stealth import stealth_async
from utils.user_agents import pick_fingerprint

# System Chrome paths (Windows / macOS / Linux)
_CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Users\{user}\AppData\Local\Google\Chrome\Application\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
]

import os as _os
from typing import Optional as _Optional

def _find_chrome() -> _Optional[str]:
    """Return the path to the first Chrome executable found on this system."""
    for p in _CHROME_CANDIDATES:
        expanded = p.replace("{user}", _os.getenv("USERNAME", _os.getenv("USER", "")))
        if Path(expanded).exists():
            return expanded
    return None

CHROME_PATH = _find_chrome()

# Debug screenshots directory
DEBUG_DIR = Path(__file__).parent.parent / "debug_shots"
DEBUG_DIR.mkdir(exist_ok=True)

def _profile_dir(label: str = "") -> str:
    """
    Return a per-process/per-label profile directory.
    Concurrent processes MUST NOT share the same Chrome user-data-dir
    or Chrome will refuse to launch (lock file conflict).
    """
    import os
    pid = os.getpid()
    suffix = f"{label}_{pid}" if label else str(pid)
    d = Path(__file__).parent.parent / "browser_profiles" / suffix
    d.mkdir(parents=True, exist_ok=True)
    return str(d)


async def build_context(headless: bool = False) -> tuple[object, BrowserContext]:
    """
    Launch a browser with stealth settings and return
    (playwright_instance, context).

    Uses the system Chrome if available; falls back to the Playwright
    Chromium binary if Chrome is not found.
    """
    fp = pick_fingerprint()

    pw = await async_playwright().start()

    launch_kwargs: dict = dict(
        user_data_dir=_profile_dir(),
        headless=headless,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--disable-infobars",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            f"--window-size={fp['viewport']['width']},{fp['viewport']['height']}",
        ],
        user_agent=fp["user_agent"],
        viewport=fp["viewport"],
        locale=fp["locale"],
        timezone_id="Asia/Kolkata",
        java_script_enabled=True,
        bypass_csp=True,
        geolocation={"latitude": 26.8505, "longitude": 80.9413},
        permissions=["geolocation"],
        extra_http_headers={
            "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
            "Sec-CH-UA": (
                '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"'
            ),
            "Sec-CH-UA-Mobile": "?0",
            "Sec-CH-UA-Platform": f'"{fp["platform"]}"',
        },
    )

    if CHROME_PATH:
        print(f"  [browser] Using system Chrome: {CHROME_PATH}")
        launch_kwargs["executable_path"] = CHROME_PATH
    else:
        print("  [browser] System Chrome not found, using Playwright Chromium")

    browser = await pw.chromium.launch_persistent_context(**launch_kwargs)

    return pw, browser


async def new_stealth_page(context: BrowserContext) -> Page:
    """
    Open a new page inside the context, apply playwright-stealth patches,
    then inject additional JS overrides for WebGL and screen properties.
    """
    page = await context.new_page()
    fp = pick_fingerprint()

    # ── 1. playwright-stealth core patches
    await stealth_async(page)

    # ── 2. Extra JS overrides that stealth doesn't cover
    await page.add_init_script(f"""
        // Hide automation via permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
            parameters.name === 'notifications'
                ? Promise.resolve({{ state: Notification.permission }})
                : originalQuery(parameters);

        // Realistic hardware concurrency (quad-core)
        Object.defineProperty(navigator, 'hardwareConcurrency', {{
            get: () => {random.choice([4, 8, 12, 16])},
        }});

        // Realistic device memory
        Object.defineProperty(navigator, 'deviceMemory', {{
            get: () => {random.choice([4, 8, 16])},
        }});

        // Override WebGL renderer to match our fingerprint
        const getParameter_orig = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {{
            if (parameter === 37445) return '{fp["webgl_vendor"]}';
            if (parameter === 37446) return '{fp["webgl_renderer"]}';
            return getParameter_orig.call(this, parameter);
        }};
        const getParameter_orig2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(parameter) {{
            if (parameter === 37445) return '{fp["webgl_vendor"]}';
            if (parameter === 37446) return '{fp["webgl_renderer"]}';
            return getParameter_orig2.call(this, parameter);
        }};

        // Consistent screen dimensions
        Object.defineProperty(screen, 'width',  {{ get: () => {fp['viewport']['width']} }});
        Object.defineProperty(screen, 'height', {{ get: () => {fp['viewport']['height']} }});
        Object.defineProperty(screen, 'availWidth',  {{ get: () => {fp['viewport']['width']} }});
        Object.defineProperty(screen, 'availHeight', {{ get: () => {fp['viewport']['height'] - 40} }});

        // Make plugins non-empty
        Object.defineProperty(navigator, 'plugins', {{
            get: () => [1, 2, 3, 4, 5],
        }});
    """)

    return page


async def human_type(page: Page, selector: str, text: str) -> None:
    """
    Type `text` into `selector` one character at a time with randomised
    inter-keystroke delays to mimic a real user.
    """
    await page.click(selector)
    await asyncio.sleep(random.uniform(0.3, 0.8))
    for char in text:
        await page.type(selector, char, delay=random.uniform(80, 200))
        # Occasional brief pause mid-word
        if random.random() < 0.05:
            await asyncio.sleep(random.uniform(0.3, 1.0))


async def human_scroll(page: Page, distance: int = 400, steps: int = 6) -> None:
    """Scroll down gradually, like a user reading the page."""
    step = distance // steps
    for _ in range(steps):
        await page.mouse.wheel(0, step)
        await asyncio.sleep(random.uniform(0.15, 0.5))


async def screenshot(page: Page, name: str) -> str:
    """Save a PNG debug screenshot and return its path."""
    path = str(DEBUG_DIR / f"{name}.png")
    await page.screenshot(path=path, full_page=False)
    print(f"  [screenshot] {path}")
    return path
