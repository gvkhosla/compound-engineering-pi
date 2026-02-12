# Agent Instructions

This repository contains a Bun/TypeScript CLI that converts Claude Code plugins into other agent platform formats.

## Working Agreement

- **Branching:** Create a feature branch for any non-trivial change. If already on the correct branch for the task, keep using it; do not create additional branches or worktrees unless explicitly requested.
- **Safety:** Do not delete or overwrite user data. Avoid destructive commands.
- **Testing:** Run `bun test` after changes that affect parsing, conversion, or output.
- **Output Paths:** Keep OpenCode output at `opencode.json` and `.opencode/{agents,skills,plugins}`.
- **ASCII-first:** Use ASCII unless the file already contains Unicode.

## Adding a New Target Provider (e.g., Codex)

Use this checklist when introducing a new target provider:

1. **Define the target entry**
   - Add a new handler in `src/targets/index.ts` with `implemented: false` until complete.
   - Use a dedicated writer module (e.g., `src/targets/codex.ts`).

2. **Define types and mapping**
   - Add provider-specific types under `src/types/`.
   - Implement conversion logic in `src/converters/` (from Claude → provider).
   - Keep mappings explicit: tools, permissions, hooks/events, model naming.

3. **Wire the CLI**
   - Ensure `convert` and `install` support `--to <provider>` and `--also`.
   - Keep behavior consistent with OpenCode (write to a clean provider root).

4. **Tests (required)**
   - Extend fixtures in `tests/fixtures/sample-plugin`.
   - Add spec coverage for mappings in `tests/converter.test.ts`.
   - Add a writer test for the new provider output tree.
   - Add a CLI test for the provider (similar to `tests/cli.test.ts`).

5. **Docs**
   - Update README with the new `--to` option and output locations.

## When to Add a Provider

Add a new provider when at least one of these is true:

- A real user/workflow needs it now.
- The target format is stable and documented.
- There’s a clear mapping for tools/permissions/hooks.
- You can write fixtures + tests that validate the mapping.

Avoid adding a provider if the target spec is unstable or undocumented.
