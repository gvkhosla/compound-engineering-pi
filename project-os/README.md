# Project OS

A lightweight operating system to help you ship one useful and fun project every week.

## Mission

Ship one real thing every week through the end of 2026.

A shipped project can be:
- a small tool
- a workflow automation
- a useful script
- a polished improvement to an existing repo

## Weekly rhythm

### Monday, 45 minutes
1. Run kickoff script
2. Pick one project from backlog
3. Define a strict scope for Friday ship
4. Create branch + first commit

### Tuesday to Thursday, 90 to 180 minutes per day
1. Build core loop first
2. Add tests and docs
3. Keep scope fixed

### Friday, 60 minutes
1. Ship
2. Write review
3. Capture one reusable learning
4. Queue next project candidate

## Proactive system

This OS includes:
- scoring backlog (`project-os/backlog.csv`)
- auto ranking script (`project-os/scripts/pick-next.py`)
- week bootstrap script (`project-os/scripts/kickoff-week.sh`)
- weekly templates (`project-os/templates/*`)
- year plan tracker (`project-os/year-plan-2026.md`)
- scheduled GitHub reminder issue (`.github/workflows/project-os-weekly.yml`)

## Commands

```bash
# 1) Rank backlog and pick next candidate
python3 project-os/scripts/pick-next.py

# 2) Create this week's working folder from templates
bash project-os/scripts/kickoff-week.sh

# 3) Regenerate yearly tracker
python3 project-os/scripts/generate-year-plan.py 2026
```

## Definition of done for each week

A week only counts as shipped if all are true:
- merged to `main`
- CI green
- short README note or changelog entry added
- one sentence on why it was useful

## Guardrails

- One project per week, no multi-project weeks
- Scope frozen by Monday
- If blocked, cut scope, do not slip the week
- Small and shipped beats big and half-done
