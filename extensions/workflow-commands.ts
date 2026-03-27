import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent"
import {
  buildCeWorkflowContextSummary,
  loadCeWorkflowContext,
  mergeCeWorkflowContext,
  parseMarkdownFrontmatter,
  seedCeWorkflowContextFromInputDocument,
} from "../src/workflow-context.ts"

type CommandSource =
  | { kind: "prompt"; promptFile: string }
  | { kind: "skill"; skillName: string }

type CommandSpec = {
  command: string
  description: string
  source: CommandSource
  deprecatedMessage?: string
}

const extensionDir = path.dirname(fileURLToPath(import.meta.url))
const workflowPromptsDir = path.join(extensionDir, "..", "workflow-prompts")
const skillsDir = path.join(extensionDir, "..", "skills")

const WORKFLOW_HANDOFF_ANCHOR_TYPE = "ce-workflow-handoff-anchor"
const PLAN_COMMANDS = new Set(["ce:plan", "ce-plan", "workflows-plan", "workflows:plan"])
const WORK_COMMANDS = new Set(["ce:work", "ce-work", "workflows-work", "workflows:work"])
const TODO_RESOLVE_COMMANDS = new Set(["todo-resolve", "resolve_todo_parallel"])

const COMMAND_SPECS: CommandSpec[] = [
  {
    command: "ce:ideate",
    description: "Compound Engineering ideation workflow",
    source: { kind: "skill", skillName: "ce-ideate" },
  },
  {
    command: "ce-ideate",
    description: "Alias for /ce:ideate",
    source: { kind: "skill", skillName: "ce-ideate" },
  },
  {
    command: "ce:brainstorm",
    description: "Compound Engineering brainstorm workflow",
    source: { kind: "skill", skillName: "ce-brainstorm" },
  },
  {
    command: "ce-brainstorm",
    description: "Alias for /ce:brainstorm",
    source: { kind: "skill", skillName: "ce-brainstorm" },
  },
  {
    command: "workflows-brainstorm",
    description: "Legacy alias for /ce:brainstorm",
    source: { kind: "skill", skillName: "ce-brainstorm" },
    deprecatedMessage: "/workflows-brainstorm is legacy; running canonical /ce:brainstorm",
  },
  {
    command: "workflows:brainstorm",
    description: "Deprecated alias for /ce:brainstorm",
    source: { kind: "skill", skillName: "ce-brainstorm" },
    deprecatedMessage: "/workflows:brainstorm is deprecated; running canonical /ce:brainstorm",
  },
  {
    command: "ce:plan",
    description: "Compound Engineering planning workflow",
    source: { kind: "skill", skillName: "ce-plan" },
  },
  {
    command: "ce-plan",
    description: "Alias for /ce:plan",
    source: { kind: "skill", skillName: "ce-plan" },
  },
  {
    command: "workflows-plan",
    description: "Legacy alias for /ce:plan",
    source: { kind: "skill", skillName: "ce-plan" },
    deprecatedMessage: "/workflows-plan is legacy; running canonical /ce:plan",
  },
  {
    command: "workflows:plan",
    description: "Deprecated alias for /ce:plan",
    source: { kind: "skill", skillName: "ce-plan" },
    deprecatedMessage: "/workflows:plan is deprecated; running canonical /ce:plan",
  },
  {
    command: "ce:work",
    description: "Compound Engineering execution workflow",
    source: { kind: "skill", skillName: "ce-work" },
  },
  {
    command: "ce-work",
    description: "Alias for /ce:work",
    source: { kind: "skill", skillName: "ce-work" },
  },
  {
    command: "workflows-work",
    description: "Legacy alias for /ce:work",
    source: { kind: "skill", skillName: "ce-work" },
    deprecatedMessage: "/workflows-work is legacy; running canonical /ce:work",
  },
  {
    command: "workflows:work",
    description: "Deprecated alias for /ce:work",
    source: { kind: "skill", skillName: "ce-work" },
    deprecatedMessage: "/workflows:work is deprecated; running canonical /ce:work",
  },
  {
    command: "ce:compound",
    description: "Compound Engineering compound knowledge workflow",
    source: { kind: "skill", skillName: "ce-compound" },
  },
  {
    command: "ce-compound",
    description: "Alias for /ce:compound",
    source: { kind: "skill", skillName: "ce-compound" },
  },
  {
    command: "workflows-compound",
    description: "Legacy alias for /ce:compound",
    source: { kind: "skill", skillName: "ce-compound" },
    deprecatedMessage: "/workflows-compound is legacy; running canonical /ce:compound",
  },
  {
    command: "workflows:compound",
    description: "Deprecated alias for /ce:compound",
    source: { kind: "skill", skillName: "ce-compound" },
    deprecatedMessage: "/workflows:compound is deprecated; running canonical /ce:compound",
  },
  {
    command: "ce:compound-refresh",
    description: "Refresh or prune stale compound learnings",
    source: { kind: "skill", skillName: "ce-compound-refresh" },
  },
  {
    command: "ce-compound-refresh",
    description: "Alias for /ce:compound-refresh",
    source: { kind: "skill", skillName: "ce-compound-refresh" },
  },
  {
    command: "deepen-plan",
    description: "Deepen a plan with parallel specialist research",
    source: { kind: "prompt", promptFile: "deepen-plan.md" },
  },
  {
    command: "test-browser",
    description: "Run browser tests for changed pages",
    source: { kind: "skill", skillName: "test-browser" },
  },
  {
    command: "feature-video",
    description: "Record a feature walkthrough video",
    source: { kind: "skill", skillName: "feature-video" },
  },
  {
    command: "todo-resolve",
    description: "Resolve ready Compound Engineering todos",
    source: { kind: "skill", skillName: "todo-resolve" },
  },
  {
    command: "todo-triage",
    description: "Triage pending Compound Engineering todos",
    source: { kind: "skill", skillName: "todo-triage" },
  },
  {
    command: "resolve_todo_parallel",
    description: "Deprecated alias for /todo-resolve",
    source: { kind: "skill", skillName: "todo-resolve" },
    deprecatedMessage: "/resolve_todo_parallel is deprecated; running canonical /todo-resolve",
  },
  {
    command: "resolve-pr-feedback",
    description: "Resolve PR feedback in parallel",
    source: { kind: "skill", skillName: "resolve-pr-feedback" },
  },
  {
    command: "reproduce-bug",
    description: "Reproduce and investigate a bug",
    source: { kind: "skill", skillName: "reproduce-bug" },
  },
  {
    command: "report-bug-ce",
    description: "Report a bug in compound engineering",
    source: { kind: "skill", skillName: "report-bug-ce" },
  },
  {
    command: "onboarding",
    description: "Generate repository onboarding guidance",
    source: { kind: "skill", skillName: "onboarding" },
  },
  {
    command: "changelog",
    description: "Create a changelog for recent merges",
    source: { kind: "skill", skillName: "changelog" },
  },
  {
    command: "git-commit",
    description: "Create a git commit with a value-focused message",
    source: { kind: "skill", skillName: "git-commit" },
  },
  {
    command: "git-commit-push-pr",
    description: "Commit, push, and open or update a PR",
    source: { kind: "skill", skillName: "git-commit-push-pr" },
  },
  {
    command: "test-xcode",
    description: "Build and test an iOS app on simulator",
    source: { kind: "skill", skillName: "test-xcode" },
  },
  {
    command: "lfg",
    description: "Run the full autonomous Compound Engineering workflow",
    source: { kind: "skill", skillName: "lfg" },
  },
  {
    command: "slfg",
    description: "Run the swarm-mode autonomous Compound Engineering workflow",
    source: { kind: "skill", skillName: "slfg" },
  },
]

