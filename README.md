# Compound Engineering for Pi

[![Build Status](https://github.com/gvkhosla/compound-engineering-pi/actions/workflows/ci.yml/badge.svg)](https://github.com/gvkhosla/compound-engineering-pi/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/compound-engineering-pi)](https://www.npmjs.com/package/compound-engineering-pi)

Pi-first extension that takes the original Compound Engineering approach and makes it work smoothly in **Pi**.

## 🙌 Credit to the original creators

This project builds directly on the original work by **Every** and **Kieran**.

- Upstream plugin (source of truth): https://github.com/EveryInc/compound-engineering-plugin
- Compound engineering writeup: https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents

If you’re using Claude Code, Codex, OpenCode, or anything non-Pi-focused, use the upstream repo above.

---

## Why this exists

The Every plugin is excellent, but Pi has different runtime semantics. This extension adapts the workflow for Pi so it feels native and works out of the box.

### What this Pi extension adds

- Native Pi package install
- Prebuilt Pi resources (`prompts/`, `skills/`, `extensions/`)
- Compatibility tool layer for Claude-style workflows
- Subagent orchestration in Pi (`single`, `parallel`, `chain`)
- MCP compatibility through **MCPorter** (`mcporter_list`, `mcporter_call`)

---

## Install (recommended)

### 1) Install Pi

- Pi project: https://github.com/mariozechner/pi-coding-agent
- Pi package gallery: https://shittycodingagent.ai/packages
- Discovery request opened with Pi maintainers: https://github.com/badlogic/pi-mono/issues/1480

### 2) Install MCPorter

```bash
npm i -g mcporter
```

### 3) Install this extension in Pi

```bash
pi install git:github.com/gvkhosla/compound-engineering-pi@v0.2.2 -l
# or (after npm publish)
pi install npm:compound-engineering-pi -l
```

### 4) Reload and test

```bash
/reload
pi -p "/workflows-plan Build a todo app"
```

Maintainer publish shortcut (first run `npm login` once):

```bash
npm run release:ship
```

---

## What you get immediately in Pi

- Workflow prompts like `/workflows-plan`, `/workflows-work`, `/workflows-review`, `/workflows-compound`
- Converted skills and reviewer agents
- Pi compatibility extension with tools:
  - `ask_user_question`
  - `subagent`
  - `mcporter_list`
  - `mcporter_call`

This keeps the same compounding loop in Pi:

**Plan → Work → Review → Compound**

---

## How MCP works here

This extension uses **MCPorter** for MCP interoperability in Pi.

- No assumption of Claude-native MCP runtime behavior
- Uses `mcporter` CLI under the hood
- Supports project/global config and bundled fallback config

MCPorter project: https://github.com/steipete/mcporter

---

## Advanced (Pi generation workflow)

If you want to regenerate Pi output from the upstream plugin manually:

```bash
bunx compound-engineering-pi install compound-engineering --to pi --pi-home ~/.pi/agent
```

---

## Non-Pi usage (upstream)

For all non-Pi usage and canonical plugin docs, use:

- https://github.com/EveryInc/compound-engineering-plugin

That includes Claude Code-native setup, canonical command/skill design, and upstream issues/roadmap.

---

## Learn more

- Pi guide for this extension: [docs/pi.md](docs/pi.md)
- Validation report: [VALIDATION.md](VALIDATION.md)
- npm release checklist: [NPM_PUBLISH.md](NPM_PUBLISH.md)
- Upstream canonical component docs: https://github.com/EveryInc/compound-engineering-plugin/blob/main/plugins/compound-engineering/README.md
