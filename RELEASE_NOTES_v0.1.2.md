## v0.1.2 — npm CLI wrapper fix + publish readiness

### Fixed

- npm `bin` commands now use executable wrappers under `bin/`.
- resolved npm publish warning where `bin` entries were dropped.

### Improved

- package metadata/versioning for public npm distribution.
- publish readiness checks documented (`NPM_PUBLISH.md`).

### Notes

- install via `bunx compound-engineering-pi ...`
- requires Bun runtime
- Pi MCP compatibility requires MCPorter in PATH
