# Proposal: Official Pi compatibility target for Compound Engineering

First, thank you Every + Kieran for open-sourcing Compound Engineering.

I’ve built and validated a Pi compatibility layer that preserves your workflow while adapting runtime specifics for Pi.

## Goal

Enable teams to use Compound Engineering in Pi without changing the core model:

`plan → work → review → compound`

## Approach

- Add first-class `pi` target (converter + install + sync)
- Map Claude-specific primitives to Pi-compatible tools
- Use MCPorter for MCP interoperability in Pi

## Key mappings

- `Task agent(args)` → `subagent`
- `AskUserQuestion` → `ask_user_question`
- MCP server/tool operations → `mcporter_list` / `mcporter_call`

## Why MCPorter

Pi does not mirror Claude’s MCP runtime assumptions 1:1. MCPorter gives a portable bridge and keeps behavior explicit.

## What I can contribute upstream

- Pi target implementation
- tests (converter/writer/CLI)
- docs for Pi setup and behavior mapping
- validation notes from real Pi runtime checks

## Non-goals

- no change to existing Claude Code behavior
- no requirement for current users to switch runtimes

If this direction is welcome, I can open a focused PR with additive-only changes and full test coverage.
