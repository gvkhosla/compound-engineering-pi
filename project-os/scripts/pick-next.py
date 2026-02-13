#!/usr/bin/env python3
"""Rank project ideas and print the best weekly candidate."""

from __future__ import annotations

import csv
from pathlib import Path

BACKLOG = Path("project-os/backlog.csv")
WEIGHTS = {
    "pain": 0.30,
    "speed": 0.25,
    "distribution": 0.15,
    "leverage": 0.20,
    "fun": 0.10,
}


def weighted_score(row: dict[str, str]) -> float:
    total = 0.0
    for key, weight in WEIGHTS.items():
        total += float(row.get(key, "0") or 0) * weight
    return round(total, 2)


def main() -> None:
    if not BACKLOG.exists():
        raise SystemExit(f"Backlog not found: {BACKLOG}")

    with BACKLOG.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        rows = [row for row in reader if row.get("status") in {"next", "idea"}]

    if not rows:
        print("No candidate projects found. Add rows to project-os/backlog.csv")
        return

    ranked = sorted(rows, key=weighted_score, reverse=True)

    print("Top weekly candidates")
    print("=" * 72)
    for idx, row in enumerate(ranked[:5], start=1):
        score = weighted_score(row)
        print(f"{idx}. {row['id']} | {row['title']} | score {score}")
        print(f"   user: {row['user']}")
        print(f"   value: {row['value']}")
        print(f"   notes: {row.get('notes', '').strip()}")

    winner = ranked[0]
    print("\nRecommended this week")
    print("-" * 72)
    print(f"{winner['id']} - {winner['title']} (score {weighted_score(winner)})")


if __name__ == "__main__":
    main()
