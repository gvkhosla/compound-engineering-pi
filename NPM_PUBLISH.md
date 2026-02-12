# Publish to npm (super simple)

If this is your first time publishing, run these exact commands in order.

## 0) Go to repo

```bash
cd /tmp/compound-engineering-pi
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

You should see: `0.2.3`

## 5) Verify Pi install path

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
Bump version, then publish again:

```bash
npm version patch
npm publish --access public
```
