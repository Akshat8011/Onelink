#!/usr/bin/env python3
"""
setup.py — One-shot installer for the quickcomm module.
Run:  python setup.py
"""

import subprocess
import sys


def run(cmd: list[str]) -> None:
    print(f"\n  $ {' '.join(cmd)}")
    result = subprocess.run(cmd, check=False)
    if result.returncode != 0:
        print(f"  ⚠  Command exited with code {result.returncode}")


if __name__ == "__main__":
    python = sys.executable

    print("\n══════════════════════════════════════════")
    print("  OneLink Quick-Comm Aggregator — Setup")
    print("══════════════════════════════════════════\n")

    print("[1/3] Installing Python dependencies…")
    run([python, "-m", "pip", "install", "-r", "requirements.txt"])

    print("\n[2/3] Installing Playwright browsers (Chromium only)…")
    run([python, "-m", "playwright", "install", "chromium"])

    print("\n[3/3] Installing Playwright system dependencies (Linux only)…")
    run([python, "-m", "playwright", "install-deps", "chromium"])

    print("\n✅  Setup complete.")
    print("    Run the Phase 1 POC:\n")
    print("      python poc_blinkit.py          (headed — browser window visible)")
    print("      python poc_blinkit.py --headless  (headless — CI friendly)\n")