function stripFrontmatter(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, "\n")
  if (!normalized.startsWith("---\n")) return normalized.trim()
  const end = normalized.indexOf("\n---\n", 4)
  if (end === -1) return normalized.trim()
  return normalized.slice(end + 5).trim()
}

function renderPromptTemplate(template: string, args: string | undefined): string {
  const trimmedArgs = String(args || "").trim()
  return template.replace(/#\$ARGUMENTS/g, trimmedArgs)
}

async function loadPromptBody(promptFile: string): Promise<string> {
  const promptPath = path.join(workflowPromptsDir, promptFile)
  const content = await fs.readFile(promptPath, "utf8")
  return stripFrontmatter(content)
}

function formatSkillInvocationArguments(args: string | undefined): string {
  const trimmed = String(args || "").trim()
  if (!trimmed) return ""
  if (!trimmed.includes("\n")) return `User: ${trimmed}`
  return ["User:", "```text", trimmed, "```"].join("\n")
}

function buildSkillDispatchPrompt(spec: CommandSpec, skillName: string, args: string | undefined): string {
  const skillPath = path.join(skillsDir, skillName, "SKILL.md")
  const formattedArgs = formatSkillInvocationArguments(args)
  return [
    `## Pi-native Compound Engineering command: /${spec.command}`,
    "",
    `This command maps to the Compound Engineering skill \`${skillName}\`.`,
    `Use the read tool to load this exact skill file and follow it: \`${skillPath}\`.`,
    "Resolve any relative paths in that skill against the skill directory.",
    formattedArgs,
  ].filter(Boolean).join("\n")
}

async function buildCommandPrompt(spec: CommandSpec, args: string | undefined): Promise<string> {
  if (spec.source.kind === "prompt") {
    return renderPromptTemplate(await loadPromptBody(spec.source.promptFile), args)
  }

  return buildSkillDispatchPrompt(spec, spec.source.skillName, args)
}

function extractPotentialMarkdownPath(args: string | undefined): string | null {
  const trimmed = String(args || "").trim()
  if (!trimmed) return null

  const quoted = trimmed.match(/^("|')(.+)\1$/)
  if (quoted && quoted[2].trim().endsWith(".md")) {
    return quoted[2].trim()
  }

  if (trimmed.endsWith(".md")) return trimmed
  return null
}

async function getCurrentBranch(pi: ExtensionAPI): Promise<string | undefined> {
  const { stdout, code } = await pi.exec("git", ["branch", "--show-current"])
  if (code !== 0) return undefined
  const branch = stdout.trim()
  return branch || undefined
}

function normalizeProjectPath(value: string | undefined): string | undefined {
  return value?.trim() ? value.trim().replace(/\\/g, "/") : undefined
}

type TodoDerivedContext = {
  featureId?: string
  topic?: string
  planPath?: string
  brainstormPath?: string
  planKind?: string
  phaseId?: string
  parentPlanPath?: string
  branch?: string
  prNumber?: number
}

function pickSingle(values: Array<string | undefined>): string | undefined {
  const unique = [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))]
  return unique.length === 1 ? unique[0] : undefined
}

async function deriveResolveTodoContext(cwd: string, args: string | undefined): Promise<TodoDerivedContext | null> {
  const todosDir = path.join(cwd, "todos")
  const entries = await fs.readdir(todosDir, { withFileTypes: true }).catch(() => [])
  const filter = String(args || "").trim().toLowerCase()

  const readyTodos = [] as Array<Record<string, string>>
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md") || !entry.name.includes("-ready-")) continue
    if (filter && !entry.name.toLowerCase().includes(filter) && !entry.name.toLowerCase().startsWith(filter)) continue
    const filePath = path.join(todosDir, entry.name)
    const markdown = await fs.readFile(filePath, "utf8").catch(() => "")
    if (!markdown.trim()) continue
    const frontmatter = parseMarkdownFrontmatter(markdown)
    readyTodos.push(Object.fromEntries(
      Object.entries(frontmatter).filter(([, value]) => typeof value === "string") as Array<[string, string]>
    ))
  }

  if (readyTodos.length === 0) return null

  const distinct = (values: Array<string | undefined>) => [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))]
  const distinctPrs = distinct(readyTodos.map((todo) => todo.source_pr))
  const distinctBranches = distinct(readyTodos.map((todo) => todo.source_branch))
  const distinctPlans = distinct(readyTodos.map((todo) => todo.source_plan))
  const distinctFeatures = distinct(readyTodos.map((todo) => todo.source_feature_id))

  if (distinctPrs.length > 1 || distinctBranches.length > 1 || distinctPlans.length > 1 || distinctFeatures.length > 1) {
    return null
  }

  const prRaw = pickSingle(readyTodos.map((todo) => todo.source_pr))
  return {
    featureId: pickSingle(readyTodos.map((todo) => todo.source_feature_id)),
    topic: pickSingle(readyTodos.map((todo) => todo.source_topic)),
    planPath: normalizeProjectPath(pickSingle(readyTodos.map((todo) => todo.source_plan))),
    brainstormPath: normalizeProjectPath(pickSingle(readyTodos.map((todo) => todo.source_brainstorm))),
    planKind: pickSingle(readyTodos.map((todo) => todo.source_plan_kind)),
    phaseId: pickSingle(readyTodos.map((todo) => todo.source_phase_id)),
    parentPlanPath: normalizeProjectPath(pickSingle(readyTodos.map((todo) => todo.source_parent_plan))),
    branch: pickSingle(readyTodos.map((todo) => todo.source_branch)),
    prNumber: prRaw && /^\d+$/.test(prRaw) ? Number.parseInt(prRaw, 10) : undefined,
  }
}

