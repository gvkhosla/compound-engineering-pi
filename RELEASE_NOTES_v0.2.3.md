## v0.2.3 — npm publish hardening + npm-first install docs

### ✅ npm packaging hardening

- Fixed npm `bin` metadata so publish no longer auto-corrects/removes CLI entries.
- Added root launcher files used by npm bin mapping:
  - `compound-engineering-pi`
  - `compound-plugin`
- Kept existing `bin/` wrappers and package behavior unchanged for users.

### ✅ Documentation updates

- README now recommends npm install first:
  - `pi install npm:compound-engineering-pi -l`
- Added git-tag fallback pinned to `v0.2.3`.
- Updated `docs/pi.md` fast path to npm-first with git fallback.
- Updated `NPM_PUBLISH.md` live-version verification example to `0.2.3`.

### Validation

- `bun test` passes.
- `npm pack --dry-run` passes.
- `npm publish --dry-run` passes packaging checks without prior bin auto-correction warnings.
