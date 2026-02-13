#!/usr/bin/env python3
"""Generate a weekly tracker for a full year."""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path


def build(year: int) -> str:
    current = date.today()
    start_week = current.isocalendar().week if current.year == year else 1

    lines: list[str] = []
    lines.append(f"# Weekly shipping tracker {year}")
    lines.append("")
    lines.append("Mission: ship one useful and fun project every week.")
    lines.append("")
    lines.append("| Week | Dates | Project | Useful for | Fun factor | Status |")
    lines.append("|---|---|---|---|---|---|")

    for week in range(start_week, 54):
        try:
            monday = date.fromisocalendar(year, week, 1)
            friday = date.fromisocalendar(year, week, 5)
        except ValueError:
            break
        lines.append(
            f"| {year}-W{week:02d} | {monday.isoformat()} to {friday.isoformat()} |  |  |  | ☐ |"
        )

    lines.append("")
    lines.append("Legend: ☐ planned, ◐ in progress, ☑ shipped")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    year = int(sys.argv[1]) if len(sys.argv) > 1 else date.today().year
    output = Path(f"project-os/year-plan-{year}.md")
    output.write_text(build(year), encoding="utf-8")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
