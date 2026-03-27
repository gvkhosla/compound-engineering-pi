import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  appendCeTodoWorkLog,
  createCeTodo,
  deleteCeTodo,
  getCeTodo,
  listCeTodos,
  serializeCeTodo,
  serializeCeTodoList,
  setCeTodoStatus,
  updateCeTodo,
  type CeTodoPriority,
  type CeTodoStatus,
} from "../src/ce-todos.ts";

const StatusEnum = Type.Union([
  Type.Literal("pending"),
  Type.Literal("ready"),
  Type.Literal("complete"),
  Type.Literal("wont_fix"),
]);

const PriorityEnum = Type.String({
  description: "Todo priority. Accepts p1/p2/p3 as well as aliases like P1, high, medium, or low.",
});

function normalizePriority(value: string | undefined): CeTodoPriority | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "p0" || normalized === "p1" || normalized === "critical" || normalized === "high") return "p1";
  if (normalized === "p2" || normalized === "medium") return "p2";
  if (normalized === "p3" || normalized === "low") return "p3";
  return undefined;
}

export default function ceTodosExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "ce_todo",
    label: "CE Todo",
    description:
      "Manage Compound Engineering markdown todos under todos/ directly. Use this during /workflows-review and /review-skeptical instead of relying on final prose parsing. Supports list, get, create, update, set_status, append_work_log, and delete.",
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal("list"),
        Type.Literal("get"),
        Type.Literal("create"),
        Type.Literal("update"),
        Type.Literal("set_status"),
        Type.Literal("append_work_log"),
        Type.Literal("delete"),
      ]),
      id: Type.Optional(Type.String({ description: "Todo issue id (e.g. 001) or file path under todos/. Required for get/update/set_status/append_work_log/delete." })),
      statuses: Type.Optional(Type.Array(StatusEnum, { description: "Optional status filter for list." })),
      priority: Type.Optional(PriorityEnum),
      title: Type.Optional(Type.String()),
      tags: Type.Optional(Type.Array(Type.String())),
      dependencies: Type.Optional(Type.Array(Type.String())),
      problemStatement: Type.Optional(Type.String()),
      findings: Type.Optional(Type.Array(Type.String())),
      proposedSolutions: Type.Optional(Type.Array(Type.String())),
      recommendedAction: Type.Optional(Type.String()),
      technicalDetails: Type.Optional(Type.Array(Type.String())),
      resources: Type.Optional(Type.Array(Type.String())),
      acceptanceCriteria: Type.Optional(Type.Array(Type.String())),
      notes: Type.Optional(Type.Array(Type.String())),
      workLogTitle: Type.Optional(Type.String()),
      workLogActions: Type.Optional(Type.Array(Type.String())),
      workLogLearnings: Type.Optional(Type.Array(Type.String())),
      actor: Type.Optional(Type.String()),
      status: Type.Optional(StatusEnum),
      reason: Type.Optional(Type.String()),
      dedupe: Type.Optional(Type.Boolean()),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        switch (params.action) {
          case "list": {
            const todos = await listCeTodos(ctx.cwd);
            const filtered = params.statuses?.length
              ? todos.filter((todo) => params.statuses?.includes(todo.status))
              : todos;
            return {
              content: [{ type: "text", text: serializeCeTodoList(filtered) }],
              details: { action: "list", todos: filtered.map((todo) => ({
                id: todo.issueId,
                status: todo.status,
                priority: todo.priority,
                title: todo.title,
                path: todo.relativePath,
              })) },
            };
          }

          case "get": {
            if (!params.id) throw new Error("id is required for get");
            const todo = await getCeTodo(ctx.cwd, params.id);
            if (!todo) throw new Error(`CE todo not found: ${params.id}`);
            return {
              content: [{ type: "text", text: serializeCeTodo(todo) }],
              details: { action: "get", todo },
            };
          }

          case "create": {
            if (!params.title) throw new Error("title is required for create");
            const normalizedPriority = normalizePriority(params.priority);
            if (!normalizedPriority) throw new Error("priority is required for create (use p1/p2/p3 or high/medium/low)");
            if (!params.problemStatement) throw new Error("problemStatement is required for create");
            const result = await createCeTodo(ctx.cwd, {
              title: params.title,
              priority: normalizedPriority,
              tags: params.tags,
              dependencies: params.dependencies,
              problemStatement: params.problemStatement,
              findings: params.findings ?? [],
              proposedSolutions: params.proposedSolutions,
              recommendedAction: params.recommendedAction,
              technicalDetails: params.technicalDetails,
              resources: params.resources,
              acceptanceCriteria: params.acceptanceCriteria,
              notes: params.notes,
              workLogTitle: params.workLogTitle,
              workLogActions: params.workLogActions,
              workLogLearnings: params.workLogLearnings,
              actor: params.actor,
              dedupe: params.dedupe,
            });
            const message = result.created
              ? `Created ${result.todo.relativePath}`
              : `Matched existing todo ${result.todo.relativePath}`;
            return {
              content: [{ type: "text", text: message }],
              details: { action: "create", created: result.created, duplicateOf: result.duplicateOf, todo: result.todo },
            };
          }

          case "update": {
            if (!params.id) throw new Error("id is required for update");
            const normalizedPriority = normalizePriority(params.priority);
            if (params.priority && !normalizedPriority) {
              throw new Error("invalid priority for update (use p1/p2/p3 or high/medium/low)");
            }
            const todo = await updateCeTodo(ctx.cwd, params.id, {
              title: params.title,
              priority: normalizedPriority,
              tags: params.tags,
              dependencies: params.dependencies,
              problemStatement: params.problemStatement,
              findings: params.findings,
              proposedSolutions: params.proposedSolutions,
              recommendedAction: params.recommendedAction,
              technicalDetails: params.technicalDetails,
              resources: params.resources,
              acceptanceCriteria: params.acceptanceCriteria,
              notes: params.notes,
            });
            return {
              content: [{ type: "text", text: `Updated ${todo.relativePath}` }],
              details: { action: "update", todo },
            };
          }

          case "set_status": {
            if (!params.id) throw new Error("id is required for set_status");
            if (!params.status) throw new Error("status is required for set_status");
            const todo = await setCeTodoStatus(ctx.cwd, params.id, params.status as CeTodoStatus, {
              recommendedAction: params.recommendedAction,
              actor: params.actor,
              reason: params.reason,
              workLogTitle: params.workLogTitle,
            });
            return {
              content: [{ type: "text", text: `Updated status: ${todo.relativePath}` }],
              details: { action: "set_status", todo },
            };
          }

          case "append_work_log": {
            if (!params.id) throw new Error("id is required for append_work_log");
            const todo = await appendCeTodoWorkLog(ctx.cwd, params.id, {
              title: params.workLogTitle,
              actor: params.actor,
              actions: params.workLogActions,
              learnings: params.workLogLearnings,
            });
            return {
              content: [{ type: "text", text: `Appended work log: ${todo.relativePath}` }],
              details: { action: "append_work_log", todo },
            };
          }

          case "delete": {
            if (!params.id) throw new Error("id is required for delete");
            await deleteCeTodo(ctx.cwd, params.id);
            return {
              content: [{ type: "text", text: `Deleted ${params.id}` }],
              details: { action: "delete", id: params.id },
            };
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `CE todo error: ${message}` }],
          details: { error: message, action: params.action },
        };
      }
    },
  });
}
