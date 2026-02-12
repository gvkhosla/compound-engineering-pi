# PR: Add first-class Pi target with MCPorter + subagent compatibility

Hi Every team — thank you for building and sharing Compound Engineering. This PR is an additive compatibility contribution to help teams run the same workflow in **Pi**.

## Why

Many teams love the Compound Engineering workflow but use Pi as their local agent runtime. This PR ports the workflow in a way that keeps your design intact:

- preserves `plan → work → review → compound`
- keeps Claude-native behavior unchanged
- adds Pi as an optional conversion/install target

## What this PR adds

### 1) New `pi` target

- `--to pi` support in converter/install flows
- Pi bundle writer for prompts, skills, extensions
- Pi sync support (`sync --target pi`)

### 2) Compatibility extension for Pi

Adds generated tools to bridge Claude patterns to Pi:

- `ask_user_question`
- `subagent` (single / parallel / chain)
- `mcporter_list`
- `mcporter_call`

### 3) MCP interoperability via MCPorter

Instead of assuming Claude runtime MCP behavior, Pi uses MCPorter:

- writes MCPorter config for Pi
- routes MCP-style calls through MCPorter CLI

### 4) Command semantics mapping

- `Task agent(args)` → explicit `subagent` instruction in Pi prompts
- `AskUserQuestion` → `ask_user_question`

## Scope / Safety

- additive only (new Pi target)
- no breaking change to Claude Code behavior
- existing targets (Codex/OpenCode/etc.) remain intact

## Validation

- converter/writer/CLI tests added for Pi target
- existing suite still passes
- manual runtime checks validated in Pi:
  - workflows prompt loading
  - subagent single/parallel/chain
  - MCPorter listing/calling

## Notes

If useful for upstream, I’m happy to keep maintaining the Pi compatibility surface in a downstream package as well and sync changes quickly.

Thank you again to Every + Kieran for the original system.
