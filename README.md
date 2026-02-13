# Compound Engineering for Pi

[![npm](https://img.shields.io/npm/v/compound-engineering-pi)](https://www.npmjs.com/package/compound-engineering-pi)
[![Build Status](https://github.com/gvkhosla/compound-engineering-pi/actions/workflows/ci.yml/badge.svg)](https://github.com/gvkhosla/compound-engineering-pi/actions/workflows/ci.yml)

Compound Engineering adapted for [Pi](https://github.com/mariozechner/pi-coding-agent). 47 skills, 9 workflow prompts, and a native compatibility layer, all installable in one command.

## Install

```bash
pi install npm:compound-engineering-pi -l
```

Reload your session, then you're ready:

```bash
/reload
```

## Quick start

```bash
pi -p "/workflows-plan Build a todo app"
pi -p "/workflows-work"
pi -p "/workflows-review"
pi -p "/workflows-compound"
```

These follow the core loop: **Plan, Work, Review, Compound**.

## Project OS for weekly shipping

A proactive weekly shipping system is included in [`project-os/`](./project-os/README.md).

Use it to pick, scope, ship, and review one useful project each week:

```bash
python3 project-os/scripts/pick-next.py
bash project-os/scripts/kickoff-week.sh
```

A scheduled workflow also creates a weekly reminder issue every Monday.

## What's included

### Workflow prompts

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

### 47 skills

Code review, research, design, workflow automation, and more. Specialized reviewers for Rails, Python, and TypeScript. Security auditing, architecture analysis, design iteration, git worktree management, image generation, and browser automation.

Run `pi skills` after installing to see the full list.

### Pi compatibility extension

Four tools that bridge common agent workflows into Pi:

- `ask_user_question` - prompt the user for input
- `subagent` - orchestrate tasks (`single`, `parallel`, `chain`)
- `mcporter_list` - list available MCP servers
- `mcporter_call` - call MCP server tools

### Optional: MCP support via MCPorter

For MCP interoperability, install [MCPorter](https://github.com/steipete/mcporter):

```bash
npm i -g mcporter
```

## Credits

Built on the [Compound Engineering plugin](https://github.com/EveryInc/compound-engineering-plugin) by [Every](https://every.to) and [Kieran Klaassen](https://github.com/kieranklaassen). Read the [original writeup](https://every.to/chain-of-thought/compound-engineering-how-every-codes-with-agents).

## License

MIT
