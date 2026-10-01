# v0.3.0 - Per-subagent model selection

## Added

- Choose a model for each compatibility `subagent` invocation in single, parallel, and chain modes.
- Use a top-level `model` as the default for parallel tasks or chain steps, with per-entry overrides.
- Pass Pi model selectors such as `haiku`, `provider/modelId`, or a `:thinking` suffix. Model strings are trimmed and shell-quoted.

## Compatibility

- Omitting `model` keeps existing behavior: the child Pi process uses its configured default, not necessarily the parent's active model.
- Empty/whitespace-only entry models clear the top-level default and omit `--model`.
- No new model service or orchestration backend. Subagents still run through `pi --no-session`.
- A separately installed `pi-subagents` package still takes precedence over the compatibility tool.

## Validation

- Behavioral tests invoke both bundled and generated extension tools and check actual Bash argument boundaries without paid model calls.
- Coverage includes single/parallel/chain forwarding, root defaults, entry overrides, blank models, previous-output substitution, cwd, timeout/signal forwarding, shell metacharacters, and chain failure behavior.
- The bundled extension and converter template are checked for parity.
- `bun test`: 47 passing tests across 7 files.
- `npm run release:check` and `npm publish --dry-run --access public`: passed. The inspected v0.3.0 tarball contains 367 files, including both extension sources and the updated user docs. Nothing was published.
- The installed Pi runtime loaded the extension and exercised all three modes through an RPC command with 8 simulated child invocations; no provider/model run was started.
- Negative control against pre-feature `origin/main`: 13 failures, including forwarding and schema checks, confirming the regression suite detects the missing feature.
- Paid live-model smoke testing remains separate and was not performed. Repeat the release checks on the final merged commit before publishing.

## Thanks

Thanks to [@mikkel250](https://github.com/mikkel250) for [PR #12](https://github.com/gvkhosla/compound-engineering-pi/pull/12).
