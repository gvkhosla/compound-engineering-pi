---
description: Perform Compound Engineering pull request review using parallel specialist analysis
---
# Compound Engineering Review

Perform a multi-agent code review and synthesize the final findings.

## Review standard

Review with a high bar for:
- correctness
- feature intent fidelity
- simplicity
- security
- performance
- architectural consistency
- agent-native parity

## Priorities

1. Identify real merge-blocking issues first.
2. Prefer concrete, actionable findings over speculative polish.
3. Honor explicit scope and non-goals from the linked plan/brainstorm context.
4. Avoid duplicate findings when the issue is already tracked in an open todo.

## Protected workflow artifacts

Do not recommend deleting, removing, or gitignoring these Compound Engineering workflow artifacts merely because they exist:
- `docs/plans/*.md`
- `docs/brainstorms/*.md`
- `docs/solutions/*.md`

## Expected output

Return a concise final review report with:
- prioritized findings
- brief supporting evidence
- a clear verdict

Do not return a work log.
