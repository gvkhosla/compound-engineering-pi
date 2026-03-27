import path from "node:path";
import { promises as fs } from "node:fs";
import { loadCeWorkflowContext, parseMarkdownFrontmatter, type CeWorkflowContext } from "./workflow-context.ts";

export type CeTodoStatus = "pending" | "ready" | "complete" | "wont_fix";
export type CeTodoPriority = "p1" | "p2" | "p3";

export type CeTodoRecord = {
  filePath: string;
  relativePath: string;
  issueId: string;
  status: CeTodoStatus;
  priority: CeTodoPriority;
  title: string;
  frontmatter: Record<string, string | string[]>;
  body: string;
};

export type CeTodoCreateInput = {
  title: string;
  priority: CeTodoPriority;
  tags?: string[];
  dependencies?: string[];
  problemStatement: string;
  findings: string[];
  proposedSolutions?: string[];
  recommendedAction?: string;
  technicalDetails?: string[];
  resources?: string[];
  acceptanceCriteria?: string[];
  notes?: string[];
  workLogTitle?: string;
  workLogActions?: string[];
  workLogLearnings?: string[];
  actor?: string;
  dedupe?: boolean;
};

export type CeTodoUpdateInput = {
  title?: string;
  priority?: CeTodoPriority;
  tags?: string[];
  dependencies?: string[];
  problemStatement?: string;
  findings?: string[];
  proposedSolutions?: string[];
  recommendedAction?: string;
  technicalDetails?: string[];
  resources?: string[];
  acceptanceCriteria?: string[];
  notes?: string[];
};

const TODO_DIR = "todos";
const SECTION_ORDER = [
  "Problem Statement",
  "Findings",
  "Proposed Solutions",
  "Recommended Action",
  "Technical Details",
  "Resources",
  "Acceptance Criteria",
  "Work Log",
  "Notes",
] as const;

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function ensureArray(value: string[] | undefined): string[] {
  return Array.isArray(value) ? value.filter((item) => item.trim()).map((item) => item.trim()) : [];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "todo";
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function toYamlValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
  }
  return value;
}

function serializeFrontmatter(frontmatter: Record<string, string | string[]>): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    lines.push(`${key}: ${toYamlValue(value)}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

function stripFrontmatter(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return normalized.trim();
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) return normalized.trim();
  return normalized.slice(end + 5).trim();
}

function parseBodySections(markdownBody: string): { title: string; sections: Map<string, string> } {
  const normalized = markdownBody.replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");
  let title = "Untitled todo";
  const sections = new Map<string, string>();
  let currentSection: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentSection) return;
    sections.set(currentSection, currentLines.join("\n").trim());
    currentLines = [];
  };

  for (const line of lines) {
    if (!title && line.startsWith("# ")) {
      title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      continue;
    }
    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      flush();
      currentSection = sectionMatch[1].trim();
      continue;
    }
    if (currentSection) currentLines.push(line);
  }

  flush();
  return { title, sections };
}

function renderBulletList(items: string[]): string {
  return items.map((item) => (item.startsWith("- ") ? item : `- ${item}`)).join("\n");
}

function renderChecklist(items: string[]): string {
  return items.map((item) => (item.startsWith("- [" ) ? item : `- [ ] ${item}`)).join("\n");
}

function renderSections(title: string, data: CeTodoCreateInput | (CeTodoUpdateInput & { workLog?: string }), existingWorkLog?: string): string {
  const findings = "findings" in data ? ensureArray(data.findings) : [];
  const proposedSolutions = "proposedSolutions" in data ? ensureArray(data.proposedSolutions) : [];
  const technicalDetails = "technicalDetails" in data ? ensureArray(data.technicalDetails) : [];
  const resources = "resources" in data ? ensureArray(data.resources) : [];
  const acceptanceCriteria = "acceptanceCriteria" in data ? ensureArray(data.acceptanceCriteria) : [];
  const notes = "notes" in data ? ensureArray(data.notes) : [];
  const sections = new Map<string, string>();

  if ("problemStatement" in data && typeof data.problemStatement === "string") {
    sections.set("Problem Statement", data.problemStatement.trim());
  }
  if (findings.length > 0) sections.set("Findings", renderBulletList(findings));
  if (proposedSolutions.length > 0) sections.set("Proposed Solutions", proposedSolutions.join("\n\n"));
  if ("recommendedAction" in data && typeof data.recommendedAction === "string") {
    sections.set("Recommended Action", data.recommendedAction.trim());
  }
  if (technicalDetails.length > 0) sections.set("Technical Details", renderBulletList(technicalDetails));
  if (resources.length > 0) sections.set("Resources", renderBulletList(resources));
  if (acceptanceCriteria.length > 0) sections.set("Acceptance Criteria", renderChecklist(acceptanceCriteria));
  const workLog = "workLog" in data && typeof data.workLog === "string"
    ? data.workLog.trim()
    : (existingWorkLog ?? "").trim();
  if (workLog) sections.set("Work Log", workLog);
  if (notes.length > 0) sections.set("Notes", renderBulletList(notes));

  const lines = [`# ${title}`, ""];
  for (const section of SECTION_ORDER) {
    const value = sections.get(section);
    if (!value) continue;
    lines.push(`## ${section}`, "", value, "");
  }
  return lines.join("\n").trim() + "\n";
}

