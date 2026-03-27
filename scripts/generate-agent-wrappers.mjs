#!/usr/bin/env node
import { promises as fs } from "node:fs"
import path from "node:path"
import os from "node:os"

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname)
const skillsDir = path.join(repoRoot, "skills")
const agentsDir = path.join(os.homedir(), ".pi", "agent", "agents")

const CATEGORY_SKILLS = {
  review: new Set([
    "agent-native-reviewer",
    "adversarial-reviewer",
    "api-contract-reviewer",
    "architecture-strategist",
    "cli-agent-readiness-reviewer",
    "code-simplicity-reviewer",
    "correctness-reviewer",
    "data-integrity-guardian",
    "data-migration-expert",
    "data-migrations-reviewer",
    "deployment-verification-agent",
    "dhh-rails-reviewer",
    "julik-frontend-races-reviewer",
    "kieran-python-reviewer",
    "kieran-rails-reviewer",
    "kieran-typescript-reviewer",
    "maintainability-reviewer",
    "pattern-recognition-specialist",
    "performance-oracle",
    "performance-reviewer",
    "project-standards-reviewer",
    "reliability-reviewer",
    "schema-drift-detector",
    "security-reviewer",
    "security-sentinel",
    "testing-reviewer",
  ]),
  research: new Set([
    "best-practices-researcher",
    "framework-docs-researcher",
    "git-history-analyzer",
    "issue-intelligence-analyst",
    "learnings-researcher",
    "repo-research-analyst",
  ]),
  design: new Set([
    "design-implementation-reviewer",
    "design-iterator",
    "figma-design-sync",
  ]),
  workflow: new Set([
    "bug-reproduction-validator",
    "lint",
    "pr-comment-resolver",
    "spec-flow-analyzer",
  ]),
  "document-review": new Set([
    "adversarial-document-reviewer",
    "coherence-reviewer",
    "design-lens-reviewer",
    "feasibility-reviewer",
    "product-lens-reviewer",
    "scope-guardian-reviewer",
    "security-lens-reviewer",
  ]),
  docs: new Set([
    "ankane-readme-writer",
  ]),
}

const HEADER = `# Global Compound Engineering agent wrappers

These \`.md\` files make Compound Engineering skills invokable through the global \`pi-subagents\` runtime.

Design:
- one wrapper per CE skill directory in \`/home/will/SITES/pi-compound-engineering/skills\`
- wrapper name matches the CE skill name
- additional alias wrappers cover migrated names like \`Explore\`, \`Plan\`, \`general-purpose\`, \`Bash\`, and namespaced \`compound-engineering:*:*\` agent references
- wrappers grant standard built-in tools plus inherited extension tools
- wrappers inject the matching Pi skill via \`skill: <name>\` when a real CE skill exists

Important:
- review-oriented wrappers intentionally keep \`edit\`/\`write\` available because CE review agents may emit markdown todo files as part of the workflow
- generic aliases without a backing CE skill use a plain system prompt instead of \`skill:\` injection

This lets migrated CE prompts and interoperability layers call those names as subagents from any repo, not just \`prbot\`.
`

function wrapperBody(skillName) {
  return [
    "---",
    `name: ${skillName}`,
    `description: Compound Engineering skill wrapper: ${skillName}`,
    "tools: read, bash, edit, write, grep, find, ls",
    "thinking: medium",
    `skill: ${skillName}`,
    "defaultProgress: true",
    "---",
    `Use the injected Compound Engineering skill \`${skillName}\` to carry out the assigned task.`,
    "Prefer concrete evidence, stay scoped to the request, and only edit files when the task explicitly calls for changes.",
    "",
  ].join("\n")
}

function namespacedWrapperBody(aliasName, skillName) {
  return [
    "---",
    `name: ${aliasName}`,
    `description: Namespaced Compound Engineering alias for ${skillName}`,
    "tools: read, bash, edit, write, grep, find, ls",
    "thinking: medium",
    `skill: ${skillName}`,
    "defaultProgress: true",
    "---",
    `Use the injected Compound Engineering skill \`${skillName}\` to carry out the assigned task.`,
    "Stay scoped to the request, prefer concrete evidence, and preserve the ability to write markdown todo files when the workflow calls for them.",
    "",
  ].join("\n")
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

async function listSkillNames() {
  const entries = await fs.readdir(skillsDir, { withFileTypes: true })
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
}

async function writeFileIfChanged(filePath, content) {
  const existing = await fs.readFile(filePath, "utf8").catch(() => null)
  if (existing === content) return false
  await fs.writeFile(filePath, content, "utf8")
  return true
}

async function main() {
  await ensureDir(agentsDir)
  let changed = 0

  changed += Number(await writeFileIfChanged(path.join(agentsDir, "README.md"), HEADER))

  const skillNames = await listSkillNames()
  for (const skillName of skillNames) {
    changed += Number(await writeFileIfChanged(path.join(agentsDir, `${skillName}.md`), wrapperBody(skillName)))
  }

  for (const [category, names] of Object.entries(CATEGORY_SKILLS)) {
    for (const skillName of names) {
      if (!skillNames.includes(skillName)) continue
      const aliasName = `compound-engineering:${category}:${skillName}`
      changed += Number(await writeFileIfChanged(path.join(agentsDir, `${aliasName}.md`), namespacedWrapperBody(aliasName, skillName)))
    }
  }

  console.log(`Generated/updated ${changed} wrapper files in ${agentsDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
