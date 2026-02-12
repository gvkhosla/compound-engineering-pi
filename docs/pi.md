# Compound Engineering for Pi

This guide explains how to use the Compound Engineering plugin in **Pi** with the new `--to pi` target.

## TL;DR

### Fast path (just works)

```bash
# 1) Install as a Pi package
# after npm publish:
pi install npm:compound-engineering-pi
# fallback (works now):
pi install git:github.com/gvkhosla/compound-engineering-pi@v0.2.3

# 2) Install MCPorter (for MCP-style tool access in Pi)
npm i -g mcporter

# 3) Reload Pi resources
/reload
```

### Converter path (advanced/custom)

```bash
bunx compound-engineering-pi install compound-engineering --to pi
```

You will get generated resources under your Pi directory:

- `prompts/` (converted slash commands)
- `skills/` (plugin skills + generated reviewer skills)
- `extensions/compound-engineering-compat.ts` (compat tools)
- `compound-engineering/mcporter.json` (MCPorter server config)

The published package already includes prebuilt `extensions/`, `skills/`, and `prompts/` for Pi package installs.

For package installs, `mcporter_list`/`mcporter_call` also fall back to a bundled config at `pi-resources/compound-engineering/mcporter.json` if no project/global config exists yet.

---

## Why this exists

Claude Code plugins are not directly runnable in Pi.

The `pi` target translates Claude plugin concepts into native Pi resources so teams can keep the same compounding workflow:

**Plan → Work → Review → Compound**

---

## Concept mapping (easy to explain)

| Claude concept | Pi equivalent |
|---|---|
| `commands/*.md` | `.pi/prompts/*.md` |
| `skills/*/SKILL.md` | `.pi/skills/*/SKILL.md` |
| `agents/*.md` | generated Pi skills in `.pi/skills/*/SKILL.md` |
| `Task agent(args)` | `subagent` tool call (generated compat extension) |
| `AskUserQuestion` | `ask_user_question` tool |
| MCP server config | MCPorter config in `.pi/compound-engineering/mcporter.json` |

---

## Generated Pi compatibility tools

The generated extension provides these tools:

### `ask_user_question`
Interactive question/choice tool for workflows that need explicit user decisions.

### `subagent`
Runs skill-based subagents through nested Pi sessions.

Supports:
- **single**: `{ agent, task }`
- **parallel**: `{ tasks: [...] }`
- **chain**: `{ chain: [...] }` with `{previous}` placeholder support

### `mcporter_list`
Lists tools for an MCP server via MCPorter.

### `mcporter_call`
Calls a specific MCP tool via MCPorter.

---

## MCP via MCPorter (instead of native MCP)

Pi itself does not include native MCP runtime behavior identical to Claude Code. This target uses MCPorter as the compatibility layer.

Generated config path:

- Project: `.pi/compound-engineering/mcporter.json`
- Global: `~/.pi/agent/compound-engineering/mcporter.json`

You can extend this file with your own server definitions and auth headers as needed.

---

## Sync your personal Claude setup into Pi

```bash
bunx compound-engineering-pi sync --target pi
```

This syncs:
- personal skills from `~/.claude/skills` (symlinked)
- MCP servers from `~/.claude/settings.json` into Pi MCPorter config

---

## Recommended OSS adoption flow

1. Start with side-by-side generation:
   ```bash
   bunx compound-engineering-pi install compound-engineering --to opencode --also pi
   ```
2. Validate one real workflow (`/workflows-plan` + review loop).
3. Keep generated resources in version control for team reproducibility.
4. Add project-specific skills gradually (don’t fork everything at once).
5. Publish your own package presets once stable.

---

## Troubleshooting

### `mcporter` not found
Install globally:

```bash
npm i -g mcporter
```

### Prompts/skills not visible in Pi
Run:

```bash
/reload
```

### Subagent calls fail
Check:
- target skill exists in `.pi/skills/<name>/SKILL.md`
- nested Pi call works: `pi --no-session -p "/skill:<name> ..."`
- permissions/sandbox rules in your environment

---

## One-paragraph explanation for others

> We added a `--to pi` converter target that ports Compound Engineering Claude plugins into native Pi resources (prompts, skills, extension tools). Claude-only behaviors like `Task(...)` and `AskUserQuestion` are mapped to Pi compatibility tools (`subagent`, `ask_user_question`), and MCP integrations are handled through MCPorter config instead of native MCP runtime assumptions. This keeps the same compounding workflow in Pi while making it easy for open-source teams to share a reproducible setup.