function buildWorkLogEntry(args: {
  title?: string;
  actor?: string;
  actions?: string[];
  learnings?: string[];
}): string {
  const date = new Date().toISOString().slice(0, 10);
  const heading = args.title?.trim() || "Update";
  const actions = ensureArray(args.actions);
  const learnings = ensureArray(args.learnings);
  const actor = args.actor?.trim() || "Pi Compound Engineering";

  const lines = [`### ${date} - ${heading}`, "", `**By:** ${actor}`, ""];
  if (actions.length > 0) {
    lines.push("**Actions:**", ...actions.map((item) => `- ${item}`), "");
  }
  if (learnings.length > 0) {
    lines.push("**Learnings:**", ...learnings.map((item) => `- ${item}`), "");
  }
  return lines.join("\n").trim();
}

function appendWorkLog(existingBody: string, entry: string): string {
  const { title, sections } = parseBodySections(existingBody);
  const existing = sections.get("Work Log")?.trim();
  const next = existing ? `${existing}\n\n---\n\n${entry}` : entry;
  sections.set("Work Log", next);

  const data: CeTodoUpdateInput & { workLog: string } = {
    problemStatement: sections.get("Problem Statement"),
    findings: sections.get("Findings") ? sections.get("Findings")!.split("\n") : undefined,
    proposedSolutions: sections.get("Proposed Solutions") ? [sections.get("Proposed Solutions")!] : undefined,
    recommendedAction: sections.get("Recommended Action"),
    technicalDetails: sections.get("Technical Details") ? sections.get("Technical Details")!.split("\n") : undefined,
    resources: sections.get("Resources") ? sections.get("Resources")!.split("\n") : undefined,
    acceptanceCriteria: sections.get("Acceptance Criteria") ? sections.get("Acceptance Criteria")!.split("\n") : undefined,
    notes: sections.get("Notes") ? sections.get("Notes")!.split("\n") : undefined,
    workLog: next,
  };

  return renderSections(title, data, next);
}

function issueIdFromFileName(fileName: string): string {
  const match = fileName.match(/^(\d{3})-/);
  return match?.[1] ?? "000";
}

function statusFromFileName(fileName: string): CeTodoStatus {
  const match = fileName.match(/^\d{3}-(pending|ready|complete|wont_fix)-/);
  return (match?.[1] as CeTodoStatus) ?? "pending";
}

function priorityFromFileName(fileName: string): CeTodoPriority {
  const match = fileName.match(/^\d{3}-(?:pending|ready|complete|wont_fix)-(p[123])-/);
  return (match?.[1] as CeTodoPriority) ?? "p2";
}

