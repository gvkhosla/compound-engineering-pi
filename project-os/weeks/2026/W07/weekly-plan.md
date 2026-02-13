# Weekly plan 2026-W07

Window: 2026-02-09 to 2026-02-13

## Weekly target
- Project: P001 One-command release checker
- User: Solo maintainer shipping npm releases
- Core value: Run one command before release to catch breakages early

## Definition of done (Friday)
- [ ] Merged to main
- [ ] CI green
- [ ] README or changelog updated
- [ ] One sentence on why this is useful

## Scope
### Must ship
- [ ] Add `scripts/release-check.sh` that runs tests and `npm pack --dry-run`
- [ ] Print clear pass or fail summary and exit non-zero on failure
- [ ] Document usage in README release section

### Nice to have
- [ ] Add optional `--quick` mode for fast checks
- [ ] Add changelog reminder line in output

### Out of scope
-

## Build plan
### Monday
- [ ] Finalize scope
- [ ] Open branch
- [ ] First commit

### Tuesday
- [ ] Core loop implementation

### Wednesday
- [ ] Hardening and edge cases

### Thursday
- [ ] Tests, docs, cleanup

### Friday
- [ ] Ship and write review

## Risks and cuts
- Biggest risk: script assumptions differ across local and CI shells
- If blocked, what to cut first: remove quick mode and ship core release check only
