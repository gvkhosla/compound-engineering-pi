---
name: file-todos
description: This skill should be used when managing the file-based todo tracking system in the .context/compound-engineering/todos/ directory. It provides workflows for creating todos, managing status and dependencies, conducting triage, and integrating with code review processes.
disable-model-invocation: true
---

# File-Based Todo Tracking Skill

## Overview

The `.context/compound-engineering/todos/` directory contains a file-based tracking system for managing code review feedback, technical debt, feature requests, and work items. Each todo is a markdown file with YAML frontmatter and structured sections.

> **Legacy support:** During the transition period, always check both `.context/compound-engineering/todos/` (canonical) and `todos/` (legacy) when reading or searching for todos. Write new todos only to the canonical path. Unlike per-run scratch directories, `.context/compound-engineering/todos/` has a multi-session lifecycle -- do not clean it up as part of post-run scratch cleanup.

This skill should be used when:
- Creating new todos from findings or feedback
- Managing todo lifecycle (pending -> ready -> complete)
- Triaging pending items for approval
- Checking or managing dependencies
- Converting PR comments or code findings into tracked work
- Updating work logs during todo execution

## Directory Paths

| Purpose | Path |
|---------|------|
| **Canonical (write here)** | `.context/compound-engineering/todos/` |
| **Legacy (read-only)** | `todos/` |

When searching or listing todos, always search both paths. When creating new todos, always write to the canonical path.

## File Naming Convention

```
{issue_id}-{status}-{priority}-{description}.md
```

**Components:**
- **issue_id**: Sequential number (001, 002, 003...) -- never reused
- **status**: `pending` (needs triage), `ready` (approved), `complete` (done)
- **priority**: `p1` (critical), `p2` (important), `p3` (nice-to-have)
- **description**: kebab-case, brief description

**Examples:**
```
001-pending-p1-mailer-test.md
002-ready-p1-fix-n-plus-1.md
005-complete-p2-refactor-csv.md
```

## File Structure

Each todo is a markdown file with YAML frontmatter and structured sections. Use the template at [todo-template.md](./assets/todo-template.md) as a starting point when creating new todos.

**Required sections:**
- **Problem Statement** -- What is broken, missing, or needs improvement?
- **Findings** -- Investigation results, root cause, key discoveries
- **Proposed Solutions** -- Multiple options with pros/cons, effort, risk
- **Recommended Action** -- Clear plan (filled during triage)
- **Acceptance Criteria** -- Testable checklist items
- **Work Log** -- Chronological record with date, actions, learnings

**Optional sections:**
- **Technical Details** -- Affected files, related components, DB changes
- **Resources** -- Links to errors, tests, PRs, documentation
- **Notes** -- Additional context or decisions

**YAML frontmatter fields:**
```yaml
---
status: ready              # pending | ready | complete
priority: p1              # p1 | p2 | p3
issue_id: "002"
tags: [rails, performance, database]
dependencies: ["001"]     # Issue IDs this is blocked by
---
```

## Common Workflows

> **Tool preference:** Use native file-search (e.g., Glob in Claude Code) and content-search (e.g., Grep in Claude Code) tools instead of shell commands for finding and reading todo files. This avoids unnecessary permission prompts in sub-agent workflows. Use shell only for operations that have no native equivalent (e.g., `mv` for renames, `mkdir -p` for directory creation).

### Creating a New Todo

1. Ensure directory exists: `mkdir -p .context/compound-engineering/todos/`
2. Determine next issue ID by searching both canonical and legacy paths for files matching `[0-9]*-*.md` using the native file-search/glob tool. Extract the numeric prefix from each filename, find the highest, and increment by one. Zero-pad to 3 digits (e.g., `007`).
3. Read the template at [todo-template.md](./assets/todo-template.md), then write it to `.context/compound-engineering/todos/{NEXT_ID}-pending-{priority}-{description}.md` using the native file-write tool.
4. Edit and fill required sections:
   - Problem Statement
   - Findings (if from investigation)
   - Proposed Solutions (multiple options)
   - Acceptance Criteria
   - Add initial Work Log entry
5. Determine status: `pending` (needs triage) or `ready` (pre-approved)
6. Add relevant tags for filtering

**When to create a todo:**
- Requires more than 15-20 minutes of work
- Needs research, planning, or multiple approaches considered
- Has dependencies on other work
- Requires manager approval or prioritization
- Part of larger feature or refactor
- Technical debt needing documentation

**When to act immediately instead:**
- Issue is trivial (< 15 minutes)
- Complete context available now
- No planning needed
- User explicitly requests immediate action
- Simple bug fix with obvious solution

### Triaging Pending Items

