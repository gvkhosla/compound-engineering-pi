import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent"
import {
  buildCeWorkflowContextSummary,
  loadCeWorkflowContext,
  mergeCeWorkflowContext,
  seedCeWorkflowContextFromInputDocument,
} from "../src/workflow-context.ts"

type PromptCommandSpec = {
  command: string
  promptFile: string
  description: string
  deprecatedMessage?: string
}

const PROMPT_COMMAND_SPECS: PromptCommandSpec[] = [
  {
    command: "workflows-brainstorm",
    promptFile: "workflows-brainstorm.md",
    description: "Compound Engineering brainstorm workflow",
  },
  {
    command: "ce-brainstorm",
    promptFile: "workflows-brainstorm.md",
    description: "Alias for /workflows-brainstorm",
  },
  {
    command: "ce:brainstorm",
    promptFile: "workflows-brainstorm.md",
    description: "Alias for /workflows-brainstorm",
  },
  {
    command: "workflows:brainstorm",
    promptFile: "workflows-brainstorm.md",
    description: "Deprecated alias for /workflows-brainstorm",
    deprecatedMessage: "/workflows:brainstorm is deprecated; running canonical /workflows-brainstorm",
  },
  {
    command: "workflows-plan",
    promptFile: "workflows-plan.md",
    description: "Compound Engineering planning workflow",
  },
  {
    command: "ce-plan",
    promptFile: "workflows-plan.md",
    description: "Alias for /workflows-plan",
  },
  {
    command: "ce:plan",
    promptFile: "workflows-plan.md",
    description: "Alias for /workflows-plan",
  },
  {
    command: "workflows:plan",
    promptFile: "workflows-plan.md",
    description: "Deprecated alias for /workflows-plan",
    deprecatedMessage: "/workflows:plan is deprecated; running canonical /workflows-plan",
  },
  {
    command: "workflows-work",
    promptFile: "workflows-work.md",
    description: "Compound Engineering execution workflow",
  },
  {
    command: "ce-work",
    promptFile: "workflows-work.md",
    description: "Alias for /workflows-work",
  },
  {
    command: "ce:work",
    promptFile: "workflows-work.md",
    description: "Alias for /workflows-work",
  },
  {
    command: "workflows:work",
    promptFile: "workflows-work.md",
    description: "Deprecated alias for /workflows-work",
    deprecatedMessage: "/workflows:work is deprecated; running canonical /workflows-work",
  },
  {
    command: "workflows-compound",
    promptFile: "workflows-compound.md",
    description: "Compound Engineering compound knowledge workflow",
  },
  {
    command: "workflows:compound",
    promptFile: "workflows-compound.md",
    description: "Deprecated alias for /workflows-compound",
    deprecatedMessage: "/workflows:compound is deprecated; running canonical /workflows-compound",
  },
  {
    command: "deepen-plan",
    promptFile: "deepen-plan.md",
    description: "Deepen a plan with parallel specialist research",
  },
  {
    command: "test-browser",
    promptFile: "test-browser.md",
    description: "Run browser tests for changed pages",
  },
  {
    command: "feature-video",
    promptFile: "feature-video.md",
    description: "Record a feature walkthrough video",
  },
  {
    command: "resolve_todo_parallel",
    promptFile: "resolve_todo_parallel.md",
    description: "Resolve todos in parallel",
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
  const extensionDir = path.dirname(fileURLToPath(import.meta.url))
  const promptPath = path.join(extensionDir, "..", "workflow-prompts", promptFile)
  const content = await fs.readFile(promptPath, "utf8")
  return stripFrontmatter(content)
}

function extractPotentialMarkdownPath(args: string | undefined): string | null {
  const trimmed = String(args || "").trim()
  if (!trimmed) return null

  const quoted = trimmed.match(/^(["'])(.+)\1$/)
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

async function buildWorkflowIntentPreamble(
  pi: ExtensionAPI,
  cwd: string,
  spec: PromptCommandSpec,
  args: string | undefined,
): Promise<string> {
  const candidatePath = extractPotentialMarkdownPath(args)
  let seeded = candidatePath ? await seedCeWorkflowContextFromInputDocument(cwd, candidatePath) : null

  if ((spec.command === "workflows-work" || spec.command === "ce-work" || spec.command === "ce:work" || spec.command === "workflows:work") && seeded) {
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
        "Treat the referenced plan as canonical implementation scope. Only consult the brainstorm when you need additional product intent, rejected alternatives, or explicit non-goals that the plan compressed.",
      ].join("\n")
    }
  }

  if ((spec.command === "workflows-plan" || spec.command === "ce-plan" || spec.command === "ce:plan" || spec.command === "workflows:plan") && seeded) {
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

  const activeContext = await loadCeWorkflowContext(cwd)
  if (!activeContext) return ""

  if (spec.command === "resolve_todo_parallel") {
    const lines = buildCeWorkflowContextSummary(activeContext)
    if (lines.length > 0) {
      return [
        "## Active CE context",
        "",
        "Use this context when deciding whether a ready todo still matches the intended feature scope:",
        ...lines,
      ].join("\n")
    }
  }

  return ""
}

async function dispatchPromptCommand(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  spec: PromptCommandSpec,
  args: string | undefined,
): Promise<void> {
  if (spec.deprecatedMessage) {
    ctx.ui.notify(spec.deprecatedMessage, "info")
  }

  const promptBody = renderPromptTemplate(await loadPromptBody(spec.promptFile), args)
  const intentPreamble = await buildWorkflowIntentPreamble(pi, ctx.cwd, spec, args)
  const prompt = intentPreamble ? `${intentPreamble}\n\n${promptBody}` : promptBody

  if (ctx.isIdle()) {
    pi.sendUserMessage(prompt)
  } else {
    pi.sendUserMessage(prompt, { deliverAs: "followUp" })
    ctx.ui.notify(`Queued ${spec.command}`, "info")
  }
}

export default function workflowCommands(pi: ExtensionAPI) {
  for (const spec of PROMPT_COMMAND_SPECS) {
    pi.registerCommand(spec.command, {
      description: spec.description,
      handler: async (args: string | undefined, ctx: ExtensionCommandContext) => {
        await dispatchPromptCommand(pi, ctx, spec, args)
      },
    })
  }
}