async function ensureTodoDir(cwd: string): Promise<string> {
  const dir = path.join(cwd, TODO_DIR);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function listCeTodos(cwd: string): Promise<CeTodoRecord[]> {
  const dir = await ensureTodoDir(cwd);
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const records: CeTodoRecord[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const filePath = path.join(dir, entry.name);
    const markdown = await fs.readFile(filePath, "utf8").catch(() => "");
    if (!markdown.trim()) continue;
    const frontmatter = parseMarkdownFrontmatter(markdown);
    const body = stripFrontmatter(markdown);
    const parsed = parseBodySections(body);
    records.push({
      filePath,
      relativePath: normalizeSlashes(path.relative(cwd, filePath)),
      issueId: issueIdFromFileName(entry.name),
      status: (typeof frontmatter.status === "string" ? frontmatter.status : statusFromFileName(entry.name)) as CeTodoStatus,
      priority: (typeof frontmatter.priority === "string" ? frontmatter.priority : priorityFromFileName(entry.name)) as CeTodoPriority,
      title: parsed.title,
      frontmatter,
      body,
    });
  }

  return records.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function getCeTodo(cwd: string, idOrPath: string): Promise<CeTodoRecord | null> {
  const todos = await listCeTodos(cwd);
  const normalized = normalizeSlashes(idOrPath.trim());
  return todos.find((todo) =>
    todo.issueId === normalized ||
    todo.relativePath === normalized ||
    path.basename(todo.relativePath) === normalized ||
    todo.relativePath.startsWith(`todos/${normalized}`)
  ) ?? null;
}

function buildProvenanceFrontmatter(context: CeWorkflowContext | null): Record<string, string> {
  if (!context) return {};
  const result: Record<string, string> = {};
  if (context.featureId) result.source_feature_id = context.featureId;
  if (context.topic) result.source_topic = context.topic;
  if (context.planPath) result.source_plan = context.planPath;
  if (context.brainstormPath) result.source_brainstorm = context.brainstormPath;
  if (context.planKind) result.source_plan_kind = context.planKind;
  if (context.phaseId) result.source_phase_id = context.phaseId;
  if (context.parentPlanPath) result.source_parent_plan = context.parentPlanPath;
  if (context.branch) result.source_branch = context.branch;
  if (typeof context.prNumber === "number") result.source_pr = String(context.prNumber);
  return result;
}

export async function createCeTodo(cwd: string, input: CeTodoCreateInput): Promise<{ todo: CeTodoRecord; created: boolean; duplicateOf?: string }> {
  const todos = await listCeTodos(cwd);
  const normalizedTitle = normalizeKey(input.title);
  const existing = input.dedupe !== false
    ? todos.find((todo) => todo.status !== "complete" && todo.status !== "wont_fix" && normalizeKey(todo.title) === normalizedTitle)
    : undefined;
  if (existing) {
    return { todo: existing, created: false, duplicateOf: existing.relativePath };
  }

  const dir = await ensureTodoDir(cwd);
  const nextId = String(
    todos.reduce((max, todo) => Math.max(max, Number.parseInt(todo.issueId, 10) || 0), 0) + 1,
  ).padStart(3, "0");
  const fileName = `${nextId}-pending-${input.priority}-${slugify(input.title)}.md`;
  const filePath = path.join(dir, fileName);
  const context = await loadCeWorkflowContext(cwd);
  const frontmatter: Record<string, string | string[]> = {
    status: "pending",
    priority: input.priority,
    issue_id: nextId,
    tags: Array.from(new Set(["code-review", "compound-engineering", ...ensureArray(input.tags)])),
    dependencies: ensureArray(input.dependencies),
    ...buildProvenanceFrontmatter(context),
  };

  const workLog = buildWorkLogEntry({
    title: input.workLogTitle ?? "Created from review",
    actor: input.actor,
    actions: input.workLogActions ?? ["Created pending todo from Compound Engineering review finding"],
    learnings: input.workLogLearnings,
  });

  const body = renderSections(input.title.trim(), { ...input, workLog }, workLog);
  const markdown = serializeFrontmatter(frontmatter) + body;
  await fs.writeFile(filePath, markdown, "utf8");
  const todo = await getCeTodo(cwd, normalizeSlashes(path.relative(cwd, filePath)));
  if (!todo) throw new Error("Failed to read created CE todo");
  return { todo, created: true };
}

export async function updateCeTodo(cwd: string, idOrPath: string, patch: CeTodoUpdateInput): Promise<CeTodoRecord> {
  const existing = await getCeTodo(cwd, idOrPath);
  if (!existing) throw new Error(`CE todo not found: ${idOrPath}`);

  const nextTitle = patch.title?.trim() || existing.title;
  const nextPriority = patch.priority || existing.priority;
  const nextTags = patch.tags ? ensureArray(patch.tags) : ensureArray(existing.frontmatter.tags as string[] | undefined);
  const nextDependencies = patch.dependencies ? ensureArray(patch.dependencies) : ensureArray(existing.frontmatter.dependencies as string[] | undefined);

  const sections = parseBodySections(existing.body).sections;
  const body = renderSections(nextTitle, {
    problemStatement: patch.problemStatement ?? sections.get("Problem Statement") ?? "",
    findings: patch.findings ?? (sections.get("Findings") ? sections.get("Findings")!.split("\n") : []),
    proposedSolutions: patch.proposedSolutions ?? (sections.get("Proposed Solutions") ? [sections.get("Proposed Solutions")!] : []),
    recommendedAction: patch.recommendedAction ?? sections.get("Recommended Action") ?? "",
    technicalDetails: patch.technicalDetails ?? (sections.get("Technical Details") ? sections.get("Technical Details")!.split("\n") : []),
    resources: patch.resources ?? (sections.get("Resources") ? sections.get("Resources")!.split("\n") : []),
    acceptanceCriteria: patch.acceptanceCriteria ?? (sections.get("Acceptance Criteria") ? sections.get("Acceptance Criteria")!.split("\n") : []),
    notes: patch.notes ?? (sections.get("Notes") ? sections.get("Notes")!.split("\n") : []),
    workLog: sections.get("Work Log") ?? "",
  }, sections.get("Work Log"));

  const frontmatter = {
    ...existing.frontmatter,
    status: existing.status,
    priority: nextPriority,
    issue_id: existing.issueId,
    tags: nextTags,
    dependencies: nextDependencies,
  };

  const nextFileName = `${existing.issueId}-${existing.status}-${nextPriority}-${slugify(nextTitle)}.md`;
  const nextFilePath = path.join(path.dirname(existing.filePath), nextFileName);
  await fs.writeFile(nextFilePath, serializeFrontmatter(frontmatter) + body, "utf8");
  if (nextFilePath !== existing.filePath) {
    await fs.unlink(existing.filePath).catch(() => undefined);
  }
  const todo = await getCeTodo(cwd, normalizeSlashes(path.relative(cwd, nextFilePath)));
  if (!todo) throw new Error("Failed to read updated CE todo");
  return todo;
}

export async function setCeTodoStatus(cwd: string, idOrPath: string, status: CeTodoStatus, options?: {
  recommendedAction?: string;
  actor?: string;
  reason?: string;
  workLogTitle?: string;
}): Promise<CeTodoRecord> {
  const existing = await getCeTodo(cwd, idOrPath);
  if (!existing) throw new Error(`CE todo not found: ${idOrPath}`);

  const parsed = parseBodySections(existing.body);
  let body = existing.body;
  if (options?.reason || options?.workLogTitle || options?.actor) {
    const entry = buildWorkLogEntry({
      title: options.workLogTitle ?? `Marked ${status}`,
      actor: options.actor,
      actions: options.reason ? [options.reason] : [`Changed status to ${status}`],
      learnings: [],
    });
    body = appendWorkLog(existing.body, entry);
  }
  if (options?.recommendedAction) {
    const sections = parseBodySections(body).sections;
    body = renderSections(parsed.title, {
      problemStatement: sections.get("Problem Statement") ?? "",
      findings: sections.get("Findings") ? sections.get("Findings")!.split("\n") : [],
      proposedSolutions: sections.get("Proposed Solutions") ? [sections.get("Proposed Solutions")!] : [],
      recommendedAction: options.recommendedAction,
      technicalDetails: sections.get("Technical Details") ? sections.get("Technical Details")!.split("\n") : [],
      resources: sections.get("Resources") ? sections.get("Resources")!.split("\n") : [],
      acceptanceCriteria: sections.get("Acceptance Criteria") ? sections.get("Acceptance Criteria")!.split("\n") : [],
      notes: sections.get("Notes") ? sections.get("Notes")!.split("\n") : [],
      workLog: sections.get("Work Log") ?? "",
    }, sections.get("Work Log"));
  }

  const frontmatter = { ...existing.frontmatter, status };
  const nextFileName = `${existing.issueId}-${status}-${existing.priority}-${slugify(existing.title)}.md`;
  const nextFilePath = path.join(path.dirname(existing.filePath), nextFileName);
  await fs.writeFile(nextFilePath, serializeFrontmatter(frontmatter) + body, "utf8");
  if (nextFilePath !== existing.filePath) {
    await fs.unlink(existing.filePath).catch(() => undefined);
  }
  const todo = await getCeTodo(cwd, normalizeSlashes(path.relative(cwd, nextFilePath)));
  if (!todo) throw new Error("Failed to read status-updated CE todo");
  return todo;
}

export async function appendCeTodoWorkLog(cwd: string, idOrPath: string, args: {
  title?: string;
  actor?: string;
  actions?: string[];
  learnings?: string[];
}): Promise<CeTodoRecord> {
  const existing = await getCeTodo(cwd, idOrPath);
  if (!existing) throw new Error(`CE todo not found: ${idOrPath}`);
  const body = appendWorkLog(existing.body, buildWorkLogEntry(args));
  await fs.writeFile(existing.filePath, serializeFrontmatter(existing.frontmatter) + body, "utf8");
  const todo = await getCeTodo(cwd, existing.relativePath);
  if (!todo) throw new Error("Failed to read work-log-updated CE todo");
  return todo;
}

export async function deleteCeTodo(cwd: string, idOrPath: string): Promise<void> {
  const existing = await getCeTodo(cwd, idOrPath);
  if (!existing) throw new Error(`CE todo not found: ${idOrPath}`);
  await fs.unlink(existing.filePath);
}

export function serializeCeTodoList(todos: CeTodoRecord[]): string {
  if (todos.length === 0) return "No Compound Engineering todos found under todos/.";
  return todos
    .map((todo) => `- ${todo.issueId} ${todo.status} ${todo.priority} ${todo.relativePath} — ${todo.title}`)
    .join("\n");
}

export function serializeCeTodo(todo: CeTodoRecord): string {
  return `${todo.relativePath}\n\n${serializeFrontmatter(todo.frontmatter)}${todo.body}`.trim();
}
