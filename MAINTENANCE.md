# Maintaining `compound-engineering-pi`

This repo is the **Pi distribution/package layer** for Compound Engineering.

## Canonical source of truth

Primary development should happen in:
- `compound-engineering-plugin` / upstream `EveryInc/compound-engineering-plugin`

That repo is the source of truth for:
- plugin content
- workflow/skill evolution
- converter behavior
- Pi target semantics
- install/sync logic that should work across targets

## What belongs in this repo

Keep Pi-specific work here:
- `extensions/compound-engineering-compat.ts`
- Pi package docs
- legacy Pi compatibility prompts in `prompts/`
- bundled/generated Pi assets:
  - `skills/`
  - `pi-resources/compound-engineering/mcporter.json`
  - vendored `plugins/compound-engineering/` snapshot
- release/refresh tooling such as `scripts/sync-upstream-pi.ts`

## Upstream-first rule

If a change affects any of these, make it in the plugin repo first:
- conversion behavior
- content transformation rules
- target semantics
- shared sync/install logic
- skill/prompt/source plugin content

Only make changes here first when they are truly Pi-package-specific, such as:
- package install UX
- Pi-only extension behavior
- Pi docs
- release bundling concerns

## Sync workflow

Refresh this repo from the upstream-capable plugin checkout with:

```bash
bun run sync:upstream
```

Default source:
- `../compound-engineering-plugin`

Override if needed:

```bash
COMPOUND_PLUGIN_SOURCE=/path/to/compound-engineering-plugin bun run sync:upstream
```

What sync does:
1. runs the upstream-capable converter with `--to pi`
2. refreshes the vendored `plugins/compound-engineering/` snapshot
3. regenerates bundled Pi `skills/`
4. refreshes bundled `pi-resources/compound-engineering/mcporter.json`

## Test scope

The local test suite is intentionally Pi-focused.

Keep tests here for:
- Pi converter behavior
- Pi writer/sync behavior
- Pi-specific CLI compatibility smoke tests
- Claude plugin parsing relied on by Pi sync/generation

Do not try to duplicate exhaustive cross-target converter coverage here; that belongs upstream.

## Safe release workflow

1. Make converter/content changes upstream first
2. Sync into this repo with `bun run sync:upstream`
3. Re-apply or verify any Pi-only compatibility changes
4. Run tests:

```bash
bun test
```

5. Publish from this repo only when the package assets and Pi-specific docs are ready

## Anti-goal

Do **not** let this repo become a second independently evolving plugin fork.

If you are unsure where a change belongs, default to:
- upstream plugin repo first
- this repo second
