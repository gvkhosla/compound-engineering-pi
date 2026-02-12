## v0.2.2 — discoverability + first-time publish UX

### Pi ecosystem discoverability

- Added Pi package gallery metadata in `package.json`:
  - `keywords: ["pi-package", ...]`
  - `pi.image` preview URL
- Opened maintainer discovery request in Pi upstream:
  - https://github.com/badlogic/pi-mono/issues/1480

### npm publish made very simple

- Added first-time friendly publish guide in `NPM_PUBLISH.md`
- Added one-command maintainer scripts:
  - `npm run release:check`
  - `npm run release:publish`
  - `npm run release:ship`

### Package metadata improvements

- Added npm trust metadata:
  - `license`, `author`, `homepage`, `repository`, `bugs`
- Updated package description/keywords to Pi-first positioning

### Docs updates

- README now links Pi project + package gallery + maintainer request issue
- README install pin updated to `v0.2.2`
- `docs/pi.md` install pin updated to `v0.2.2`
