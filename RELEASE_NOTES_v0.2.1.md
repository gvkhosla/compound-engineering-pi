## v0.2.1 — Stability + trust release

### ✅ Reliability fixes

- Fixed CLI plugin resolution when a folder named `compound-engineering/` exists in repo root.
  - `install compound-engineering` now prefers `./plugins/compound-engineering` for named installs.
  - Prevents false failures (`Could not find .claude-plugin/plugin.json ...`).

### ✅ Pi package robustness

- Added bundled MCPorter config fallback resolution in the Pi compat extension:
  - checks project config: `.pi/compound-engineering/mcporter.json`
  - checks global config: `~/.pi/agent/compound-engineering/mcporter.json`
  - falls back to bundled package config: `pi-resources/compound-engineering/mcporter.json`
- Added backwards-compatible fallback to legacy bundled path used in `v0.2.0`.

### ✅ Packaging cleanup

- Moved bundled package config from `compound-engineering/` to `pi-resources/compound-engineering/` to avoid path/name collisions.
- Updated package files whitelist accordingly.

### ✅ Confidence improvements

- Added CLI regression test for plugin-name collision.
- Added `VALIDATION.md` with reproducible verification steps and runtime checks.
- Re-ran full test suite and package dry run.

### Install

```bash
pi install git:github.com/gvkhosla/compound-engineering-pi@v0.2.1
```

(Use `-l` for project-local package settings.)
