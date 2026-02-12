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
git tag v0.1.1
git push origin v0.1.1
gh release create v0.1.1 --title "v0.1.1" --notes "npm publish + install docs improvements"
```

---

## Notes

- CLI currently requires **Bun** runtime.
- Pi MCP compatibility requires **MCPorter** installed in PATH.
