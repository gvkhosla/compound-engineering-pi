#!/usr/bin/env bash
set -euo pipefail

ROOT="project-os"
TEMPLATE_WEEKLY="$ROOT/templates/weekly-plan.md"
TEMPLATE_REVIEW="$ROOT/templates/ship-review.md"

if [[ ! -f "$TEMPLATE_WEEKLY" || ! -f "$TEMPLATE_REVIEW" ]]; then
  echo "Missing templates in $ROOT/templates"
  exit 1
fi

read -r WEEK_ID YEAR WEEK MONDAY FRIDAY <<<"$(python3 - <<'PY'
from datetime import date, timedelta

today = date.today()
year, week, _ = today.isocalendar()
monday = date.fromisocalendar(year, week, 1)
friday = date.fromisocalendar(year, week, 5)
print(f"{year}-W{week:02d} {year} W{week:02d} {monday.isoformat()} {friday.isoformat()}")
PY
)"

WEEK_DIR="$ROOT/weeks/$YEAR/$WEEK"
mkdir -p "$WEEK_DIR"

python3 - "$TEMPLATE_WEEKLY" "$WEEK_DIR/weekly-plan.md" "$WEEK_ID" "$MONDAY" "$FRIDAY" <<'PY'
import sys
from pathlib import Path

src, dst, week_id, monday, friday = sys.argv[1:]
content = Path(src).read_text(encoding="utf-8")
content = content.replace("{{WEEK_ID}}", week_id)
content = content.replace("{{WEEK_START}}", monday)
content = content.replace("{{WEEK_END}}", friday)
Path(dst).write_text(content, encoding="utf-8")
PY

python3 - "$TEMPLATE_REVIEW" "$WEEK_DIR/ship-review.md" "$WEEK_ID" <<'PY'
import sys
from pathlib import Path

src, dst, week_id = sys.argv[1:]
content = Path(src).read_text(encoding="utf-8")
content = content.replace("{{WEEK_ID}}", week_id)
Path(dst).write_text(content, encoding="utf-8")
PY

echo "Created weekly workspace: $WEEK_DIR"
echo "- $WEEK_DIR/weekly-plan.md"
echo "- $WEEK_DIR/ship-review.md"
echo
echo "Next steps"
echo "1) python3 project-os/scripts/pick-next.py"
echo "2) Fill weekly-plan.md"
echo "3) Start branch and ship by Friday"
