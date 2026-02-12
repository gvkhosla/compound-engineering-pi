---
title: Plugin Versioning and Documentation Requirements
category: workflow
tags: [versioning, changelog, readme, plugin, documentation]
created: 2025-11-24
severity: process
component: plugin-development
---

# Plugin Versioning and Documentation Requirements

## Problem

When making changes to the compound-engineering plugin, documentation can get out of sync with the actual components (agents, commands, skills). This leads to confusion about what's included in each version and makes it difficult to track changes over time.

## Solution

**Every change to the plugin MUST include:**

1. **Version bump in `plugin.json`**
   - Follow semantic versioning (semver)
   - MAJOR: Breaking changes or major reorganization
   - MINOR: New agents, commands, or skills added
   - PATCH: Bug fixes, documentation updates, minor improvements

2. **CHANGELOG.md update**
   - Add entry under `## [Unreleased]` or new version section
   - Use Keep a Changelog format
   - Categories: Added, Changed, Deprecated, Removed, Fixed, Security

3. **README.md verification**
   - Verify component counts match actual files
   - Verify agent/command/skill tables are accurate
   - Update descriptions if functionality changed

## Checklist for Plugin Changes

```markdown
Before committing changes to compound-engineering plugin:

- [ ] Version bumped in `.claude-plugin/plugin.json`
- [ ] CHANGELOG.md updated with changes
- [ ] README.md component counts verified
- [ ] README.md tables updated (if adding/removing/renaming)
- [ ] plugin.json description updated (if component counts changed)
```

## File Locations

- Version: `.claude-plugin/plugin.json` → `"version": "X.Y.Z"`
- Changelog: `CHANGELOG.md`
- Readme: `README.md`

## Example Workflow

When adding a new agent:

1. Create the agent file in `agents/[category]/`
2. Bump version in `plugin.json` (minor version for new agent)
3. Add to CHANGELOG under `### Added`
4. Add row to README agent table
5. Update README component count
6. Update plugin.json description with new counts

## Prevention

This documentation serves as a reminder. When Claude Code works on this plugin, it should:

1. Check this doc before committing changes
2. Follow the checklist above
3. Never commit partial updates (all three files must be updated together)

## Related Files

- `/Users/kieranklaassen/every-marketplace/plugins/compound-engineering/.claude-plugin/plugin.json`
- `/Users/kieranklaassen/every-marketplace/plugins/compound-engineering/CHANGELOG.md`
- `/Users/kieranklaassen/every-marketplace/plugins/compound-engineering/README.md`