1. Find pending items using the native file-search/glob tool with pattern `*-pending-*.md` in both directory paths.
2. For each todo:
   - Read Problem Statement and Findings
   - Review Proposed Solutions
   - Make decision: approve, defer, or modify priority
3. Update approved todos:
   - Rename file: `mv {file}-pending-{pri}-{desc}.md {file}-ready-{pri}-{desc}.md`
   - Update frontmatter: `status: pending` -> `status: ready`
   - Fill "Recommended Action" section with clear plan
   - Adjust priority if different from initial assessment
4. Deferred todos stay in `pending` status

Load the `triage` skill for an interactive approval workflow.

### Managing Dependencies

**To track dependencies:**

```yaml
dependencies: ["002", "005"]  # This todo blocked by issues 002 and 005
dependencies: []               # No blockers - can work immediately
```

**To check what blocks a todo:** Use the native content-search tool (e.g., Grep in Claude Code) to search for `^dependencies:` in the todo file.

**To find what a todo blocks:** Search both directory paths for files containing `dependencies:.*"002"` using the native content-search tool.

**To verify blockers are complete before starting:** For each dependency ID, use the native file-search/glob tool to look for `{dep_id}-complete-*.md` in both directory paths. Any missing matches indicate incomplete blockers.

### Updating Work Logs

When working on a todo, always add a work log entry:

```markdown
### YYYY-MM-DD - Session Title

**By:** Agent name / Developer Name

**Actions:**
- Specific changes made (include file:line references)
- Commands executed
- Tests run
- Results of investigation

**Learnings:**
- What worked / what didn't
- Patterns discovered
- Key insights for future work
```

Work logs serve as:
- Historical record of investigation
- Documentation of approaches attempted
- Knowledge sharing for team
- Context for future similar work

### Completing a Todo

1. Verify all acceptance criteria checked off
2. Update Work Log with final session and results
3. Rename file: `mv {file}-ready-{pri}-{desc}.md {file}-complete-{pri}-{desc}.md`
4. Update frontmatter: `status: ready` -> `status: complete`
5. Check for unblocked work: search both directory paths for `*-ready-*.md` files containing `dependencies:.*"{issue_id}"` using the native content-search tool
6. Commit with issue reference: `feat: resolve issue 002`

## Integration with Development Workflows

| Trigger | Flow | Tool |
|---------|------|------|
| Code review | `/ce:review` -> Findings -> `/triage` -> Todos | Review agent + skill |
| Beta autonomous review | `/ce:review-beta mode:autonomous` -> Downstream-resolver residual todos -> `/resolve-todo-parallel` | Review skill + todos |
| PR comments | `/resolve_pr_parallel` -> Individual fixes -> Todos | gh CLI + skill |
| Code TODOs | `/resolve-todo-parallel` -> Fixes + Complex todos | Agent + skill |
| Planning | Brainstorm -> Create todo -> Work -> Complete | Skill |
| Feedback | Discussion -> Create todo -> Triage -> Work | Skill |

## Quick Reference Patterns

Use the native file-search/glob tool (e.g., Glob in Claude Code) and content-search tool (e.g., Grep in Claude Code) for these operations. Search both canonical and legacy directory paths.

**Finding work:**

| Goal | Tool | Pattern |
|------|------|---------|
| List highest priority unblocked work | Content-search | `dependencies: \[\]` in `*-ready-p1-*.md` |
| List all pending items needing triage | File-search | `*-pending-*.md` |
| Find next issue ID | File-search | `[0-9]*-*.md`, extract highest numeric prefix |
| Count by status | File-search | `*-pending-*.md`, `*-ready-*.md`, `*-complete-*.md` |

**Dependency management:**

| Goal | Tool | Pattern |
|------|------|---------|
| What blocks this todo? | Content-search | `^dependencies:` in the specific todo file |
| What does this todo block? | Content-search | `dependencies:.*"{id}"` across all todo files |

**Searching:**

| Goal | Tool | Pattern |
|------|------|---------|
| Search by tag | Content-search | `tags:.*{tag}` across all todo files |
| Search by priority | File-search | `*-p1-*.md` (or p2, p3) |
| Full-text search | Content-search | `{keyword}` across both directory paths |

## Key Distinctions

**File-todos system (this skill):**
- Markdown files in `.context/compound-engineering/todos/` (legacy: `todos/`)
- Development/project tracking across sessions and agents
- Standalone markdown files with YAML frontmatter
- Persisted to disk, cross-agent accessible

**In-session task tracking (e.g., TaskCreate/TaskUpdate in Claude Code, update_plan in Codex):**
- In-memory task tracking during agent sessions
- Temporary tracking for single conversation
- Not persisted to disk after session ends
- Different purpose: use for tracking steps within a session, not for durable cross-session work items
