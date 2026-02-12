# npm Publish Checklist

This repository is configured to publish as:

- **package name:** `compound-engineering-pi`
- **binary commands:**
  - `compound-engineering-pi`
  - `compound-plugin` (alias)

## 1) Log in to npm

```bash
npm login
npm whoami
```

## 2) Validate package before publish

```bash
bun install
bun test
npm pack --dry-run
```

## 3) Publish

```bash
npm publish --access public
```

## 4) Verify install paths

```bash
# CLI available through bunx
bunx compound-engineering-pi --help

# Pi conversion smoke test
bunx compound-engineering-pi install compound-engineering --to pi --pi-home /tmp/pi-smoke/.pi
```

## 5) Tag and release (GitHub)

```bash
VERSION=v0.1.2
git tag "$VERSION"
git push origin "$VERSION"
gh release create "$VERSION" --title "$VERSION" --notes-file RELEASE_NOTES_v0.1.2.md
```

---

## Notes

- CLI currently requires **Bun** runtime.
- Pi MCP compatibility requires **MCPorter** installed in PATH.
