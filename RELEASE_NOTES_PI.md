# Release Notes — Pi target (experimental)

## Highlights

This release adds **first-class Pi support** to the Compound plugin converter.

You can now generate Compound Engineering resources for Pi directly:

```bash
bunx @every-env/compound-plugin install compound-engineering --to pi
```

## What’s new

- New conversion target: `pi`
- New CLI options:
  - `--to pi`
  - `--pi-home <path>`
  - `--also pi`
- Generated Pi resources:
  - `prompts/`
  - `skills/`
  - `extensions/compound-engineering-compat.ts`
  - `compound-engineering/mcporter.json`
- New compatibility tools in generated extension:
  - `subagent` (single/parallel/chain)
  - `ask_user_question`
  - `mcporter_list`
  - `mcporter_call`
- New sync target:
  - `bunx @every-env/compound-plugin sync --target pi`

## MCP support note

For Pi, MCP server integration is handled through **MCPorter** config generation, not direct Claude MCP runtime assumptions.

Install MCPorter:

```bash
npm i -g mcporter
```

## Compatibility notes

- Existing OpenCode and Codex support remains unchanged.
- Pi target is currently marked **experimental**.

## Migration quickstart

```bash
# generate Pi resources
bunx @every-env/compound-plugin install compound-engineering --to pi

# optional: sync personal Claude setup into Pi
bunx @every-env/compound-plugin sync --target pi

# run Pi and reload generated resources
pi
/reload
```

## Documentation

See: `docs/pi.md`
