# Compound Engineering Extension for Pi

[![Build Status](https://github.com/gvkhosla/compound-engineering-pi/actions/workflows/ci.yml/badge.svg)](https://github.com/gvkhosla/compound-engineering-pi/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/compound-engineering-pi)](https://www.npmjs.com/package/compound-engineering-pi)

A Claude Code plugin marketplace featuring the **Compound Engineering Plugin** — tools that make each unit of engineering work easier than the last.

## Quickstart (npm or clone)

### Option A: Use from npm (recommended)

> Requires [Bun](https://bun.sh/) (the CLI runtime) and `mcporter` for Pi MCP compatibility.

```bash
# One-time prerequisites
npm i -g mcporter

# Run directly with bunx
bunx compound-engineering-pi install compound-engineering --to pi
```

### Option B: Clone and run locally

```bash
git clone https://github.com/gvkhosla/compound-engineering-pi.git
cd compound-engineering-pi
bun install
bun run src/index.ts install ./plugins/compound-engineering --to pi
```

## Claude Code Install

```bash
/plugin marketplace add https://github.com/EveryInc/compound-engineering-plugin
/plugin install compound-engineering
```

## OpenCode + Codex + Pi (experimental) Install

This repo includes a Bun/TypeScript CLI that converts Claude Code plugins to OpenCode, Codex, and Pi.

```bash
# convert the compound-engineering plugin into OpenCode format
bunx compound-engineering-pi install compound-engineering --to opencode

# convert to Codex format
bunx compound-engineering-pi install compound-engineering --to codex

# convert to Pi format
bunx compound-engineering-pi install compound-engineering --to pi
```

Local dev:

```bash
bun run src/index.ts install ./plugins/compound-engineering --to opencode
```

OpenCode output is written to `~/.config/opencode` by default, with `opencode.json` at the root and `agents/`, `skills/`, and `plugins/` alongside it.
Codex output is written to `~/.codex/prompts` and `~/.codex/skills`, with each Claude command converted into both a prompt and a skill (the prompt instructs Codex to load the corresponding skill). Generated Codex skill descriptions are truncated to 1024 characters (Codex limit).
Pi output is written to `~/.pi/agent` by default, with generated resources under `prompts/`, `skills/`, and `extensions/`. The Pi target also writes a MCPorter config at `compound-engineering/mcporter.json` and an AGENTS block with compatibility notes.
All non-Claude targets are experimental and may change as the formats evolve.

### Pi target prerequisites

The generated Pi compatibility extension expects [`mcporter`](https://github.com/steipete/mcporter) in PATH:

```bash
npm i -g mcporter
# optional sanity check
mcporter list
```

### Sharing this with the Pi open-source community

If you want others to adopt this quickly, this rollout pattern works well:

1. **Ship a pinned quickstart**
   - include one copy-paste command per target (`opencode`, `codex`, `pi`)
   - include MCPorter install in the Pi path

2. **Keep compatibility explicit**
   - document how Claude concepts map to Pi (`Task` → `subagent`, `AskUserQuestion` → `ask_user_question`)
   - keep AGENTS compatibility block generated and versioned

3. **Prefer additive migration**
   - recommend `--also pi` so teams can compare outputs side-by-side before switching
   - avoid destructive writes to existing project docs/config unless backed up

4. **Publish with reproducible quality gates**
   - run `bun test` in CI for converter + writer + CLI tests
   - add smoke tests for generated Pi extension loading (`pi /reload`)

5. **Document community extension points**
   - where to add custom reviewers/agents (`skills/`)
   - how to override generated prompts safely
   - how to extend MCPorter config for private servers

## Sync Personal Config

Sync your personal Claude Code config (`~/.claude/`) to OpenCode, Codex, or Pi:

```bash
# Sync skills and MCP servers to OpenCode
bunx compound-engineering-pi sync --target opencode

# Sync to Codex
bunx compound-engineering-pi sync --target codex

# Sync to Pi (skills + MCPorter config)
bunx compound-engineering-pi sync --target pi
```

This syncs:
- Personal skills from `~/.claude/skills/` (as symlinks)
- MCP servers from `~/.claude/settings.json`
  - OpenCode: merges into `opencode.json#mcp`
  - Codex: writes `[mcp_servers.*]` in `~/.codex/config.toml`
  - Pi: writes `~/.pi/agent/compound-engineering/mcporter.json` for MCPorter

Skills are symlinked (not copied) so changes in Claude Code are reflected immediately.

## Workflow

```
Plan → Work → Review → Compound → Repeat
```

| Command | Purpose |
|---------|---------|
| `/workflows:plan` | Turn feature ideas into detailed implementation plans |
| `/workflows:work` | Execute plans with worktrees and task tracking |
| `/workflows:review` | Multi-agent code review before merging |
| `/workflows:compound` | Document learnings to make future work easier |

Each cycle compounds: plans inform future plans, reviews catch more issues, patterns get documented.

## Philosophy

**Each unit of engineering work should make subsequent units easier—not harder.**

Traditional development accumulates technical debt. Every feature adds complexity. The codebase becomes harder to work with over time.

Compound engineering inverts this. 80% is in planning and review, 20% is in execution:
- Plan thoroughly before writing code
- Review to catch issues and capture learnings
- Codify knowledge so it's reusable
- Keep quality high so future changes are easy

## Learn More

- [Pi guide](docs/pi.md) - setup, mapping, MCPorter usage, and community rollout
- [npm publish checklist](NPM_PUBLISH.md) - release process for package distribution
- [Full component reference](plugins/compound-engineering/README.md) - all agents, commands, skills
- [Compound engineering: how Every codes with agents](https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents)
- [The story behind compounding engineering](https://every.to/source-code/my-ai-had-already-fixed-the-code-before-i-saw-it)
