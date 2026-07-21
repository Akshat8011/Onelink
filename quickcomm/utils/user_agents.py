"""
Realistic browser fingerprints to rotate across scraping sessions.
Each entry pairs a User-Agent string with a matching viewport, platform,
and WebGL renderer so all signals stay internally consistent — this is
critical because Cloudflare cross-checks these values.
"""

import random

FINGERPRINTS = [
    # ── Chrome 124 on Windows 11 (most common desktop UA)
    {
        "user_agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "platform": "Win32",
        "viewport": {"width": 1440, "height": 900},
        "webgl_vendor": "Google Inc. (Intel)",
        "webgl_renderer": "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "locale": "en-IN",
    },
    # ── Chrome 124 on Windows 11 — larger monitor
    {
        "user_agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.6367.82 Safari/537.36"
        ),
        "platform": "Win32",
        "viewport": {"width": 1920, "height": 1080},
        "webgl_vendor": "Google Inc. (NVIDIA)",
        "webgl_renderer": "ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "locale": "en-IN",
    },
    # ── Chrome 124 on macOS Sonoma
    {
        "user_agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "platform": "MacIntel",
        "viewport": {"width": 1512, "height": 982},
        "webgl_vendor": "Apple Inc.",
        "webgl_renderer": "Apple M1",
        "locale": "en-IN",
    },
    # ── Edge 124 on Windows (looks like Chrome, different brand)
    {
        "user_agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0"
        ),
        "platform": "Win32",
        "viewport": {"width": 1366, "height": 768},
        "webgl_vendor": "Google Inc. (Intel)",
        "webgl_renderer": "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
        "locale": "en-IN",
    },
    # ── Chrome on Android (mobile viewport — Blinkit often serves mobile layout)
    {
        "user_agent": (
            "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.6367.82 Mobile Safari/537.36"
        ),
        "platform": "Linux armv81",
        "viewport": {"width": 412, "height": 915},
        "webgl_vendor": "Qualcomm",
        "webgl_renderer": "Adreno (TM) 750",
        "locale": "en-IN",
    },
]


def pick_fingerprint() -> dict:
    """Return a randomly selected fingerprint dict."""
    return random.choice(FINGERPRINTS)


def typing_delay_ms() -> float:
    """
    Return a per-keystroke delay in milliseconds that mimics human typing.
    Gaussian-distributed around 120 ms with occasional longer pauses.
    """
    base = random.gauss(120, 40)  # 120 ms mean, 40 ms std-dev
    # 10 % chance of a longer 'thinking' pause (350–700 ms)
    if random.random() < 0.10:
        base += random.uniform(350, 700)
    return max(50, base)  # floor at 50 ms


def random_scroll_distance() -> int:
    """Pixels to scroll to simulate reading the page."""
    return random.randint(200, 600)
