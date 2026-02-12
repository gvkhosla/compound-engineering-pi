# Validation Report (v0.2.1)

This checklist was run against `main` before tagging `v0.2.1`.

## Automated test suite

```bash
bun test
```

- ✅ All tests pass
- Includes converter/writer/CLI coverage for OpenCode, Codex, and Pi
- Includes regression test for plugin-name collision in `install` resolution

## Packaging checks

```bash
npm pack --dry-run
```

- ✅ Tarball contains:
  - CLI (`bin/*`)
  - converter source (`src/*`)
  - built Pi package resources (`extensions/`, `skills/`, `prompts/`)
  - bundled MCPorter fallback config (`pi-resources/compound-engineering/mcporter.json`)

## Pi package install checks

In a clean temp project:

```bash
pi install git:github.com/gvkhosla/compound-engineering-pi@v0.2.1 -l
```

- ✅ Package installs successfully
- ✅ Prompt templates are available (`/workflows-plan` works)
- ✅ Compatibility extension tools are available:
  - `ask_user_question`
  - `subagent`
  - `mcporter_list`
  - `mcporter_call`

## Runtime behavior checks

### MCP via MCPorter (not native MCP)

- ✅ `mcporter_list` tool executes `mcporter list ...`
- ✅ Output confirms MCP tool discovery through MCPorter

### Subagent tool modes

- ✅ single mode: `agent + task`
- ✅ parallel mode: `tasks[]`
- ✅ chain mode: `chain[]` + `{previous}` placeholder propagation

All modes run nested Pi sessions (`pi --no-session -p "/skill:..."`) and return structured results.

## Notes

- `npm:compound-engineering-pi` will work after npm publish (requires maintainer `npm login` + publish).
- `git:` install already works and is the recommended path for immediate use.
