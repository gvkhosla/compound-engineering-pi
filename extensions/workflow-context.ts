import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import path from "node:path";
import {
  buildCeWorkflowContextSummary,
  loadCeWorkflowContext,
  refreshCeWorkflowContextFromDocument,
  seedCeWorkflowContextFromInputDocument,
} from "../src/workflow-context.ts";

function getToolResultPath(event: unknown): string | null {
  const payload = event as { input?: Record<string, unknown>; toolName?: string; isError?: boolean };
  if (payload.isError) return null;
  if (payload.toolName !== "write" && payload.toolName !== "edit") return null;

  const input = payload.input;
  const value = typeof input?.path === "string"
    ? input.path
    : typeof input?.file_path === "string"
      ? input.file_path
      : typeof input?.file === "string"
        ? input.file
        : null;

  return value;
}

async function showContext(ctx: ExtensionCommandContext, cwd: string) {
  const current = await loadCeWorkflowContext(cwd);
  if (!current) {
    ctx.ui.notify("No active Compound Engineering workflow context found.", "info");
    return;
  }

  const lines = buildCeWorkflowContextSummary(current);
  ctx.ui.notify(lines.length > 0 ? `Active CE context\n${lines.join("\n")}` : "Active CE context loaded.", "info");
}

export default function workflowContextExtension(pi: ExtensionAPI) {
  pi.on("tool_result", async (event, ctx) => {
    const candidatePath = getToolResultPath(event);
    if (!candidatePath) return;

    const absolutePath = path.resolve(ctx.cwd, candidatePath);
    const relativePath = path.relative(ctx.cwd, absolutePath).replace(/\\/g, "/");

    // Brainstorms are exploratory inputs, not active implementation context.
    // Do not let an unrelated brainstorm draft overwrite the current branch/plan review context.
    if (/^docs\/brainstorms\/.*\.md$/i.test(relativePath)) {
      return;
    }

    const updated = await refreshCeWorkflowContextFromDocument(ctx.cwd, absolutePath);
    if (!updated || !ctx.hasUI) return;

    const summary = buildCeWorkflowContextSummary(updated);
    if (summary.length > 0) {
      ctx.ui.notify(`Updated CE workflow context\n${summary.join("\n")}`, "info");
    }
  });

  pi.registerCommand("ce-context", {
    description: "Show or seed the active Compound Engineering workflow context",
    handler: async (args: string | undefined, ctx: ExtensionCommandContext) => {
      const trimmed = String(args ?? "").trim();
      if (trimmed) {
        const seeded = await seedCeWorkflowContextFromInputDocument(ctx.cwd, trimmed);
        if (seeded) {
          const lines = buildCeWorkflowContextSummary(seeded);
          ctx.ui.notify(`Seeded CE context from ${trimmed}\n${lines.join("\n")}`, "info");
          return;
        }

        ctx.ui.notify(`Could not derive CE context from ${trimmed}`, "warning");
        return;
      }

      await showContext(ctx, ctx.cwd);
    },
  });
}