async function buildWorkflowIntentPreamble(
  pi: ExtensionAPI,
  cwd: string,
  spec: CommandSpec,
  args: string | undefined,
): Promise<string> {
  const candidatePath = extractPotentialMarkdownPath(args)
  let seeded = candidatePath ? await seedCeWorkflowContextFromInputDocument(cwd, candidatePath) : null

  if (WORK_COMMANDS.has(spec.command) && seeded) {
    const branch = await getCurrentBranch(pi)
    if (branch) {
      seeded = await mergeCeWorkflowContext(cwd, { ...seeded, branch })
    }
    const lines = buildCeWorkflowContextSummary(seeded)
    if (lines.length > 0) {
      return [
        "## Pi-native workflow intent context",
        "",
        "Use this exact feature-intent context as the primary scope source for this execution:",
        ...lines,
        "",
        "The user explicitly invoked `/ce:work` for this plan. Treat that as approval to begin implementation; do not ask for generic permission to start.",
        "Only stop for user input when there is a real unresolved decision such as branch/worktree choice on the default branch or an open scope question still left in the plan.",
        "Treat the referenced plan as canonical implementation scope. Only consult the brainstorm when you need additional product intent, rejected alternatives, or explicit non-goals that the plan compressed.",
      ].join("\n")
    }
  }

  if (PLAN_COMMANDS.has(spec.command) && seeded) {
    const lines = buildCeWorkflowContextSummary(seeded)
    if (lines.length > 0) {
      return [
        "## Pi-native workflow provenance",
        "",
        "A source document was resolved before planning. Preserve and extend this provenance in the plan frontmatter.",
        ...lines,
      ].join("\n")
    }
  }

  if (TODO_RESOLVE_COMMANDS.has(spec.command)) {
    const todoContext = await deriveResolveTodoContext(cwd, args)
    if (!todoContext) return ""

    const lines = buildCeWorkflowContextSummary(todoContext)
    if (lines.length > 0) {
      return [
        "## Ready todo feature context",
        "",
        "Use the shared provenance stamped onto the ready CE todos as the source of truth for this resolution pass:",
        ...lines,
      ].join("\n")
    }

    return ""
  }

  return ""
}

