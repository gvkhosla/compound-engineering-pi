# feat: add first-class Pi target with MCPorter + subagent compatibility

## Summary

This PR adds a new `pi` conversion/install target to make the Compound Engineering plugin usable in Pi while preserving the core compounding workflow.

It introduces:
- `--to pi` target support
- generated Pi prompts/skills/extensions
- Pi compatibility extension with `subagent`, `ask_user_question`, `mcporter_list`, `mcporter_call`
- MCP mapping through MCPorter config (`compound-engineering/mcporter.json`)
- `sync --target pi` for personal Claude config migration

## Motivation

The plugin currently works for Claude Code, Codex, and OpenCode. Pi users need equivalent workflows without relying on Claude-specific runtime assumptions (notably MCP/runtime hooks and Task semantics).

## What changed

### New Pi target pipeline
- Added Pi types, converter, and writer:
  - `src/types/pi.ts`
  - `src/converters/claude-to-pi.ts`
  - `src/targets/pi.ts`
- Registered target in `src/targets/index.ts`

### CLI support
- Added `pi` to:
  - `install --to ...`
  - `convert --to ...`
- Added `--pi-home` to both install/convert
- Added `--also pi` support

### Compatibility extension (generated)
- New template source:
  - `src/templates/pi/compat-extension.ts`
- Generated extension contains tools:
  - `ask_user_question`
  - `subagent` (single/parallel/chain)
  - `mcporter_list`
  - `mcporter_call`

### Task translation improvement
- Claude `Task agent(args)` now maps to explicit Pi subagent instructions in converted prompts.

### MCP via MCPorter
- Claude `mcpServers` now convert to MCPorter-compatible JSON written to:
  - `.pi/compound-engineering/mcporter.json` (project)
  - `~/.pi/agent/compound-engineering/mcporter.json` (global default)

### Sync support for Pi
- Added `sync --target pi`:
  - symlinks skills
  - merges MCP servers into Pi MCPorter config
- New file: `src/sync/pi.ts`
- Updated `src/commands/sync.ts`

### Docs
- Added Pi guide: `docs/pi.md`
- Updated README with Pi target, MCPorter prerequisites, and sharing guidance

## Backward compatibility

- No breaking changes for existing `opencode` / `codex` flows.
- Existing commands/targets remain unchanged.
- Pi support is additive.

## Testing

### Added tests
- `tests/pi-converter.test.ts`
- `tests/pi-writer.test.ts`
- `tests/sync-pi.test.ts`
- updated `tests/cli.test.ts` for `--to pi`, `--pi-home`, `--also pi`

### Result
- Full suite passes (`bun test`): all tests green.

## Manual QA checklist

- [ ] `install --to pi` generates prompts/skills/extensions/mcporter config
- [ ] `convert --to pi --pi-home <path>` writes correctly to custom root
- [ ] `sync --target pi` merges MCPorter config and symlinks skills
- [ ] Pi `/reload` loads generated prompt commands
- [ ] `subagent` tool executes single and parallel tasks
- [ ] `mcporter_list` and `mcporter_call` work with generated config

## Risks / limitations

- Subagent tool shells out to nested `pi` process; behavior depends on local runtime/permissions.
- MCP tooling requires `mcporter` installed and available in PATH.
- Task conversion is heuristic-based and may need future tuning for edge syntaxes.

## Follow-ups

1. Add end-to-end Pi smoke tests (spawn Pi + execute sample workflow prompt).
2. Add optional packaging metadata for turnkey `pi install` consumption.
3. Add docs examples for parallel subagent orchestration patterns.
