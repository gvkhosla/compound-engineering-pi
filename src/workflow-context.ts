import path from "node:path";
import { promises as fs } from "node:fs";

export const CE_CONTEXT_RELATIVE_PATH = ".pi/compound-engineering/context.json";

export type CePlanKind = "single" | "master" | "phase" | "unknown";

export type CeWorkflowContext = {
  version: 1;
  updatedAt: string;
  featureId?: string;
  topic?: string;
  brainstormPath?: string;
  planPath?: string;
  planOriginPath?: string;
  planKind?: CePlanKind;
  phaseId?: string;
  parentPlanPath?: string;
  sourceInputPath?: string;
  branch?: string;
  prNumber?: number;
};

type FrontmatterValue = string | string[];
type FrontmatterRecord = Record<string, FrontmatterValue>;

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "").trim();
}

function extractFrontmatterBlock(markdown: string): string | null {
  const normalized = markdown.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return null;
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) return null;
  return normalized.slice(4, end);
}

export function parseMarkdownFrontmatter(markdown: string): FrontmatterRecord {
  const block = extractFrontmatterBlock(markdown);
  if (!block) return {};

  const frontmatter: FrontmatterRecord = {};
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    const value = match[2].trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1).trim();
      frontmatter[key] = inner
        ? inner.split(",").map((part) => stripQuotes(part.trim())).filter(Boolean)
        : [];
      continue;
    }

    frontmatter[key] = stripQuotes(value);
  }

  return frontmatter;
}

async function readUtf8(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function getString(value: FrontmatterValue | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asRelativeProjectPath(cwd: string, filePath: string): string {
  return normalizeSlashes(path.relative(cwd, filePath));
}

export function resolveProjectPath(cwd: string, candidate: string): string {
  return path.isAbsolute(candidate) ? candidate : path.resolve(cwd, candidate);
}

function normalizeFrontmatterPath(cwd: string, candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;
  return asRelativeProjectPath(cwd, resolveProjectPath(cwd, candidate));
}

function deriveFeatureIdFromPath(relativePath: string): string {
  const base = normalizeSlashes(relativePath).split("/").pop() ?? relativePath;
  return base
    .replace(/\.md$/i, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/, "")
    .replace(/-(brainstorm|plan)$/i, "")
    .replace(/-(master|phase-[a-z0-9-]+)$/i, "")
    .trim();
}

function inferPlanKind(relativePath: string, frontmatter: FrontmatterRecord): CePlanKind {
  const explicit = getString(frontmatter.plan_kind)?.toLowerCase();
  if (explicit === "single" || explicit === "master" || explicit === "phase") {
    return explicit;
  }

  const phaseId = getString(frontmatter.phase_id);
  const parentPlan = getString(frontmatter.parent_plan);
  const normalized = normalizeSlashes(relativePath);
  if (phaseId || parentPlan || /-phase-[a-z0-9-]+-plan\.md$/i.test(normalized)) return "phase";
  if (/-master-plan\.md$/i.test(normalized)) return "master";
  return "single";
}

export async function loadCeWorkflowContext(cwd: string): Promise<CeWorkflowContext | null> {
  const content = await readUtf8(path.join(cwd, CE_CONTEXT_RELATIVE_PATH));
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as Partial<CeWorkflowContext>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      version: 1,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      featureId: parsed.featureId,
      topic: parsed.topic,
      brainstormPath: parsed.brainstormPath,
      planPath: parsed.planPath,
      planOriginPath: parsed.planOriginPath,
      planKind: parsed.planKind,
      phaseId: parsed.phaseId,
      parentPlanPath: parsed.parentPlanPath,
      sourceInputPath: parsed.sourceInputPath,
      branch: parsed.branch,
      prNumber: typeof parsed.prNumber === "number" ? parsed.prNumber : undefined,
    };
  } catch {
    return null;
  }
}

export async function saveCeWorkflowContext(cwd: string, context: CeWorkflowContext): Promise<void> {
  const filePath = path.join(cwd, CE_CONTEXT_RELATIVE_PATH);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(context, null, 2) + "\n", "utf8");
}

