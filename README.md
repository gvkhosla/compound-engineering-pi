# Compound Engineering for Pi

[![npm](https://img.shields.io/npm/v/compound-engineering-pi)](https://www.npmjs.com/package/compound-engineering-pi)
[![Build Status](https://github.com/gvkhosla/compound-engineering-pi/actions/workflows/ci.yml/badge.svg)](https://github.com/gvkhosla/compound-engineering-pi/actions/workflows/ci.yml)

Compound Engineering adapted for [Pi](https://github.com/mariozechner/pi-coding-agent). This package keeps Pi users close to the evolving Compound Engineering workflow while preserving Pi-native runtime behavior where Claude Code assumptions do not map 1:1.

## Install

```bash
pi install npm:compound-engineering-pi -l
```

Reload your session, then you're ready:

```bash
/reload
```

## Quick start

Open Pi in your repo and use the canonical Compound Engineering commands:

- `/ce:brainstorm`
- `/ce:plan`
- `/ce:work`
- `/ce:review`
- `/ce:compound`

Legacy `workflows:*` aliases remain available for compatibility.

## What's included

### Canonical CE commands for Pi

- `/ce:ideate`
- `/ce:brainstorm`
- `/ce:plan`
- `/ce:work`
- `/ce:review`
- `/ce:compound`
- `/ce:compound-refresh`
- `/deepen-plan`
- `/test-browser`
- `/feature-video`
- `/todo-resolve`
- `/todo-triage`
- `/resolve-pr-feedback`
- `/reproduce-bug`
- `/report-bug-ce`
- `/onboarding`
- `/changelog`
- `/git-commit`
- `/git-commit-push-pr`
- `/test-xcode`
- `/lfg`
- `/slfg`

### Synced specialist skills

This package includes a large set of Compound Engineering skills for review, research, design, workflow automation, browser automation, git workflows, and more.

### Pi compatibility layer

The package ships Pi-specific compatibility tools for migrated CE flows:

- `ask_user_question`
- `subagent`
- `mcporter_list`
- `mcporter_call`

### Pi-native runtime behavior

This repo intentionally keeps some behavior package-owned instead of relying only on converted prompts:

- canonical `/ce:*` command routing inside Pi
- Pi-native review target resolution and todo handling
- workflow provenance and handoff context
- reproducible subagent wrapper generation for Pi environments

## Optional: MCP support via MCPorter

For MCP interoperability, install [MCPorter](https://github.com/steipete/mcporter):

```bash
npm i -g mcporter
```

## Community contribution

This repo is not trying to fork Compound Engineering philosophically. The goal is narrower and more useful:

- keep Pi users close to the latest upstream Compound Engineering skill graph
- preserve Pi-native runtime behavior where Claude Code assumptions do not map 1:1
- make canonical `/ce:*` commands feel first-class inside Pi
- keep subagent aliases and wrapper generation reproducible instead of hand-maintained

## Keeping this repo current

Typical refresh flow:

1. Sync upstream CE Pi-target skills into `skills/`
2. Keep Pi-owned runtime files current:
   - `extensions/workflow-commands.ts`
   - `extensions/review-runtime.ts`
   - `extensions/workflow-context.ts`
   - `src/workflow-context.ts`
3. Regenerate global wrappers:
   - `node scripts/generate-agent-wrappers.mjs`
4. Smoke test interactively in Pi:
   - `/ce:brainstorm`
   - `/ce:plan`
   - `/ce:review`

## Credits

Built on the [Compound Engineering plugin](https://github.com/EveryInc/compound-engineering-plugin) by [Every](https://every.to) and [Kieran Klaassen](https://github.com/kieranklaassen). Read the [original writeup](https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents).

## License

MIT
