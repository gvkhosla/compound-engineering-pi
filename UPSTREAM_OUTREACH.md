# Upstream outreach note (Every / Kieran)

Use this when opening an upstream PR or discussion to `EveryInc/compound-engineering-plugin`.

## Suggested framing

This project is an **additive compatibility layer** for Pi users:

- keeps the Compound Engineering workflow intact (`plan → work → review → compound`)
- maps Claude-specific primitives to Pi equivalents (`Task` → `subagent`, `AskUserQuestion` → `ask_user_question`)
- uses **MCPorter** for MCP interoperability instead of assuming Claude runtime MCP behavior
- does not change Claude Code behavior or require upstream users to switch platforms

## Why upstream may care

- broadens adoption for teams standardizing on Pi
- keeps docs/workflow language aligned with original project
- lowers migration friction across Claude Code, Codex, OpenCode, and Pi

## What to include in upstream PR

1. Scope is optional and non-breaking (new `pi` target only)
2. Test coverage for conversion/writing/CLI behavior
3. Pi package install path + MCPorter prerequisites
4. Validation notes (link to `VALIDATION.md`)
5. Clear ownership statement: this repo can continue shipping Pi-focused release cadence if upstream prefers

## Suggested PR title

`feat: add first-class Pi target with MCPorter + subagent compatibility`
