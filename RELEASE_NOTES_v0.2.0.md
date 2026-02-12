## v0.2.0 — Pi package "just works" release

### Major improvement

You can now install this repo directly as a Pi package and use it immediately, without running the converter manually first.

```bash
pi install git:github.com/gvkhosla/compound-engineering-pi
# or npm (after publish)
pi install npm:compound-engineering-pi
```

### Added

- Prebuilt Pi package resources at repo root:
  - `extensions/`
  - `prompts/`
  - `skills/`
  - `compound-engineering/mcporter.json`
- `pi` package manifest in `package.json` for explicit Pi resource loading
- `pi-package` keyword for discoverability

### Updated

- README and Pi guide now document the one-command install path
- package metadata/files updated for package install use cases

### Existing compatibility (kept)

- `subagent` compatibility tool (single/parallel/chain)
- `ask_user_question`
- MCP via MCPorter (`mcporter_list`, `mcporter_call`)
- converter CLI (`--to pi`, `--pi-home`, `--also pi`)

### Notes

- Pi MCP compatibility still requires MCPorter in PATH:
  ```bash
  npm i -g mcporter
  ```
- converter path remains available for advanced/custom generation workflows