function countSessionMessages(ctx: ExtensionCommandContext): number {
  return ctx.sessionManager.getEntries().filter((entry) => entry.type === "message").length
}

async function getFreshHandoffSource(
  cwd: string,
  spec: CommandSpec,
  args: string | undefined,
): Promise<string | null> {
  const trimmedArgs = String(args || "").trim()
  const candidatePath = extractPotentialMarkdownPath(args)
  if (candidatePath) return candidatePath
  if (trimmedArgs) return null

  const activeContext = await loadCeWorkflowContext(cwd)
  if (!activeContext) return null

  if (PLAN_COMMANDS.has(spec.command)) {
    return activeContext.brainstormPath || null
  }

  if (WORK_COMMANDS.has(spec.command)) {
    return activeContext.planPath || activeContext.sourceInputPath || null
  }

  return null
}

async function shouldUseFreshWorkflowHandoff(
  ctx: ExtensionCommandContext,
  spec: CommandSpec,
  args: string | undefined,
): Promise<boolean> {
  if (!ctx.hasUI) return false
  if (!(PLAN_COMMANDS.has(spec.command) || WORK_COMMANDS.has(spec.command))) return false
  if (countSessionMessages(ctx) === 0) return false

  const source = await getFreshHandoffSource(ctx.cwd, spec, args)
  return Boolean(source)
}

