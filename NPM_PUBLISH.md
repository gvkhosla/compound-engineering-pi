# Publish to npm

Run these steps only after the reviewed feature and release-preparation changes are merged into `main`. Publishing and pushing a release tag are maintainer actions; validation and dry runs do not publish anything.

## 0) Go to repo

```bash
cd /path/to/compound-engineering-pi
```

## 1) Login once

```bash
npm login
npm whoami
```

If `npm whoami` prints your username, you are ready.

## 2) Run preflight checks

```bash
npm run release:check
```

This runs tests + package dry run.

## 3) Publish

```bash
npm run release:publish
```

## 4) Verify it is live

```bash
npm view compound-engineering-pi version
```

For this release, you should see: `0.3.0` (matching `package.json`).

## 5) Tag and create the GitHub release

After npm publication succeeds, tag the reviewed release commit and create the GitHub release:

```bash
git tag v0.3.0
git push origin v0.3.0
gh release create v0.3.0 --title "v0.3.0 - Per-subagent model selection" --notes-file RELEASE_NOTES_v0.3.0.md
```

## 6) Verify Pi install path

```bash
pi install npm:compound-engineering-pi -l
```

---

## If publish fails

### `ENEEDAUTH`
Run login again:

```bash
npm login
```

### `You do not have permission`
Your npm account is not allowed to publish this package name.
Use your own scoped package name in `package.json`, e.g.:

```json
"name": "@gvkhosla/compound-engineering-pi"
```

Then publish with:

```bash
npm publish --access public
```

### `version already exists`
Check whether the intended release is already published. If a new version is needed, choose it explicitly and update `package.json`, release notes, and tag commands together. Repeat the preflight checks before publishing; do not blindly retry with another version.
