# Compound Engineering for Pi

[![npm](https://img.shields.io/npm/v/compound-engineering-pi)](https://www.npmjs.com/package/compound-engineering-pi)
[![Build Status](https://github.com/gvkhosla/compound-engineering-pi/actions/workflows/ci.yml/badge.svg)](https://github.com/gvkhosla/compound-engineering-pi/actions/workflows/ci.yml)

Compound Engineering adapted for [Pi](https://github.com/mariozechner/pi-coding-agent). 84 skills, 9 legacy workflow prompts for compatibility, and a native compatibility layer, all installable in one command.

## Install

```bash
pi install npm:compound-engineering-pi -l
```

Reload your session, then you're ready:

```bash
/reload
```

## Quick start

Legacy prompt aliases still work:

```bash
pi -p "/workflows-plan Build a todo app"
pi -p "/workflows-work"
pi -p "/workflows-review"
pi -p "/workflows-compound"
```

And the newer upstream workflow skills are bundled too:

```bash
pi -p "/skill:ce:plan Build a todo app"
pi -p "/skill:ce:work"
pi -p "/skill:ce:review"
pi -p "/skill:ce:compound"
```

These follow the core loop: **Plan, Work, Review, Compound**.

## What's included

### Legacy workflow prompts

| Prompt | What it does |
|--------|-------------|
| `/workflows-plan` | Create a structured project plan |
| `/workflows-work` | Execute work from a plan |
| `/workflows-review` | Multi-agent code review |
| `/workflows-compound` | Document learnings for future sessions |
| `/workflows-brainstorm` | Explore ideas before planning |
| `/deepen-plan` | Add depth to an existing plan |
| `/test-browser` | Run browser tests on your pages |
| `/feature-video` | Record a video walkthrough of a feature |
| `/resolve_todo_parallel` | Resolve all pending todos in parallel |

### 84 skills

This package now bundles the newer upstream Compound Engineering skill set for Pi, including the `ce:*` workflow skills, reviewer personas, planning/document-review personas, browser/video workflows, and the older specialized research/review skills that still power the legacy prompts.

Run `pi skills` after installing to see the full list.

### Pi compatibility extension

Four tools that bridge common agent workflows into Pi:

- `ask_user_question` - prompt the user for input
- `subagent` - orchestrate tasks (`single`, `parallel`, `chain`)
- `mcporter_list` - list available MCP servers
- `mcporter_call` - call MCP server tools

Subagent output behavior:
- single runs return the full subagent output
- chain runs return the final step output plus a step summary
- parallel runs stay compact by default, but support `includeOutputs: true`
- if you install a richer `pi-subagents` package, this package automatically defers to it

### Upstream sync

The vendored `plugins/compound-engineering` snapshot and bundled Pi skills can now be refreshed from the main plugin repo with:

```bash
bun run sync:upstream
```

By default this syncs from `../compound-engineering-plugin`. Override with `COMPOUND_PLUGIN_SOURCE=/path/to/compound-engineering-plugin` if needed.

### Optional: MCP support via MCPorter

For MCP interoperability, install [MCPorter](https://github.com/steipete/mcporter):

```bash
npm i -g mcporter
```

## Credits

Built on the [Compound Engineering plugin](https://github.com/EveryInc/compound-engineering-plugin) by [Every](https://every.to) and [Kieran Klaassen](https://github.com/kieranklaassen). Read the [original writeup](https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents).

## License

MIT