async function startFreshWorkflowHandoff(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  spec: CommandSpec,
  prompt: string,
): Promise<boolean> {
  let originId = ctx.sessionManager.getLeafId() ?? undefined
  if (!originId) {
    pi.appendEntry(WORKFLOW_HANDOFF_ANCHOR_TYPE, { createdAt: new Date().toISOString(), command: spec.command })
    originId = ctx.sessionManager.getLeafId() ?? undefined
  }
  if (!originId) {
    ctx.ui.notify("Failed to determine workflow handoff origin.", "error")
    return false
  }

  const firstUserMessage = ctx.sessionManager.getEntries().find(
    (entry) => entry.type === "message" && entry.message.role === "user",
  )

  if (firstUserMessage) {
    try {
      const result = await ctx.navigateTree(firstUserMessage.id, {
        summarize: false,
        label: spec.command,
      })
      if (result.cancelled) {
        ctx.ui.notify(`${spec.command} handoff cancelled`, "info")
        return false
      }
    } catch (error) {
      ctx.ui.notify(
        `Failed to start fresh ${spec.command} handoff: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      )
      return false
    }

    ctx.ui.setEditorText("")
  }

  pi.sendUserMessage(prompt)
  ctx.ui.notify(`Started ${spec.command} in fresh session context`, "info")
  return true
}

async function dispatchCommand(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  spec: CommandSpec,
  args: string | undefined,
): Promise<void> {
  if (spec.deprecatedMessage) {
    ctx.ui.notify(spec.deprecatedMessage, "info")
  }

  const promptBody = await buildCommandPrompt(spec, args)
  const intentPreamble = await buildWorkflowIntentPreamble(pi, ctx.cwd, spec, args)
  const prompt = intentPreamble ? `${intentPreamble}\n\n${promptBody}` : promptBody

  if (await shouldUseFreshWorkflowHandoff(ctx, spec, args)) {
    await startFreshWorkflowHandoff(pi, ctx, spec, prompt)
    return
  }

  if (ctx.isIdle()) {
    pi.sendUserMessage(prompt)
  } else {
    pi.sendUserMessage(prompt, { deliverAs: "followUp" })
    ctx.ui.notify(`Queued ${spec.command}`, "info")
  }
}

export default function workflowCommands(pi: ExtensionAPI) {
  for (const spec of COMMAND_SPECS) {
    pi.registerCommand(spec.command, {
      description: spec.description,
      handler: async (args: string | undefined, ctx: ExtensionCommandContext) => {
        await dispatchCommand(pi, ctx, spec, args)
      },
    })
  }
}