export async function mergeCeWorkflowContext(
  cwd: string,
  patch: Partial<CeWorkflowContext>,
): Promise<CeWorkflowContext> {
  const current = (await loadCeWorkflowContext(cwd)) ?? { version: 1, updatedAt: new Date().toISOString() };
  const next: CeWorkflowContext = {
    ...current,
    ...patch,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  await saveCeWorkflowContext(cwd, next);
  return next;
}

export async function deriveContextFromBrainstormFile(
  cwd: string,
  filePath: string,
): Promise<Partial<CeWorkflowContext> | null> {
  const absolutePath = resolveProjectPath(cwd, filePath);
  const markdown = await readUtf8(absolutePath);
  if (!markdown) return null;

  const relativePath = asRelativeProjectPath(cwd, absolutePath);
  const frontmatter = parseMarkdownFrontmatter(markdown);
  const featureId = getString(frontmatter.feature_id) ?? deriveFeatureIdFromPath(relativePath);
  const topic = getString(frontmatter.topic) ?? featureId;

  return {
    featureId,
    topic,
    brainstormPath: relativePath,
  };
}

export async function deriveContextFromPlanFile(
  cwd: string,
  filePath: string,
): Promise<Partial<CeWorkflowContext> | null> {
  const absolutePath = resolveProjectPath(cwd, filePath);
  const markdown = await readUtf8(absolutePath);
  if (!markdown) return null;

  const relativePath = asRelativeProjectPath(cwd, absolutePath);
  const frontmatter = parseMarkdownFrontmatter(markdown);
  const originPath = normalizeFrontmatterPath(cwd, getString(frontmatter.origin));
  const parentPlanPath = normalizeFrontmatterPath(cwd, getString(frontmatter.parent_plan));
  const planKind = inferPlanKind(relativePath, frontmatter);
  const phaseId = getString(frontmatter.phase_id);

  let featureId = getString(frontmatter.feature_id) ?? deriveFeatureIdFromPath(relativePath);
  let topic = getString(frontmatter.topic) ?? featureId;
  let brainstormPath = originPath;

  if (originPath) {
    const originContext = await deriveContextFromBrainstormFile(cwd, originPath);
    featureId = originContext?.featureId ?? featureId;
    topic = originContext?.topic ?? topic;
    brainstormPath = originContext?.brainstormPath ?? brainstormPath;
  }

  return {
    featureId,
    topic,
    planPath: relativePath,
    planOriginPath: originPath,
    brainstormPath,
    planKind,
    phaseId,
    parentPlanPath,
  };
}

export async function deriveContextFromTodoFile(
  cwd: string,
  filePath: string,
): Promise<Partial<CeWorkflowContext> | null> {
  const absolutePath = resolveProjectPath(cwd, filePath);
  const markdown = await readUtf8(absolutePath);
  if (!markdown) return null;

  const frontmatter = parseMarkdownFrontmatter(markdown);
  const sourcePlan = normalizeFrontmatterPath(cwd, getString(frontmatter.source_plan));
  const sourceBrainstorm = normalizeFrontmatterPath(cwd, getString(frontmatter.source_brainstorm));
  const sourceParentPlan = normalizeFrontmatterPath(cwd, getString(frontmatter.source_parent_plan));
  const sourcePlanKind = getString(frontmatter.source_plan_kind) as CePlanKind | undefined;
  const featureId = getString(frontmatter.source_feature_id);
  const topic = getString(frontmatter.source_topic);
  const phaseId = getString(frontmatter.source_phase_id);
  const branch = getString(frontmatter.source_branch);
  const prRaw = getString(frontmatter.source_pr);
  const prNumber = prRaw && /^\d+$/.test(prRaw) ? Number.parseInt(prRaw, 10) : undefined;

  return {
    featureId,
    topic,
    brainstormPath: sourceBrainstorm,
    planPath: sourcePlan,
    planOriginPath: sourceBrainstorm,
    planKind: sourcePlanKind,
    phaseId,
    parentPlanPath: sourceParentPlan,
    branch,
    prNumber,
    sourceInputPath: asRelativeProjectPath(cwd, absolutePath),
  };
}

export async function seedCeWorkflowContextFromInputDocument(
  cwd: string,
  inputPath: string,
): Promise<CeWorkflowContext | null> {
  const absolutePath = resolveProjectPath(cwd, inputPath);
  if (!(await pathExists(absolutePath))) return null;

  const relativePath = asRelativeProjectPath(cwd, absolutePath);
  let patch: Partial<CeWorkflowContext> | null = null;

  if (/^docs\/plans\/.*\.md$/i.test(relativePath)) {
    patch = await deriveContextFromPlanFile(cwd, absolutePath);
  } else if (/^docs\/brainstorms\/.*\.md$/i.test(relativePath)) {
    patch = await deriveContextFromBrainstormFile(cwd, absolutePath);
  } else if (/^todos\/.*\.md$/i.test(relativePath)) {
    patch = await deriveContextFromTodoFile(cwd, absolutePath);
  }

  if (!patch) return null;
  return mergeCeWorkflowContext(cwd, { ...patch, sourceInputPath: relativePath });
}

export async function refreshCeWorkflowContextFromDocument(
  cwd: string,
  documentPath: string,
): Promise<CeWorkflowContext | null> {
  const absolutePath = resolveProjectPath(cwd, documentPath);
  if (!(await pathExists(absolutePath))) return null;

  const relativePath = asRelativeProjectPath(cwd, absolutePath);
  if (/^docs\/brainstorms\/.*\.md$/i.test(relativePath)) {
    const patch = await deriveContextFromBrainstormFile(cwd, absolutePath);
    return patch ? mergeCeWorkflowContext(cwd, patch) : null;
  }

  if (/^docs\/plans\/.*\.md$/i.test(relativePath)) {
    const patch = await deriveContextFromPlanFile(cwd, absolutePath);
    return patch ? mergeCeWorkflowContext(cwd, patch) : null;
  }

  return null;
}

export function buildCeWorkflowContextSummary(context: Partial<CeWorkflowContext> | null): string[] {
  if (!context) return [];

  const lines: string[] = [];
  if (context.featureId) lines.push(`- Feature ID: ${context.featureId}`);
  if (context.topic) lines.push(`- Topic: ${context.topic}`);
  if (context.planPath) lines.push(`- Plan: ${context.planPath}`);
  if (context.planKind) lines.push(`- Plan kind: ${context.planKind}`);
  if (context.phaseId) lines.push(`- Phase: ${context.phaseId}`);
  if (context.parentPlanPath) lines.push(`- Parent plan: ${context.parentPlanPath}`);
  if (context.brainstormPath) lines.push(`- Brainstorm: ${context.brainstormPath}`);
  if (context.branch) lines.push(`- Branch: ${context.branch}`);
  if (typeof context.prNumber === "number") lines.push(`- PR: #${context.prNumber}`);
  return lines;
}
