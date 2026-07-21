#!/usr/bin/env python3
"""
Phase 1 recovery proof helper — records UTC timestamps for manual tests.

Run on the Raspberry Pi (or any host with systemctl + optional journalctl).
Does NOT fabricate recovery times; prints markers for you to paste into
docs/proofs/phase1-self-healing.md.

Usage:
  python3 scripts/phase1_recovery_check.py status
  python3 scripts/phase1_recovery_check.py mark kill-brain
  python3 scripts/phase1_recovery_check.py mark brain-recovered
  python3 scripts/phase1_recovery_check.py journal onelink-brain 5
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime, timezone


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def cmd_status(unit: str) -> int:
    print(f"[{utc_now()}] systemctl status {unit}")
    return subprocess.call(["systemctl", "status", unit, "--no-pager"])


def cmd_mark(label: str) -> int:
    print(f"[{utc_now()}] MARK: {label}")
    return 0


def cmd_journal(unit: str, minutes: int) -> int:
    since = f"{minutes} min ago"
    print(f"[{utc_now()}] journalctl -u {unit} --since '{since}'")
    return subprocess.call(
        ["journalctl", "-u", unit, "--since", since, "--no-pager"],
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Phase 1 recovery proof timestamps")
    sub = parser.add_subparsers(dest="command", required=True)

    p_status = sub.add_parser("status", help="Show systemd unit status")
    p_status.add_argument(
        "--unit",
        default="onelink-brain.service",
        help="systemd unit name",
    )

    p_mark = sub.add_parser("mark", help="Print a UTC timestamp marker")
    p_mark.add_argument("label", help="e.g. kill-brain, brain-recovered, ws-online")

    p_journal = sub.add_parser("journal", help="Tail journal for a unit")
    p_journal.add_argument("unit", nargs="?", default="onelink-brain.service")
    p_journal.add_argument("minutes", nargs="?", type=int, default=5)

    args = parser.parse_args()

    if args.command == "status":
        return cmd_status(args.unit)
    if args.command == "mark":
        return cmd_mark(args.label)
    if args.command == "journal":
        return cmd_journal(args.unit, args.minutes)

    return 1


if __name__ == "__main__":
    sys.exit(main())
