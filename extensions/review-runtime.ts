/**
 * Code Review Extension (inspired by Codex's review feature)
 *
 * Provides a `/review` command that prompts the agent to review code changes.
 * Supports multiple review modes:
 * - Review a GitHub pull request (checks out the PR locally)
 * - Review against a base branch (PR style)
 * - Review uncommitted changes
 * - Review a specific commit
 * - Custom review instructions
 *
 * Usage:
 * - `/review` - show interactive selector
 * - `/review pr 123` - review PR #123 (checks out locally)
 * - `/review pr https://github.com/owner/repo/pull/123` - review PR from URL
 * - `/review uncommitted` - review uncommitted changes directly
 * - `/review branch main` - review against main branch
 * - `/review commit abc123` - review specific commit
 * - `/review folder src docs` - review specific folders/files (snapshot, not diff)
 * - `/review custom "check for security issues"` - custom instructions
 *
 * Project-specific review guidelines:
 * - If a REVIEW_GUIDELINES.md file exists in the same directory as .pi,
 *   its contents are appended to the review prompt.
 *
 * Note: PR review requires a clean working tree (no uncommitted changes to tracked files).
 */

import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { DynamicBorder, BorderedLoader } from "@mariozechner/pi-coding-agent";
import {
	Container,
	fuzzyFilter,
	getEditorKeybindings,
	Input,
	type SelectItem,
	SelectList,
	Spacer,
	Text,
} from "@mariozechner/pi-tui";
import path from "node:path";
import { promises as fs } from "node:fs";
import { buildCeWorkflowContextSummary, loadCeWorkflowContext, mergeCeWorkflowContext } from "../src/workflow-context.ts";

// State to track fresh session review (where we branched from).
// Module-level state means only one review can be active at a time.
// This is intentional - the UI and /end-review command assume a single active review.
let reviewOriginId: string | undefined = undefined;
let endReviewInProgress = false;
let reviewLoopFixingEnabled = false;
let reviewLoopInProgress = false;
let pendingCeTodoReview:
	| {
		cwd: string;
		target: string;
		startedAt: number;
		sourceContext?: CeResolvedSourceContext;
	  }
	| undefined;

const REVIEW_STATE_TYPE = "review-session";
const REVIEW_ANCHOR_TYPE = "review-anchor";
const REVIEW_SETTINGS_TYPE = "review-settings";
const REVIEW_LOOP_MAX_ITERATIONS = 10;
const REVIEW_LOOP_START_TIMEOUT_MS = 15000;
const REVIEW_LOOP_START_POLL_MS = 50;
const CE_TODO_REVIEW_DIR = "todos";
const CE_TODO_REVIEW_TYPE = "ce-review-todos";
const MAX_EXISTING_TODO_FILES = 30;
const MAX_EXISTING_TODO_BYTES = 48 * 1024;

type ReviewSessionState = {
	active: boolean;
	originId?: string;
};

type ReviewSettingsState = {
	loopFixingEnabled?: boolean;
};

type CeReviewFinding = {
	priority: "p1" | "p2" | "p3";
	title: string;
	evidence: string;
	impact: string;
	fix: string;
};

type CeResolvedSourceContext = {
	source: "pr" | "manifest" | "none";
	featureId?: string;
	topic?: string;
	planPath?: string;
	brainstormPath?: string;
	planKind?: string;
	phaseId?: string;
	parentPlanPath?: string;
	branch?: string;
	prNumber?: number;
};

function setReviewWidget(ctx: ExtensionContext, active: boolean) {
	if (!ctx.hasUI) return;
	if (!active) {
		ctx.ui.setWidget("review", undefined);
		return;
	}

	ctx.ui.setWidget("review", (_tui, theme) => {
		const message = reviewLoopInProgress
			? "Review session active (loop fixing running)"
			: reviewLoopFixingEnabled
				? "Review session active (loop fixing enabled), return with /end-review"
				: "Review session active, return with /end-review";
		const text = new Text(theme.fg("warning", message), 0, 0);
		return {
			render(width: number) {
				return text.render(width);
			},
			invalidate() {
				text.invalidate();
			},
		};
	});
}

function getReviewState(ctx: ExtensionContext): ReviewSessionState | undefined {
	let state: ReviewSessionState | undefined;
	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type === "custom" && entry.customType === REVIEW_STATE_TYPE) {
			state = entry.data as ReviewSessionState | undefined;
		}
	}

	return state;
}

function applyReviewState(ctx: ExtensionContext) {
	const state = getReviewState(ctx);

	if (state?.active && state.originId) {
		reviewOriginId = state.originId;
		setReviewWidget(ctx, true);
		return;
	}

	reviewOriginId = undefined;
	setReviewWidget(ctx, false);
}

function getReviewSettings(ctx: ExtensionContext): ReviewSettingsState {
	let state: ReviewSettingsState | undefined;
	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type === "custom" && entry.customType === REVIEW_SETTINGS_TYPE) {
			state = entry.data as ReviewSettingsState | undefined;
		}
	}

	return {
		loopFixingEnabled: state?.loopFixingEnabled === true,
	};
}

function applyReviewSettings(ctx: ExtensionContext) {
	const state = getReviewSettings(ctx);
	reviewLoopFixingEnabled = state.loopFixingEnabled === true;
}

function parseMarkdownHeading(line: string): { level: number; title: string } | null {
	const headingMatch = line.match(/^\s*(#{1,6})\s+(.+?)\s*$/);
	if (!headingMatch) {
		return null;
	}

	const rawTitle = headingMatch[2].replace(/\s+#+\s*$/, "").trim();
	return {
		level: headingMatch[1].length,
		title: rawTitle,
	};
}

function getFindingsSectionBounds(lines: string[]): { start: number; end: number } | null {
	let start = -1;
	let findingsHeadingLevel: number | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const heading = parseMarkdownHeading(line);
		if (heading && /^findings\b/i.test(heading.title)) {
			start = i + 1;
			findingsHeadingLevel = heading.level;
			break;
		}
		if (/^\s*findings\s*:?\s*$/i.test(line)) {
			start = i + 1;
			break;
		}
	}

	if (start < 0) {
		return null;
	}

	let end = lines.length;
	for (let i = start; i < lines.length; i++) {
		const line = lines[i];
		const heading = parseMarkdownHeading(line);
		if (heading) {
			const normalizedTitle = heading.title.replace(/[*_`]/g, "").trim();
			if (/^(review scope|verdict|overall verdict|fix queue|constraints(?:\s*&\s*preferences)?)\b:?/i.test(normalizedTitle)) {
				end = i;
				break;
			}

			if (/\[P[0-3]\]/i.test(heading.title)) {
				continue;
			}

			if (findingsHeadingLevel !== null && heading.level <= findingsHeadingLevel) {
				end = i;
				break;
			}
		}

		if (/^\s*(review scope|verdict|overall verdict|fix queue|constraints(?:\s*&\s*preferences)?)\b:?/i.test(line)) {
			end = i;
			break;
		}
	}

	return { start, end };
}

function isLikelyFindingLine(line: string): boolean {
	if (!/\[P[0-3]\]/i.test(line)) {
		return false;
	}

	if (/^\s*(?:[-*+]|(?:\d+)[.)]|#{1,6})\s+priority\s+tag\b/i.test(line)) {
		return false;
	}

	if (/^\s*(?:[-*+]|(?:\d+)[.)]|#{1,6})\s+\[P[0-3]\]\s*-\s*(?:drop everything|urgent|normal|low|nice to have)\b/i.test(line)) {
		return false;
	}

	const allPriorityTags = line.match(/\[P[0-3]\]/gi) ?? [];
	if (allPriorityTags.length > 1) {
		return false;
	}

	if (/^\s*(?:[-*+]|(?:\d+)[.)])\s+/.test(line)) {
		return true;
	}

	if (/^\s*#{1,6}\s+/.test(line)) {
		return true;
	}

	if (/^\s*(?:\*\*|__)?\[P[0-3]\](?:\*\*|__)?(?=\s|:|-)/i.test(line)) {
		return true;
	}

	return false;
}

function normalizeVerdictValue(value: string): string {
	return value
		.trim()
		.replace(/^[-*+]\s*/, "")
		.replace(/^['"`]+|['"`]+$/g, "")
		.toLowerCase();
}

function isNeedsAttentionVerdictValue(value: string): boolean {
	const normalized = normalizeVerdictValue(value);
	if (!normalized.includes("needs attention")) {
		return false;
	}

	if (/\bnot\s+needs\s+attention\b/.test(normalized)) {
		return false;
	}

	// Reject rubric/choice phrasing like "correct or needs attention", but
	// keep legitimate verdict text that may contain unrelated "or".
	if (/\bcorrect\b/.test(normalized) && /\bor\b/.test(normalized)) {
		return false;
	}

	return true;
}

function hasNeedsAttentionVerdict(messageText: string): boolean {
	const lines = messageText.split(/\r?\n/);

	for (const line of lines) {
		const inlineMatch = line.match(/^\s*(?:[*-+]\s*)?(?:overall\s+)?verdict\s*:\s*(.+)$/i);
		if (inlineMatch && isNeedsAttentionVerdictValue(inlineMatch[1])) {
			return true;
		}
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const heading = parseMarkdownHeading(line);

		let verdictLevel: number | null = null;
		if (heading) {
			const normalizedHeading = heading.title.replace(/[*_`]/g, "").trim();
			if (!/^(?:overall\s+)?verdict\b/i.test(normalizedHeading)) {
				continue;
			}
			verdictLevel = heading.level;
		} else if (!/^\s*(?:overall\s+)?verdict\s*:?\s*$/i.test(line)) {
			continue;
		}

		for (let j = i + 1; j < lines.length; j++) {
			const verdictLine = lines[j];
			const nextHeading = parseMarkdownHeading(verdictLine);
			if (nextHeading) {
				const normalizedNextHeading = nextHeading.title.replace(/[*_`]/g, "").trim();
				if (verdictLevel === null || nextHeading.level <= verdictLevel) {
					break;
				}
				if (/^(review scope|findings|fix queue|constraints(?:\s*&\s*preferences)?)\b:?/i.test(normalizedNextHeading)) {
					break;
				}
			}

			const trimmed = verdictLine.trim();
			if (!trimmed) {
				continue;
			}

			if (isNeedsAttentionVerdictValue(trimmed)) {
				return true;
			}

			if (/\bcorrect\b/i.test(normalizeVerdictValue(trimmed))) {
				break;
			}
		}
	}

	return false;
}

function hasBlockingReviewFindings(messageText: string): boolean {
	const lines = messageText.split(/\r?\n/);
	const bounds = getFindingsSectionBounds(lines);
	const candidateLines = bounds ? lines.slice(bounds.start, bounds.end) : lines;

	let inCodeFence = false;
	let foundTaggedFinding = false;
	for (const line of candidateLines) {
		if (/^\s*```/.test(line)) {
			inCodeFence = !inCodeFence;
			continue;
		}
		if (inCodeFence) {
			continue;
		}

		if (!isLikelyFindingLine(line)) {
			continue;
		}

		foundTaggedFinding = true;
		if (/\[(P0|P1|P2)\]/i.test(line)) {
			return true;
		}
	}

	if (foundTaggedFinding) {
		return false;
	}

	return hasNeedsAttentionVerdict(messageText);
}

function slugifyReviewTitle(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80) || "review-finding";
}

function normalizeReviewFindingKey(value: string): string {
	return value
		.toLowerCase()
		.replace(/\[[pP][0-3]\]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

async function loadExistingCeTodoFiles(cwd: string): Promise<{ filePath: string; content: string }[]> {
	const todosDir = path.join(cwd, CE_TODO_REVIEW_DIR);
	const entries = await fs.readdir(todosDir, { withFileTypes: true }).catch(() => []);
	const files = entries
		.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
		.map((entry) => entry.name)
		.sort();

	const results: { filePath: string; content: string }[] = [];
	let usedBytes = 0;

	for (const name of files.slice(0, MAX_EXISTING_TODO_FILES)) {
		const filePath = path.join(todosDir, name);
		const content = await fs.readFile(filePath, "utf8").catch(() => "");
		if (!content.trim()) continue;

		const nextBytes = Buffer.byteLength(content, "utf8");
		if (results.length > 0 && usedBytes + nextBytes > MAX_EXISTING_TODO_BYTES) {
			break;
		}

		results.push({ filePath, content });
		usedBytes += nextBytes;
	}

	return results;
}

function buildExistingCeTodoPromptSection(
	cwd: string,
	todos: { filePath: string; content: string }[],
): string {
	if (todos.length === 0) {
		return "## Existing review todos\n\nNo existing todo markdown files were found under `todos/`.";
	}

	const lines = [
		"## Existing review todos",
		"",
		"Before finalizing findings, read these existing todo markdown files so you can avoid duplicating already-tracked review work unless the new issue is materially different:",
		"",
	];

	for (const todo of todos) {
		lines.push(`### ${path.relative(cwd, todo.filePath)}`);
		lines.push("```md");
		lines.push(todo.content.trim());
		lines.push("```");
		lines.push("");
	}

	return lines.join("\n");
}

function extractCeContextLine(body: string, label: string): string | undefined {
	const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const match = body.match(new RegExp(`^(?:-|\\*)?\\s*${escaped}:\\s*(.+)$`, "im"));
	if (!match) return undefined;
	const value = match[1].trim();
	if (!value) return undefined;
	return value.replace(/\s+#.*$/, "").trim();
}

function parseCompoundEngineeringContextFromPrBody(body: string | undefined): Partial<CeResolvedSourceContext> | null {
	if (!body?.trim()) return null;

	const featureId = extractCeContextLine(body, "Feature ID");
	const planPath = extractCeContextLine(body, "Plan");
	const brainstormPath = extractCeContextLine(body, "Brainstorm");
	const planKind = extractCeContextLine(body, "Plan Kind");
	const phaseId = extractCeContextLine(body, "Phase");
	const parentPlanPath = extractCeContextLine(body, "Parent Plan");

	if (!featureId && !planPath && !brainstormPath) return null;
	return {
		featureId,
		planPath,
		brainstormPath,
		planKind,
		phaseId,
		parentPlanPath,
	};
}

async function resolveCeSourceContext(
	pi: ExtensionAPI,
	cwd: string,
	target: ReviewTarget,
): Promise<CeResolvedSourceContext> {
	if (target.type === "pullRequest") {
		const prBody = target.body ?? (await getPrInfo(pi, target.prNumber))?.body;
		const prContext = parseCompoundEngineeringContextFromPrBody(prBody);
		if (prContext) {
			return {
				source: "pr",
				...prContext,
				branch: target.headBranch,
				prNumber: target.prNumber,
			};
		}
	}

	const manifest = await loadCeWorkflowContext(cwd);
	if (manifest && (manifest.planPath || manifest.brainstormPath || manifest.featureId)) {
		return {
			source: "manifest",
			featureId: manifest.featureId,
			topic: manifest.topic,
			planPath: manifest.planPath,
			brainstormPath: manifest.brainstormPath,
			planKind: manifest.planKind,
			phaseId: manifest.phaseId,
			parentPlanPath: manifest.parentPlanPath,
			branch: manifest.branch,
			prNumber: manifest.prNumber,
		};
	}

	return {
		source: "none",
		branch: target.type === "pullRequest" ? target.headBranch : undefined,
		prNumber: target.type === "pullRequest" ? target.prNumber : undefined,
	};
}

function buildCeFeatureIntentPromptSection(context: CeResolvedSourceContext): string {
	const lines = buildCeWorkflowContextSummary({
		featureId: context.featureId,
		topic: context.topic,
		planPath: context.planPath,
		brainstormPath: context.brainstormPath,
		planKind: context.planKind as any,
		phaseId: context.phaseId,
		parentPlanPath: context.parentPlanPath,
		branch: context.branch,
		prNumber: context.prNumber,
	});
	if (lines.length === 0) return "";

	return [
		"## Pi-native feature intent context",
		"",
		`Recovered from: ${context.source}`,
		...lines,
		"",
		"Use the plan as the primary intent source for this review. Only read the brainstorm when you need extra product intent, rejected alternatives, or explicit non-goals that the plan compressed.",
		"Do not flag plan-explicit non-goals or brainstorm-rejected alternatives as omissions.",
	].join("\n");
}

function extractAssistantTextFromMessageContent(content: unknown): string {
	if (!Array.isArray(content)) {
		return typeof content === "string" ? content : "";
	}

	return content
		.map((part) => {
			if (!part || typeof part !== "object") return "";
			const candidate = part as { type?: string; text?: string };
			return candidate.type === "text" && typeof candidate.text === "string" ? candidate.text : "";
		})
		.filter(Boolean)
		.join("\n")
		.trim();
}

function parseCeTodoPriority(line: string): CeReviewFinding["priority"] | null {
	const tagged = line.match(/\[(P[0-3])\]/i)?.[1]?.toLowerCase();
	if (tagged === "p0" || tagged === "p1") return "p1";
	if (tagged === "p2" || tagged === "p3") return tagged;

	if (/\bcritical\b/i.test(line)) return "p1";
	if (/\bhigh\b/i.test(line)) return "p1";
	if (/\bmedium\b/i.test(line)) return "p2";
	if (/\blow\b/i.test(line)) return "p3";
	return null;
}

function isLikelyCeTodoFindingLine(line: string): boolean {
	if (isLikelyFindingLine(line)) return true;
	return /^\s*(?:\d+)[.)]\s*(?:critical|high|medium|low)\b\s*[—–:-]/i.test(line);
}

function cleanCeTodoFindingTitle(line: string): string {
	return line
		.replace(/^\s*(?:[-*+]|(?:\d+)[.)]|#{1,6})\s+/, "")
		.replace(/^\[P[0-3]\]\s*[:\-–—]?\s*/i, "")
		.replace(/^(critical|high|medium|low)\b\s*[—–:-]\s*/i, "")
		.trim();
}

function parseCeTodoReviewFindings(messageText: string): CeReviewFinding[] {
	const lines = messageText.split(/\r?\n/);
	const bounds = getFindingsSectionBounds(lines);
	const candidateLines = bounds ? lines.slice(bounds.start, bounds.end) : lines;
	const findings: CeReviewFinding[] = [];
	let current: { priority: CeReviewFinding["priority"]; title: string; lines: string[] } | null = null;
	let inCodeFence = false;

	const flush = () => {
		if (!current) return;
		const details = current.lines.join("\n").trim();
		findings.push({
			priority: current.priority,
			title: current.title,
			evidence: details,
			impact: details,
			fix: "Address the issue described in the review finding and verify the affected behavior.",
		});
		current = null;
	};

	for (const line of candidateLines) {
		if (/^\s*```/.test(line)) {
			inCodeFence = !inCodeFence;
			if (current) current.lines.push(line);
			continue;
		}
		if (inCodeFence) {
			if (current) current.lines.push(line);
			continue;
		}

		if (isLikelyCeTodoFindingLine(line)) {
			flush();
			const priority = parseCeTodoPriority(line) ?? "p3";
			const title = cleanCeTodoFindingTitle(line);
			current = { priority, title, lines: [] };
			continue;
		}

		if (current) {
			current.lines.push(line);
		}
	}

	flush();
	return findings.filter((finding) => finding.title);
}

async function createCeTodoFilesFromReview(
	cwd: string,
	findings: CeReviewFinding[],
	reviewTarget: string,
	sourceContext?: CeResolvedSourceContext,
): Promise<string[]> {
	if (findings.length === 0) return [];

	const todosDir = path.join(cwd, CE_TODO_REVIEW_DIR);
	await fs.mkdir(todosDir, { recursive: true });
	const existing = await loadExistingCeTodoFiles(cwd);
	const existingKeys = new Set<string>();
	for (const todo of existing) {
		existingKeys.add(normalizeReviewFindingKey(path.basename(todo.filePath)));
		existingKeys.add(normalizeReviewFindingKey(todo.content));
	}

	const existingNames = await fs.readdir(todosDir).catch(() => []);
	let nextId = existingNames
		.map((file) => Number.parseInt(file.slice(0, 3), 10))
		.filter((value) => Number.isFinite(value))
		.reduce((max, value) => Math.max(max, value), 0) + 1;

	const created: string[] = [];
	for (const finding of findings) {
		const dedupeKey = normalizeReviewFindingKey(finding.title);
		if (dedupeKey && existingKeys.has(dedupeKey)) {
			continue;
		}

		const issueId = String(nextId).padStart(3, "0");
		nextId += 1;
		const fileName = `${issueId}-pending-${finding.priority}-${slugifyReviewTitle(finding.title)}.md`;
		const filePath = path.join(todosDir, fileName);
		const content = [
			"---",
			"status: pending",
			`priority: ${finding.priority}`,
			`issue_id: ${issueId}`,
			"tags: [code-review, compound-engineering]",
			"dependencies: []",
			...(sourceContext?.featureId ? [`source_feature_id: ${sourceContext.featureId}`] : []),
			...(sourceContext?.topic ? [`source_topic: ${sourceContext.topic}`] : []),
			...(sourceContext?.planPath ? [`source_plan: ${sourceContext.planPath}`] : []),
			...(sourceContext?.brainstormPath ? [`source_brainstorm: ${sourceContext.brainstormPath}`] : []),
			...(sourceContext?.planKind ? [`source_plan_kind: ${sourceContext.planKind}`] : []),
			...(sourceContext?.phaseId ? [`source_phase_id: ${sourceContext.phaseId}`] : []),
			...(sourceContext?.parentPlanPath ? [`source_parent_plan: ${sourceContext.parentPlanPath}`] : []),
			...(sourceContext?.branch ? [`source_branch: ${sourceContext.branch}`] : []),
			...(typeof sourceContext?.prNumber === "number" ? [`source_pr: \"${sourceContext.prNumber}\"`] : []),
			"---",
			"",
			`# ${finding.title}`,
			"",
			"## Problem Statement",
			finding.impact || "Review finding detected during Compound Engineering review.",
			"",
			"## Findings",
			`- Review target: ${reviewTarget}`,
			`- Evidence: ${finding.evidence || "See review output for details."}`,
			finding.fix ? `- Suggested direction from review: ${finding.fix}` : "- Suggested direction from review: investigate and implement a targeted fix.",
			"",
			"## Proposed Solutions",
			"### Option 1: Minimal targeted fix",
			"**Approach:** Implement the smallest change that resolves the verified issue without expanding scope.",
			"",
			"**Pros:**",
			"- Preserves intended feature scope",
			"- Fastest path to a validated fix",
			"",
			"**Cons:**",
			"- May leave adjacent non-critical improvements for later",
			"",
			"**Effort:** Small to medium",
			"",
			"**Risk:** Medium until triaged",
			"",
			"## Recommended Action",
			"To be filled during skeptical review / triage.",
			"",
			"## Technical Details",
			"**Affected files:**",
			"- To be confirmed during adjudication",
			"",
			"**Database changes (if any):**",
			"- Unknown",
			"",
			"## Resources",
			`- Review target: ${reviewTarget}`,
			"- Source: native /workflows-review",
			"",
			"## Acceptance Criteria",
			`- [ ] The issue described in \"${finding.title}\" is either fixed or explicitly rejected with rationale`,
			`- [ ] The decision is validated against ${reviewTarget}`,
			"- [ ] Any affected tests or verification steps are updated if work is approved",
			"",
			"## Work Log",
			`### ${new Date().toISOString().slice(0, 10)} - Created from review`,
			"",
			"**By:** Pi native Compound Engineering review runtime",
			"",
			"**Actions:**",
			"- Parsed final synthesized review output",
			`- Created pending todo for finding: ${finding.title}`,
			"",
			"**Learnings:**",
			"- This item still needs skeptical adjudication before implementation",
			"",
			"## Notes",
			"- Created automatically from native /workflows-review",
		].join("\n");

		await fs.writeFile(filePath, content, "utf8");
		created.push(filePath);
		existingKeys.add(dedupeKey);
	}

	return created;
}

// Review target types (matching Codex's approach)
type ReviewTarget =
	| { type: "uncommitted" }
	| { type: "baseBranch"; branch: string }
	| { type: "commit"; sha: string; title?: string }
	| { type: "custom"; instructions: string }
	| { type: "pullRequest"; prNumber: number; baseBranch: string; title: string; headBranch?: string; body?: string }
	| { type: "folder"; paths: string[] };

interface ReviewExecutionRequest {
	target: ReviewTarget;
	includeLocalChanges?: boolean;
	resolutionReason?: string;
}

// Prompts (adapted from Codex)
const UNCOMMITTED_PROMPT =
	"Review the current code changes (staged, unstaged, and untracked files) and provide prioritized findings.";

const LOCAL_CHANGES_REVIEW_INSTRUCTIONS =
	"Also include local working-tree changes (staged, unstaged, and untracked files) from this branch. Use `git status --porcelain`, `git diff`, `git diff --staged`, and `git ls-files --others --exclude-standard` so local fixes are part of this review cycle.";

const BASE_BRANCH_PROMPT_WITH_MERGE_BASE =
	"Review the code changes against the base branch '{baseBranch}'. The merge base commit for this comparison is {mergeBaseSha}. Run `git diff {mergeBaseSha}` to inspect the changes relative to {baseBranch}. Provide prioritized, actionable findings.";

const BASE_BRANCH_PROMPT_FALLBACK =
	"Review the code changes against the base branch '{branch}'. Start by finding the merge diff between the current branch and {branch}'s upstream e.g. (`git merge-base HEAD \"$(git rev-parse --abbrev-ref \"{branch}@{upstream}\")\"`), then run `git diff` against that SHA to see what changes we would merge into the {branch} branch. Provide prioritized, actionable findings.";

const COMMIT_PROMPT_WITH_TITLE =
	'Review the code changes introduced by commit {sha} ("{title}"). Provide prioritized, actionable findings.';

const COMMIT_PROMPT = "Review the code changes introduced by commit {sha}. Provide prioritized, actionable findings.";

const PULL_REQUEST_PROMPT =
	'Review pull request #{prNumber} ("{title}") against the base branch \'{baseBranch}\'. The merge base commit for this comparison is {mergeBaseSha}. Run `git diff {mergeBaseSha}..{headBranch}` to inspect the changes that would be merged from `{headBranch}`. Provide prioritized, actionable findings.';

const PULL_REQUEST_PROMPT_FALLBACK =
	'Review pull request #{prNumber} ("{title}") against the base branch \'{baseBranch}\'. Start by finding the merge base between `{headBranch}` and {baseBranch} (e.g., `git merge-base {headBranch} {baseBranch}`), then run `git diff <merge-base>..{headBranch}` to see the changes that would be merged. Provide prioritized, actionable findings.';

const FOLDER_REVIEW_PROMPT =
	"Review the code in the following paths: {paths}. This is a snapshot review (not a diff). Read the files directly in these paths and provide prioritized, actionable findings.";

const COMPOUND_ENGINEERING_REVIEW_PROMPT_PATH = "/home/will/SITES/pi-compound-engineering/workflow-prompts/workflows-review.md";

// The detailed review rubric (adapted from Codex's review_prompt.md)
const REVIEW_RUBRIC = `# Review Guidelines

You are acting as a code reviewer for a proposed code change made by another engineer.

Below are default guidelines for determining what to flag. These are not the final word — if you encounter more specific guidelines elsewhere (in a developer message, user message, file, or project review guidelines appended below), those override these general instructions.

## Determining what to flag

Flag issues that:
1. Meaningfully impact the accuracy, performance, security, or maintainability of the code.
2. Are discrete and actionable (not general issues or multiple combined issues).
3. Don't demand rigor inconsistent with the rest of the codebase.
4. Were introduced in the changes being reviewed (not pre-existing bugs).
5. The author would likely fix if aware of them.
6. Don't rely on unstated assumptions about the codebase or author's intent.
7. Have provable impact on other parts of the code — it is not enough to speculate that a change may disrupt another part, you must identify the parts that are provably affected.
8. Are clearly not intentional changes by the author.
9. Be particularly careful with untrusted user input and follow the specific guidelines to review.

## Untrusted User Input

1. Be careful with open redirects, they must always be checked to only go to trusted domains (?next_page=...)
2. Always flag SQL that is not parametrized
3. In systems with user supplied URL input, http fetches always need to be protected against access to local resources (intercept DNS resolver!)
4. Escape, don't sanitize if you have the option (eg: HTML escaping)

## Comment guidelines

1. Be clear about why the issue is a problem.
2. Communicate severity appropriately - don't exaggerate.
3. Be brief - at most 1 paragraph.
4. Keep code snippets under 3 lines, wrapped in inline code or code blocks.
5. Use \`\`\`suggestion blocks ONLY for concrete replacement code (minimal lines; no commentary inside the block). Preserve the exact leading whitespace of the replaced lines.
6. Explicitly state scenarios/environments where the issue arises.
7. Use a matter-of-fact tone - helpful AI assistant, not accusatory.
8. Write for quick comprehension without close reading.
9. Avoid excessive flattery or unhelpful phrases like "Great job...".

## Review priorities

1. Call out newly added dependencies explicitly and explain why they're needed.
2. Prefer simple, direct solutions over wrappers or abstractions without clear value.
3. Favor fail-fast behavior; avoid logging-and-continue patterns that hide errors.
4. Prefer predictable production behavior; crashing is better than silent degradation.
5. Treat back pressure handling as critical to system stability.
6. Apply system-level thinking; flag changes that increase operational risk or on-call wakeups.
7. Ensure that errors are always checked against codes or stable identifiers, never error messages.

## Priority levels

Tag each finding with a priority level in the title:
- [P0] - Drop everything to fix. Blocking release/operations. Only for universal issues that do not depend on assumptions about inputs.
- [P1] - Urgent. Should be addressed in the next cycle.
- [P2] - Normal. To be fixed eventually.
- [P3] - Low. Nice to have.

## Output format

Provide your findings in a clear, structured format:
1. List each finding with its priority tag, file location, and explanation.
2. Findings must reference locations that overlap with the actual diff — don't flag pre-existing code.
3. Keep line references as short as possible (avoid ranges over 5-10 lines; pick the most suitable subrange).
4. At the end, provide an overall verdict: "correct" (no blocking issues) or "needs attention" (has blocking issues).
5. Ignore trivial style issues unless they obscure meaning or violate documented standards.
6. Do not generate a full PR fix — only flag issues and optionally provide short suggestion blocks.

Output all findings the author would fix if they knew about them. If there are no qualifying findings, explicitly state the code looks good. Don't stop at the first finding - list every qualifying issue.`;

async function loadProjectReviewGuidelines(cwd: string): Promise<string | null> {
	let currentDir = path.resolve(cwd);

	while (true) {
		const piDir = path.join(currentDir, ".pi");
		const guidelinesPath = path.join(currentDir, "REVIEW_GUIDELINES.md");

		const piStats = await fs.stat(piDir).catch(() => null);
		if (piStats?.isDirectory()) {
			const guidelineStats = await fs.stat(guidelinesPath).catch(() => null);
			if (guidelineStats?.isFile()) {
				try {
					const content = await fs.readFile(guidelinesPath, "utf8");
					const trimmed = content.trim();
					return trimmed ? trimmed : null;
				} catch {
					return null;
				}
			}
			return null;
		}

		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) {
			return null;
		}
		currentDir = parentDir;
	}
}

/**
 * Get the merge base between HEAD and a branch
 */
async function getMergeBase(
	pi: ExtensionAPI,
	branch: string,
): Promise<string | null> {
	try {
		// First try to get the upstream tracking branch
		const { stdout: upstream, code: upstreamCode } = await pi.exec("git", [
			"rev-parse",
			"--abbrev-ref",
			`${branch}@{upstream}`,
		]);

		if (upstreamCode === 0 && upstream.trim()) {
			const { stdout: mergeBase, code } = await pi.exec("git", ["merge-base", "HEAD", upstream.trim()]);
			if (code === 0 && mergeBase.trim()) {
				return mergeBase.trim();
			}
		}

		// Fall back to using the branch directly
		const { stdout: mergeBase, code } = await pi.exec("git", ["merge-base", "HEAD", branch]);
		if (code === 0 && mergeBase.trim()) {
			return mergeBase.trim();
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Get list of local branches
 */
async function getLocalBranches(pi: ExtensionAPI): Promise<string[]> {
	const { stdout, code } = await pi.exec("git", ["branch", "--format=%(refname:short)"]);
	if (code !== 0) return [];
	return stdout
		.trim()
		.split("\n")
		.filter((b) => b.trim());
}

/**
 * Get list of recent commits
 */
async function getRecentCommits(pi: ExtensionAPI, limit: number = 10): Promise<Array<{ sha: string; title: string }>> {
	const { stdout, code } = await pi.exec("git", ["log", `--oneline`, `-n`, `${limit}`]);
	if (code !== 0) return [];

	return stdout
		.trim()
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => {
			const [sha, ...rest] = line.trim().split(" ");
			return { sha, title: rest.join(" ") };
		});
}

/**
 * Check if there are uncommitted changes (staged, unstaged, or untracked)
 */
async function hasUncommittedChanges(pi: ExtensionAPI): Promise<boolean> {
	const { stdout, code } = await pi.exec("git", ["status", "--porcelain"]);
	return code === 0 && stdout.trim().length > 0;
}

/**
 * Check if there are changes that would prevent switching branches
 * (staged or unstaged changes to tracked files - untracked files are fine)
 */
async function hasPendingChanges(pi: ExtensionAPI): Promise<boolean> {
	// Check for staged or unstaged changes to tracked files
	const { stdout, code } = await pi.exec("git", ["status", "--porcelain"]);
	if (code !== 0) return false;

	// Filter out untracked files (lines starting with ??)
	const lines = stdout.trim().split("\n").filter((line) => line.trim());
	const trackedChanges = lines.filter((line) => !line.startsWith("??"));
	return trackedChanges.length > 0;
}

/**
 * Parse a PR reference (URL or number) and return the PR number
 */
function parsePrReference(ref: string): number | null {
	const trimmed = ref.trim();

	// Try as a number first
	const num = parseInt(trimmed, 10);
	if (!isNaN(num) && num > 0) {
		return num;
	}

	// Try to extract from GitHub URL
	// Formats: https://github.com/owner/repo/pull/123
	//          github.com/owner/repo/pull/123
	const urlMatch = trimmed.match(/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/);
	if (urlMatch) {
		return parseInt(urlMatch[1], 10);
	}

	return null;
}

function parseGitHubRepoSlug(remoteUrl: string): string | null {
	const trimmed = remoteUrl.trim();
	const sshMatch = trimmed.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i);
	if (sshMatch) return sshMatch[1];
	const httpsMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i);
	if (httpsMatch) return httpsMatch[1];
	return null;
}

async function getOriginRepoSlug(pi: ExtensionAPI): Promise<string | null> {
	const { stdout, code } = await pi.exec("git", ["remote", "get-url", "origin"]);
	if (code !== 0 || !stdout.trim()) return null;
	return parseGitHubRepoSlug(stdout) ?? null;
}

/**
 * Get PR information from GitHub CLI
 */
async function getPrInfo(pi: ExtensionAPI, prNumber: number): Promise<{ baseBranch: string; title: string; headBranch: string; body?: string } | null> {
	const repoSlug = await getOriginRepoSlug(pi);
	const args = [
		"pr", "view", String(prNumber),
		"--json", "baseRefName,title,headRefName,body",
	];
	if (repoSlug) args.push("--repo", repoSlug);
	const { stdout, code } = await pi.exec("gh", args);

	if (code !== 0) return null;

	try {
		const data = JSON.parse(stdout);
		return {
			baseBranch: data.baseRefName,
			title: data.title,
			headBranch: data.headRefName,
			body: typeof data.body === "string" ? data.body : undefined,
		};
	} catch {
		return null;
	}
}

/**
 * Get PR information for the current branch, if one exists.
 */
async function getCurrentBranchPrInfo(
	pi: ExtensionAPI,
): Promise<{ prNumber: number; baseBranch: string; title: string; headBranch: string; body?: string } | null> {
	const repoSlug = await getOriginRepoSlug(pi);
	const args = ["pr", "view", "--json", "number,baseRefName,title,headRefName,body"];
	if (repoSlug) args.push("--repo", repoSlug);
	const { stdout, code } = await pi.exec("gh", args);
	if (code !== 0) return null;

	try {
		const data = JSON.parse(stdout);
		if (typeof data?.number !== "number") {
			return null;
		}
		return {
			prNumber: data.number,
			baseBranch: data.baseRefName,
			title: data.title,
			headBranch: data.headRefName,
			body: typeof data.body === "string" ? data.body : undefined,
		};
	} catch {
		return null;
	}
}

/**
 * List open PRs authored by the current GitHub user in the origin repository.
 */
async function getOpenAuthoredPrs(
	pi: ExtensionAPI,
): Promise<Array<{ prNumber: number; baseBranch: string; title: string; headBranch: string; url?: string }>> {
	const repoSlug = await getOriginRepoSlug(pi);
	const args = [
		"pr", "list",
		"--author", "@me",
		"--state", "open",
		"--limit", "20",
		"--json", "number,title,baseRefName,headRefName,url",
	];
	if (repoSlug) args.push("--repo", repoSlug);
	const { stdout, code } = await pi.exec("gh", args);
	if (code !== 0) return [];

	try {
		const data = JSON.parse(stdout);
		if (!Array.isArray(data)) return [];
		return data
			.filter((item) => typeof item?.number === "number")
			.map((item) => ({
				prNumber: item.number,
				baseBranch: item.baseRefName,
				title: item.title,
				headBranch: item.headRefName,
				url: typeof item.url === "string" ? item.url : undefined,
			}));
	} catch {
		return [];
	}
}

/**
 * Checkout a PR using GitHub CLI
 */
async function checkoutPr(pi: ExtensionAPI, prNumber: number): Promise<{ success: boolean; error?: string }> {
	const repoSlug = await getOriginRepoSlug(pi);
	const args = ["pr", "checkout", String(prNumber)];
	if (repoSlug) args.push("--repo", repoSlug);
	const { stdout, stderr, code } = await pi.exec("gh", args);

	if (code !== 0) {
		return { success: false, error: stderr || stdout || "Failed to checkout PR" };
	}

	return { success: true };
}

/**
 * Get the current branch name
 */
async function getCurrentBranch(pi: ExtensionAPI): Promise<string | null> {
	const { stdout, code } = await pi.exec("git", ["branch", "--show-current"]);
	if (code === 0 && stdout.trim()) {
		return stdout.trim();
	}
	return null;
}

/**
 * Get the default branch (main or master)
 */
async function getDefaultBranch(pi: ExtensionAPI): Promise<string> {
	// Try to get from remote HEAD
	const { stdout, code } = await pi.exec("git", ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"]);
	if (code === 0 && stdout.trim()) {
		return stdout.trim().replace("origin/", "");
	}

	// Fall back to checking if main or master exists
	const branches = await getLocalBranches(pi);
	if (branches.includes("main")) return "main";
	if (branches.includes("master")) return "master";

	return "main"; // Default fallback
}

/**
 * Build the review prompt based on target
 */
async function buildReviewPrompt(
	pi: ExtensionAPI,
	target: ReviewTarget,
	options?: { includeLocalChanges?: boolean },
): Promise<string> {
	const includeLocalChanges = options?.includeLocalChanges === true;

	switch (target.type) {
		case "uncommitted":
			return UNCOMMITTED_PROMPT;

		case "baseBranch": {
			const mergeBase = await getMergeBase(pi, target.branch);
			const basePrompt = mergeBase
				? BASE_BRANCH_PROMPT_WITH_MERGE_BASE.replace(/{baseBranch}/g, target.branch).replace(/{mergeBaseSha}/g, mergeBase)
				: BASE_BRANCH_PROMPT_FALLBACK.replace(/{branch}/g, target.branch);
			return includeLocalChanges ? `${basePrompt} ${LOCAL_CHANGES_REVIEW_INSTRUCTIONS}` : basePrompt;
		}

		case "commit":
			if (target.title) {
				return COMMIT_PROMPT_WITH_TITLE.replace("{sha}", target.sha).replace("{title}", target.title);
			}
			return COMMIT_PROMPT.replace("{sha}", target.sha);

		case "custom":
			return target.instructions;

		case "pullRequest": {
			const mergeBase = await getMergeBase(pi, target.baseBranch);
			const headBranch = target.headBranch || `pull/${target.prNumber}/head`;
			const basePrompt = mergeBase
				? PULL_REQUEST_PROMPT
						.replace(/{prNumber}/g, String(target.prNumber))
						.replace(/{title}/g, target.title)
						.replace(/{baseBranch}/g, target.baseBranch)
						.replace(/{mergeBaseSha}/g, mergeBase)
						.replace(/{headBranch}/g, headBranch)
				: PULL_REQUEST_PROMPT_FALLBACK
						.replace(/{prNumber}/g, String(target.prNumber))
						.replace(/{title}/g, target.title)
						.replace(/{baseBranch}/g, target.baseBranch)
						.replace(/{headBranch}/g, headBranch);
			return includeLocalChanges ? `${basePrompt} ${LOCAL_CHANGES_REVIEW_INSTRUCTIONS}` : basePrompt;
		}

		case "folder":
			return FOLDER_REVIEW_PROMPT.replace("{paths}", target.paths.join(", "));
	}
}

async function loadCompoundEngineeringReviewPromptTemplate(): Promise<string | null> {
	try {
		const content = await fs.readFile(COMPOUND_ENGINEERING_REVIEW_PROMPT_PATH, "utf8");
		return content.trim();
	} catch {
		return null;
	}
}

async function buildCompoundEngineeringReviewPrompt(
	pi: ExtensionAPI,
	target: ReviewTarget,
	options?: { includeLocalChanges?: boolean; cwd?: string; sourceContext?: CeResolvedSourceContext },
): Promise<string> {
	const template = await loadCompoundEngineeringReviewPromptTemplate();
	const concreteTarget = await buildReviewPrompt(pi, target, options);
	const targetLabel = getUserFacingHint(target);
	const promptBody = template?.replace(/#\$ARGUMENTS/g, targetLabel) ?? "# Compound Engineering Review\n\nPerform a multi-agent review and synthesize the final findings.";
	const reviewCwd = options?.cwd ?? ".";
	const existingTodos = await loadExistingCeTodoFiles(reviewCwd);
	const existingTodoSection = buildExistingCeTodoPromptSection(reviewCwd, existingTodos);
	const sourceContext = options?.sourceContext ?? await resolveCeSourceContext(pi, reviewCwd, target);
	const featureIntentSection = buildCeFeatureIntentPromptSection(sourceContext);

	return `${promptBody}

## Pi-native target resolution

The review target has already been resolved natively. Use this exact target definition and do not re-interpret it:

${concreteTarget}

${featureIntentSection ? `${featureIntentSection}\n\n` : ""}${existingTodoSection}

## Pi-native execution requirements

- Do **not** load or rely on the migrated \`~/.agents/skills/workflows-review/SKILL.md\` skill for this run. The target has already been resolved natively.
- Before doing your own synthesis, you **must** invoke the \`subagent\` tool to run specialist reviewers in parallel.
- Start by scoping the diff with \`git diff --name-only\` against the resolved target.
- Run these reviewers in parallel when available and relevant: \`security-sentinel\`, \`performance-oracle\`, \`architecture-strategist\`, \`pattern-recognition-specialist\`, \`code-simplicity-reviewer\`, and \`agent-native-reviewer\`.
- If the diff touches \`packages/\` or shared framework files, also run \`makerkit-boilerplate-reviewer\`.
- If the diff touches migrations, schema files, or data backfills, also run \`schema-drift-detector\`, \`data-migration-expert\`, and \`deployment-verification-agent\`.
- If one of the suggested reviewer skills is unavailable, continue with the available ones and note the missing reviewer briefly in your final synthesis.
- Review the existing todo markdown files above before finalizing findings. Avoid duplicating an already-open todo unless the new issue is materially different or meaningfully more specific.
- After the parallel reviewer outputs return, inspect the most relevant files yourself and produce one final synthesized review.
- Final output must be a concise review report with findings and verdict, not a work log.
`;
}

/**
 * Get user-facing hint for the review target
 */
function getUserFacingHint(target: ReviewTarget): string {
	switch (target.type) {
		case "uncommitted":
			return "current changes";
		case "baseBranch":
			return `changes against '${target.branch}'`;
		case "commit": {
			const shortSha = target.sha.slice(0, 7);
			return target.title ? `commit ${shortSha}: ${target.title}` : `commit ${shortSha}`;
		}
		case "custom":
			return target.instructions.length > 40 ? target.instructions.slice(0, 37) + "..." : target.instructions;

		case "pullRequest": {
			const shortTitle = target.title.length > 30 ? target.title.slice(0, 27) + "..." : target.title;
			return `PR #${target.prNumber}: ${shortTitle}`;
		}

		case "folder": {
			const joined = target.paths.join(", ");
			return joined.length > 40 ? `folders: ${joined.slice(0, 37)}...` : `folders: ${joined}`;
		}
	}
}

type AssistantSnapshot = {
	id: string;
	text: string;
	stopReason?: string;
};

function extractAssistantTextContent(content: unknown): string {
	if (typeof content === "string") {
		return content.trim();
	}

	if (!Array.isArray(content)) {
		return "";
	}

	const textParts = content
		.filter(
			(part): part is { type: "text"; text: string } =>
				Boolean(part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part),
		)
		.map((part) => part.text);
	return textParts.join("\n").trim();
}

function getLastAssistantSnapshot(ctx: ExtensionContext): AssistantSnapshot | null {
	const entries = ctx.sessionManager.getBranch();
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type !== "message" || entry.message.role !== "assistant") {
			continue;
		}

		const assistantMessage = entry.message as { content?: unknown; stopReason?: string };
		return {
			id: entry.id,
			text: extractAssistantTextContent(assistantMessage.content),
			stopReason: assistantMessage.stopReason,
		};
	}

	return null;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLoopTurnToStart(ctx: ExtensionContext, previousAssistantId?: string): Promise<boolean> {
	const deadline = Date.now() + REVIEW_LOOP_START_TIMEOUT_MS;

	while (Date.now() < deadline) {
		const lastAssistantId = getLastAssistantSnapshot(ctx)?.id;
		if (!ctx.isIdle() || ctx.hasPendingMessages() || (lastAssistantId && lastAssistantId !== previousAssistantId)) {
			return true;
		}
		await sleep(REVIEW_LOOP_START_POLL_MS);
	}

	return false;
}

// Review preset options for the selector (keep this order stable)
const REVIEW_PRESETS = [
	{ value: "uncommitted", label: "Review uncommitted changes", description: "" },
	{ value: "baseBranch", label: "Review against a base branch", description: "(local)" },
	{ value: "commit", label: "Review a commit", description: "" },
	{ value: "pullRequest", label: "Review a pull request", description: "(GitHub PR)" },
	{ value: "folder", label: "Review a folder (or more)", description: "(snapshot, not diff)" },
	{ value: "custom", label: "Custom review instructions", description: "" },
] as const;

const TOGGLE_LOOP_FIXING_VALUE = "toggleLoopFixing" as const;
type ReviewPresetValue = (typeof REVIEW_PRESETS)[number]["value"] | typeof TOGGLE_LOOP_FIXING_VALUE;

export default function reviewExtension(pi: ExtensionAPI) {
	function setReviewLoopFixingEnabled(enabled: boolean) {
		reviewLoopFixingEnabled = enabled;
		pi.appendEntry(REVIEW_SETTINGS_TYPE, { loopFixingEnabled: enabled });
	}

	function applyAllReviewState(ctx: ExtensionContext) {
		applyReviewSettings(ctx);
		applyReviewState(ctx);
	}

	pi.on("session_start", (_event, ctx) => {
		applyAllReviewState(ctx);
	});

	pi.on("session_switch", (_event, ctx) => {
		applyAllReviewState(ctx);
	});

	pi.on("session_tree", (_event, ctx) => {
		applyAllReviewState(ctx);
	});

	pi.on("message_end", async (event, ctx) => {
		if (!pendingCeTodoReview) return;

		const message = event.message as { role?: string; stopReason?: string; content?: unknown };
		if (message.role !== "assistant") return;
		if (message.stopReason && message.stopReason !== "stop") {
			// Ignore intermediate assistant turns such as tool-calling phases.
			return;
		}

		const reviewText = extractAssistantTextFromMessageContent(message.content);
		if (!reviewText) {
			// Keep waiting until the final synthesized review message arrives.
			return;
		}

		const activeReview = pendingCeTodoReview;
		pendingCeTodoReview = undefined;

		const findings = parseCeTodoReviewFindings(reviewText);
		if (findings.length === 0) {
			if (ctx.hasUI) {
				ctx.ui.notify("Compound review completed but no actionable todo findings were parsed from the final report.", "warning");
			}
			return;
		}

		const created = await createCeTodoFilesFromReview(activeReview.cwd, findings, activeReview.target, activeReview.sourceContext);
		if (created.length === 0) {
			if (ctx.hasUI) {
				ctx.ui.notify("Compound review findings matched existing todo markdown files; no new todo files created.", "info");
			}
			return;
		}

		if (ctx.hasUI) {
			ctx.ui.notify(`Created ${created.length} Compound review todo file${created.length === 1 ? "" : "s"} in todos/`, "info");
		}

		pi.sendMessage({
			customType: CE_TODO_REVIEW_TYPE,
			display: true,
			content: [
				{ type: "text", text: `Created ${created.length} Compound review todo file${created.length === 1 ? "" : "s"}:\n${created.map((file) => `- ${path.relative(activeReview.cwd, file)}`).join("\n")}` },
			],
			details: { files: created, target: activeReview.target },
		});
	});

	async function resolveCeReviewRequest(
		ctx: ExtensionCommandContext,
		args: string | undefined,
	): Promise<ReviewExecutionRequest | null> {
		const trimmed = args?.trim();
		if (trimmed) {
			const parsed = parseArgs(trimmed);
			if (parsed) {
				if (parsed.type === "pr") {
					const target = await handlePrCheckout(ctx, parsed.ref);
					return target ? { target, includeLocalChanges: true } : null;
				}

				return {
					target: parsed,
					includeLocalChanges: parsed.type === "baseBranch" || parsed.type === "pullRequest",
				};
			}

			if (trimmed.toLowerCase() === "latest") {
				const defaultBranch = await getDefaultBranch(pi);
				return {
					target: { type: "baseBranch", branch: defaultBranch },
					includeLocalChanges: true,
				};
			}

			if (parsePrReference(trimmed)) {
				const target = await handlePrCheckout(ctx, trimmed);
				return target ? { target, includeLocalChanges: true } : null;
			}

			return {
				target: { type: "baseBranch", branch: trimmed },
				includeLocalChanges: true,
			};
		}

		const currentBranchPr = await getCurrentBranchPrInfo(pi);
		if (currentBranchPr) {
			return {
				target: {
					type: "pullRequest",
					prNumber: currentBranchPr.prNumber,
					baseBranch: currentBranchPr.baseBranch,
					title: currentBranchPr.title,
					headBranch: currentBranchPr.headBranch,
					body: currentBranchPr.body,
				},
				includeLocalChanges: true,
				resolutionReason: `current branch PR #${currentBranchPr.prNumber}`,
			};
		}

		const currentBranch = await getCurrentBranch(pi);
		const defaultBranch = await getDefaultBranch(pi);
		if (currentBranch && currentBranch !== defaultBranch) {
			return {
				target: { type: "baseBranch", branch: defaultBranch },
				includeLocalChanges: true,
				resolutionReason: `feature branch ${currentBranch} vs ${defaultBranch}`,
			};
		}

		if (currentBranch && currentBranch === defaultBranch) {
			const authoredPrs = await getOpenAuthoredPrs(pi);
			if (authoredPrs.length === 1) {
				const authoredPr = authoredPrs[0];
				ctx.ui.notify(`Default branch detected; reviewing your open PR #${authoredPr.prNumber} from ${authoredPr.headBranch}`, "info");
				return {
					target: {
						type: "pullRequest",
						prNumber: authoredPr.prNumber,
						baseBranch: authoredPr.baseBranch,
						title: authoredPr.title,
						headBranch: authoredPr.headBranch,
					},
					includeLocalChanges: false,
					resolutionReason: `authored PR #${authoredPr.prNumber} on default branch`,
				};
			}
			if (authoredPrs.length > 1 && ctx.hasUI) {
				const options = authoredPrs.map((pr) => `PR #${pr.prNumber}: ${pr.title} [${pr.headBranch}]`);
				options.push("Review local current changes instead");
				const choice = await ctx.ui.select("No PR is associated with the default branch. Review one of your open PRs instead?", options);
				if (choice && choice !== "Review local current changes instead") {
					const index = options.indexOf(choice);
					const authoredPr = authoredPrs[index];
					return {
						target: {
							type: "pullRequest",
							prNumber: authoredPr.prNumber,
							baseBranch: authoredPr.baseBranch,
							title: authoredPr.title,
							headBranch: authoredPr.headBranch,
						},
						includeLocalChanges: false,
						resolutionReason: `selected authored PR #${authoredPr.prNumber} from default branch`,
					};
				}
			}
		}

		if (await hasUncommittedChanges(pi)) {
			return { target: { type: "uncommitted" }, resolutionReason: "local working tree changes" };
		}

		const [latestCommit] = await getRecentCommits(pi, 1);
		if (latestCommit) {
			return {
				target: { type: "commit", sha: latestCommit.sha, title: latestCommit.title },
			};
		}

		ctx.ui.notify("Nothing to review: no open PR, no branch diff, and no recent commit was found.", "info");
		return null;
	}

	async function runCeReviewCommand(args: string | undefined, ctx: ExtensionCommandContext): Promise<void> {
		if (!ctx.hasUI) {
			ctx.ui.notify("Review requires interactive mode", "error");
			return;
		}

		if (reviewLoopInProgress) {
			ctx.ui.notify("Loop fixing review is already running.", "warning");
			return;
		}

		if (reviewOriginId) {
			ctx.ui.notify("Already in a review. Use /end-review to finish first.", "warning");
			return;
		}

		const { code } = await pi.exec("git", ["rev-parse", "--git-dir"]);
		if (code !== 0) {
			ctx.ui.notify("Not a git repository", "error");
			return;
		}

		const request = await resolveCeReviewRequest(ctx, args);
		if (!request) {
			return;
		}

		if (reviewLoopFixingEnabled && !isLoopCompatibleTarget(request.target)) {
			ctx.ui.notify("Loop mode does not work with commit review.", "error");
			return;
		}

		if (reviewLoopFixingEnabled) {
			await runLoopFixingReview(ctx, request.target);
			return;
		}

		const entries = ctx.sessionManager.getEntries();
		const messageCount = entries.filter((entry) => entry.type === "message").length;
		let useFreshSession = messageCount === 0;

		if (messageCount > 0) {
			const choice = await ctx.ui.select("Start review in:", ["Empty branch", "Current session"]);
			if (choice === undefined) {
				ctx.ui.notify("Review cancelled", "info");
				return;
			}
			useFreshSession = choice === "Empty branch";
		}

		const sourceContext = await resolveCeSourceContext(pi, ctx.cwd, request.target);
		if (sourceContext.featureId || sourceContext.planPath || sourceContext.brainstormPath) {
			await mergeCeWorkflowContext(ctx.cwd, {
				featureId: sourceContext.featureId,
				topic: sourceContext.topic,
				planPath: sourceContext.planPath,
				brainstormPath: sourceContext.brainstormPath,
				planKind: sourceContext.planKind as any,
				phaseId: sourceContext.phaseId,
				parentPlanPath: sourceContext.parentPlanPath,
				branch: sourceContext.branch,
				prNumber: sourceContext.prNumber,
			});
		}
		const compoundEngineeringPrompt = await buildCompoundEngineeringReviewPrompt(pi, request.target, {
			includeLocalChanges: request.includeLocalChanges === true,
			cwd: ctx.cwd,
			sourceContext,
		});

		await executeReview(ctx, request.target, useFreshSession, {
			includeLocalChanges: request.includeLocalChanges === true,
			promptOverride: compoundEngineeringPrompt,
			hintOverride: `Compound review: ${getUserFacingHint(request.target)}`,
			createCeTodos: true,
			ceSourceContext: sourceContext,
		});
	}

	/**
	 * Determine the smart default review type based on git state
	 */
	async function getSmartDefault(): Promise<"uncommitted" | "baseBranch" | "commit"> {
		// Priority 1: If there are uncommitted changes, default to reviewing them
		if (await hasUncommittedChanges(pi)) {
			return "uncommitted";
		}

		// Priority 2: If on a feature branch (not the default branch), default to PR-style review
		const currentBranch = await getCurrentBranch(pi);
		const defaultBranch = await getDefaultBranch(pi);
		if (currentBranch && currentBranch !== defaultBranch) {
			return "baseBranch";
		}

		// Priority 3: Default to reviewing a specific commit
		return "commit";
	}

	/**
	 * Show the review preset selector
	 */
	async function showReviewSelector(ctx: ExtensionContext): Promise<ReviewTarget | null> {
		// Determine smart default (but keep the list order stable)
		const smartDefault = await getSmartDefault();
		const presetItems: SelectItem[] = REVIEW_PRESETS.map((preset) => ({
			value: preset.value,
			label: preset.label,
			description: preset.description,
		}));
		const smartDefaultIndex = presetItems.findIndex((item) => item.value === smartDefault);

		while (true) {
			const loopToggleLabel = reviewLoopFixingEnabled ? "Disable Loop Fixing" : "Enable Loop Fixing";
			const loopToggleDescription = reviewLoopFixingEnabled ? "(currently on)" : "(currently off)";
			const items: SelectItem[] = [
				...presetItems,
				{ value: TOGGLE_LOOP_FIXING_VALUE, label: loopToggleLabel, description: loopToggleDescription },
			];

			const result = await ctx.ui.custom<ReviewPresetValue | null>((tui, theme, _kb, done) => {
				const container = new Container();
				container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
				container.addChild(new Text(theme.fg("accent", theme.bold("Select a review preset"))));

				const selectList = new SelectList(items, Math.min(items.length, 10), {
					selectedPrefix: (text) => theme.fg("accent", text),
					selectedText: (text) => theme.fg("accent", text),
					description: (text) => theme.fg("muted", text),
					scrollInfo: (text) => theme.fg("dim", text),
					noMatch: (text) => theme.fg("warning", text),
				});

				// Preselect the smart default without reordering the list
				if (smartDefaultIndex >= 0) {
					selectList.setSelectedIndex(smartDefaultIndex);
				}

				selectList.onSelect = (item) => done(item.value as ReviewPresetValue);
				selectList.onCancel = () => done(null);

				container.addChild(selectList);
				container.addChild(new Text(theme.fg("dim", "Press enter to confirm or esc to go back")));
				container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

				return {
					render(width: number) {
						return container.render(width);
					},
					invalidate() {
						container.invalidate();
					},
					handleInput(data: string) {
						selectList.handleInput(data);
						tui.requestRender();
					},
				};
			});

			if (!result) return null;

			if (result === TOGGLE_LOOP_FIXING_VALUE) {
				const nextEnabled = !reviewLoopFixingEnabled;
				setReviewLoopFixingEnabled(nextEnabled);
				ctx.ui.notify(nextEnabled ? "Loop fixing enabled" : "Loop fixing disabled", "info");
				continue;
			}

			// Handle each preset type
			switch (result) {
				case "uncommitted":
					return { type: "uncommitted" };

				case "baseBranch": {
					const target = await showBranchSelector(ctx);
					if (target) return target;
					break;
				}

				case "commit": {
					if (reviewLoopFixingEnabled) {
						ctx.ui.notify("Loop mode does not work with commit review.", "error");
						break;
					}
					const target = await showCommitSelector(ctx);
					if (target) return target;
					break;
				}

				case "custom": {
					const target = await showCustomInput(ctx);
					if (target) return target;
					break;
				}

				case "folder": {
					const target = await showFolderInput(ctx);
					if (target) return target;
					break;
				}

				case "pullRequest": {
					const target = await showPrInput(ctx);
					if (target) return target;
					break;
				}

				default:
					return null;
			}
		}
	}

	/**
	 * Show branch selector for base branch review
	 */
	async function showBranchSelector(ctx: ExtensionContext): Promise<ReviewTarget | null> {
		const branches = await getLocalBranches(pi);
		const currentBranch = await getCurrentBranch(pi);
		const defaultBranch = await getDefaultBranch(pi);

		// Never offer the current branch as a base branch (reviewing against itself is meaningless).
		const candidateBranches = currentBranch ? branches.filter((b) => b !== currentBranch) : branches;

		if (candidateBranches.length === 0) {
			ctx.ui.notify(
				currentBranch ? `No other branches found (current branch: ${currentBranch})` : "No branches found",
				"error",
			);
			return null;
		}

		// Sort branches with default branch first
		const sortedBranches = candidateBranches.sort((a, b) => {
			if (a === defaultBranch) return -1;
			if (b === defaultBranch) return 1;
			return a.localeCompare(b);
		});

		const items: SelectItem[] = sortedBranches.map((branch) => ({
			value: branch,
			label: branch,
			description: branch === defaultBranch ? "(default)" : "",
		}));

		const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
			container.addChild(new Text(theme.fg("accent", theme.bold("Select base branch"))));

			const searchInput = new Input();
			container.addChild(searchInput);
			container.addChild(new Spacer(1));

			const listContainer = new Container();
			container.addChild(listContainer);
			container.addChild(new Text(theme.fg("dim", "Type to filter • enter to select • esc to cancel")));
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

			let filteredItems = items;
			let selectList: SelectList | null = null;

			const updateList = () => {
				listContainer.clear();
				if (filteredItems.length === 0) {
					listContainer.addChild(new Text(theme.fg("warning", "  No matching branches")));
					selectList = null;
					return;
				}

				selectList = new SelectList(filteredItems, Math.min(filteredItems.length, 10), {
					selectedPrefix: (text) => theme.fg("accent", text),
					selectedText: (text) => theme.fg("accent", text),
					description: (text) => theme.fg("muted", text),
					scrollInfo: (text) => theme.fg("dim", text),
					noMatch: (text) => theme.fg("warning", text),
				});

				selectList.onSelect = (item) => done(item.value);
				selectList.onCancel = () => done(null);
				listContainer.addChild(selectList);
			};

			const applyFilter = () => {
				const query = searchInput.getValue();
				filteredItems = query
					? fuzzyFilter(items, query, (item) => `${item.label} ${item.value} ${item.description ?? ""}`)
					: items;
				updateList();
			};

			applyFilter();

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					const kb = getEditorKeybindings();
					if (
						kb.matches(data, "selectUp") ||
						kb.matches(data, "selectDown") ||
						kb.matches(data, "selectConfirm") ||
						kb.matches(data, "selectCancel")
					) {
						if (selectList) {
							selectList.handleInput(data);
						} else if (kb.matches(data, "selectCancel")) {
							done(null);
						}
						tui.requestRender();
						return;
					}

					searchInput.handleInput(data);
					applyFilter();
					tui.requestRender();
				},
			};
		});

		if (!result) return null;
		return { type: "baseBranch", branch: result };
	}

	/**
	 * Show commit selector
	 */
	async function showCommitSelector(ctx: ExtensionContext): Promise<ReviewTarget | null> {
		const commits = await getRecentCommits(pi, 20);

		if (commits.length === 0) {
			ctx.ui.notify("No commits found", "error");
			return null;
		}

		const items: SelectItem[] = commits.map((commit) => ({
			value: commit.sha,
			label: `${commit.sha.slice(0, 7)} ${commit.title}`,
			description: "",
		}));

		const result = await ctx.ui.custom<{ sha: string; title: string } | null>((tui, theme, _kb, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
			container.addChild(new Text(theme.fg("accent", theme.bold("Select commit to review"))));

			const searchInput = new Input();
			container.addChild(searchInput);
			container.addChild(new Spacer(1));

			const listContainer = new Container();
			container.addChild(listContainer);
			container.addChild(new Text(theme.fg("dim", "Type to filter • enter to select • esc to cancel")));
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

			let filteredItems = items;
			let selectList: SelectList | null = null;

			const updateList = () => {
				listContainer.clear();
				if (filteredItems.length === 0) {
					listContainer.addChild(new Text(theme.fg("warning", "  No matching commits")));
					selectList = null;
					return;
				}

				selectList = new SelectList(filteredItems, Math.min(filteredItems.length, 10), {
					selectedPrefix: (text) => theme.fg("accent", text),
					selectedText: (text) => theme.fg("accent", text),
					description: (text) => theme.fg("muted", text),
					scrollInfo: (text) => theme.fg("dim", text),
					noMatch: (text) => theme.fg("warning", text),
				});

				selectList.onSelect = (item) => {
					const commit = commits.find((c) => c.sha === item.value);
					if (commit) {
						done(commit);
					} else {
						done(null);
					}
				};
				selectList.onCancel = () => done(null);
				listContainer.addChild(selectList);
			};

			const applyFilter = () => {
				const query = searchInput.getValue();
				filteredItems = query
					? fuzzyFilter(items, query, (item) => `${item.label} ${item.value} ${item.description ?? ""}`)
					: items;
				updateList();
			};

			applyFilter();

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					const kb = getEditorKeybindings();
					if (
						kb.matches(data, "selectUp") ||
						kb.matches(data, "selectDown") ||
						kb.matches(data, "selectConfirm") ||
						kb.matches(data, "selectCancel")
					) {
						if (selectList) {
							selectList.handleInput(data);
						} else if (kb.matches(data, "selectCancel")) {
							done(null);
						}
						tui.requestRender();
						return;
					}

					searchInput.handleInput(data);
					applyFilter();
					tui.requestRender();
				},
			};
		});

		if (!result) return null;
		return { type: "commit", sha: result.sha, title: result.title };
	}

	/**
	 * Show custom instructions input
	 */
	async function showCustomInput(ctx: ExtensionContext): Promise<ReviewTarget | null> {
		const result = await ctx.ui.editor(
			"Enter review instructions:",
			"Review the code for security vulnerabilities and potential bugs...",
		);

		if (!result?.trim()) return null;
		return { type: "custom", instructions: result.trim() };
	}

	function parseReviewPaths(value: string): string[] {
		return value
			.split(/\s+/)
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
	}

	/**
	 * Show folder input
	 */
	async function showFolderInput(ctx: ExtensionContext): Promise<ReviewTarget | null> {
		const result = await ctx.ui.editor(
			"Enter folders/files to review (space-separated or one per line):",
			".",
		);

		if (!result?.trim()) return null;
		const paths = parseReviewPaths(result);
		if (paths.length === 0) return null;

		return { type: "folder", paths };
	}

	/**
	 * Show PR input and handle checkout
	 */
	async function showPrInput(ctx: ExtensionContext): Promise<ReviewTarget | null> {
		// First check for pending changes that would prevent branch switching
		if (await hasPendingChanges(pi)) {
			ctx.ui.notify("Cannot checkout PR: you have uncommitted changes. Please commit or stash them first.", "error");
			return null;
		}

		// Get PR reference from user
		const prRef = await ctx.ui.editor(
			"Enter PR number or URL (e.g. 123 or https://github.com/owner/repo/pull/123):",
			"",
		);

		if (!prRef?.trim()) return null;

		const prNumber = parsePrReference(prRef);
		if (!prNumber) {
			ctx.ui.notify("Invalid PR reference. Enter a number or GitHub PR URL.", "error");
			return null;
		}

		// Get PR info from GitHub
		ctx.ui.notify(`Fetching PR #${prNumber} info...`, "info");
		const prInfo = await getPrInfo(pi, prNumber);

		if (!prInfo) {
			ctx.ui.notify(`Could not find PR #${prNumber}. Make sure gh is authenticated and the PR exists.`, "error");
			return null;
		}

		// Check again for pending changes (in case something changed)
		if (await hasPendingChanges(pi)) {
			ctx.ui.notify("Cannot checkout PR: you have uncommitted changes. Please commit or stash them first.", "error");
			return null;
		}

		// Checkout the PR
		ctx.ui.notify(`Checking out PR #${prNumber}...`, "info");
		const checkoutResult = await checkoutPr(pi, prNumber);

		if (!checkoutResult.success) {
			ctx.ui.notify(`Failed to checkout PR: ${checkoutResult.error}`, "error");
			return null;
		}

		ctx.ui.notify(`Checked out PR #${prNumber} (${prInfo.headBranch})`, "info");

		return {
			type: "pullRequest",
			prNumber,
			baseBranch: prInfo.baseBranch,
			title: prInfo.title,
			headBranch: prInfo.headBranch,
			body: prInfo.body,
		};
	}

	/**
	 * Execute the review
	 */
	async function executeReview(
		ctx: ExtensionCommandContext,
		target: ReviewTarget,
		useFreshSession: boolean,
		options?: {
			includeLocalChanges?: boolean;
			promptOverride?: string;
			hintOverride?: string;
			createCeTodos?: boolean;
			ceSourceContext?: CeResolvedSourceContext;
		},
	): Promise<boolean> {
		// Check if we're already in a review
		if (reviewOriginId) {
			ctx.ui.notify("Already in a review. Use /end-review to finish first.", "warning");
			return false;
		}

		// Handle fresh session mode
		if (useFreshSession) {
			// Store current position (where we'll return to).
			// In an empty session there is no leaf yet, so create a lightweight anchor first.
			let originId = ctx.sessionManager.getLeafId() ?? undefined;
			if (!originId) {
				pi.appendEntry(REVIEW_ANCHOR_TYPE, { createdAt: new Date().toISOString() });
				originId = ctx.sessionManager.getLeafId() ?? undefined;
			}
			if (!originId) {
				ctx.ui.notify("Failed to determine review origin.", "error");
				return false;
			}
			reviewOriginId = originId;

			// Keep a local copy so session_tree events during navigation don't wipe it
			const lockedOriginId = originId;

			// Find the first user message in the session.
			// If none exists (e.g. brand-new session), we'll stay on the current leaf.
			const entries = ctx.sessionManager.getEntries();
			const firstUserMessage = entries.find(
				(e) => e.type === "message" && e.message.role === "user",
			);

			if (firstUserMessage) {
				// Navigate to first user message to create a new branch from that point
				// Label it as "code-review" so it's visible in the tree
				try {
					const result = await ctx.navigateTree(firstUserMessage.id, { summarize: false, label: "code-review" });
					if (result.cancelled) {
						reviewOriginId = undefined;
						return false;
					}
				} catch (error) {
					// Clean up state if navigation fails
					reviewOriginId = undefined;
					ctx.ui.notify(`Failed to start review: ${error instanceof Error ? error.message : String(error)}`, "error");
					return false;
				}

				// Clear the editor (navigating to user message fills it with the message text)
				ctx.ui.setEditorText("");
			}

			// Restore origin after navigation events (session_tree can reset it)
			reviewOriginId = lockedOriginId;

			// Show widget indicating review is active
			setReviewWidget(ctx, true);

			// Persist review state so tree navigation can restore/reset it
			pi.appendEntry(REVIEW_STATE_TYPE, { active: true, originId: lockedOriginId });
		}

		const prompt = options?.promptOverride ?? await buildReviewPrompt(pi, target, {
			includeLocalChanges: options?.includeLocalChanges === true,
		});
		const hint = options?.hintOverride ?? getUserFacingHint(target);
		const projectGuidelines = await loadProjectReviewGuidelines(ctx.cwd);

		// Combine the review rubric with the specific prompt unless a full prompt override was provided.
		let fullPrompt = options?.promptOverride
			? prompt
			: `${REVIEW_RUBRIC}\n\n---\n\nPlease perform a code review with the following focus:\n\n${prompt}`;

		if (projectGuidelines) {
			fullPrompt += `\n\nThis project has additional instructions for code reviews:\n\n${projectGuidelines}`;
		}

		const modeHint = useFreshSession ? " (fresh session)" : "";
		ctx.ui.notify(`Starting review: ${hint}${modeHint}`, "info");

		pendingCeTodoReview = options?.createCeTodos
			? {
				cwd: ctx.cwd,
				target: hint,
				startedAt: Date.now(),
				sourceContext: options.ceSourceContext,
			}
			: undefined;

		// Send as a user message that triggers a turn
		pi.sendUserMessage(fullPrompt);
		return true;
	}

	/**
	 * Parse command arguments for direct invocation
	 * Returns the target or a special marker for PR that needs async handling
	 */
	function parseArgs(args: string | undefined): ReviewTarget | { type: "pr"; ref: string } | null {
		if (!args?.trim()) return null;

		const parts = args.trim().split(/\s+/);
		const subcommand = parts[0]?.toLowerCase();

		switch (subcommand) {
			case "uncommitted":
				return { type: "uncommitted" };

			case "branch": {
				const branch = parts[1];
				if (!branch) return null;
				return { type: "baseBranch", branch };
			}

			case "commit": {
				const sha = parts[1];
				if (!sha) return null;
				const title = parts.slice(2).join(" ") || undefined;
				return { type: "commit", sha, title };
			}

			case "custom": {
				const instructions = parts.slice(1).join(" ");
				if (!instructions) return null;
				return { type: "custom", instructions };
			}

			case "folder": {
				const paths = parseReviewPaths(parts.slice(1).join(" "));
				if (paths.length === 0) return null;
				return { type: "folder", paths };
			}

			case "pr": {
				const ref = parts[1];
				if (!ref) return null;
				return { type: "pr", ref };
			}

			default:
				return null;
		}
	}

	/**
	 * Handle PR checkout and return a ReviewTarget (or null on failure)
	 */
	async function handlePrCheckout(ctx: ExtensionContext, ref: string): Promise<ReviewTarget | null> {
		// First check for pending changes
		if (await hasPendingChanges(pi)) {
			ctx.ui.notify("Cannot checkout PR: you have uncommitted changes. Please commit or stash them first.", "error");
			return null;
		}

		const prNumber = parsePrReference(ref);
		if (!prNumber) {
			ctx.ui.notify("Invalid PR reference. Enter a number or GitHub PR URL.", "error");
			return null;
		}

		// Get PR info
		ctx.ui.notify(`Fetching PR #${prNumber} info...`, "info");
		const prInfo = await getPrInfo(pi, prNumber);

		if (!prInfo) {
			ctx.ui.notify(`Could not find PR #${prNumber}. Make sure gh is authenticated and the PR exists.`, "error");
			return null;
		}

		// Checkout the PR
		ctx.ui.notify(`Checking out PR #${prNumber}...`, "info");
		const checkoutResult = await checkoutPr(pi, prNumber);

		if (!checkoutResult.success) {
			ctx.ui.notify(`Failed to checkout PR: ${checkoutResult.error}`, "error");
			return null;
		}

		ctx.ui.notify(`Checked out PR #${prNumber} (${prInfo.headBranch})`, "info");

		return {
			type: "pullRequest",
			prNumber,
			baseBranch: prInfo.baseBranch,
			title: prInfo.title,
			headBranch: prInfo.headBranch,
			body: prInfo.body,
		};
	}

	function isLoopCompatibleTarget(target: ReviewTarget): boolean {
		if (target.type !== "commit") {
			return true;
		}

		return false;
	}

	async function runLoopFixingReview(ctx: ExtensionCommandContext, target: ReviewTarget): Promise<void> {
		if (reviewLoopInProgress) {
			ctx.ui.notify("Loop fixing review is already running.", "warning");
			return;
		}

		reviewLoopInProgress = true;
		setReviewWidget(ctx, Boolean(reviewOriginId));
		try {
			ctx.ui.notify(
				"Loop fixing enabled: using Empty branch mode and cycling until no blocking findings remain.",
				"info",
			);

			for (let pass = 1; pass <= REVIEW_LOOP_MAX_ITERATIONS; pass++) {
				const reviewBaselineAssistantId = getLastAssistantSnapshot(ctx)?.id;
				const started = await executeReview(ctx, target, true, { includeLocalChanges: true });
				if (!started) {
					ctx.ui.notify("Loop fixing stopped before starting the review pass.", "warning");
					return;
				}

				const reviewTurnStarted = await waitForLoopTurnToStart(ctx, reviewBaselineAssistantId);
				if (!reviewTurnStarted) {
					ctx.ui.notify("Loop fixing stopped: review pass did not start in time.", "error");
					return;
				}

				await ctx.waitForIdle();

				const reviewSnapshot = getLastAssistantSnapshot(ctx);
				if (!reviewSnapshot || reviewSnapshot.id === reviewBaselineAssistantId) {
					ctx.ui.notify("Loop fixing stopped: could not read the review result.", "warning");
					return;
				}

				if (reviewSnapshot.stopReason === "aborted") {
					ctx.ui.notify("Loop fixing stopped: review was aborted.", "warning");
					return;
				}

				if (reviewSnapshot.stopReason === "error") {
					ctx.ui.notify("Loop fixing stopped: review failed with an error.", "error");
					return;
				}

				if (reviewSnapshot.stopReason === "length") {
					ctx.ui.notify("Loop fixing stopped: review output was truncated (stopReason=length).", "warning");
					return;
				}

				if (!hasBlockingReviewFindings(reviewSnapshot.text)) {
					const finalized = await executeEndReviewAction(ctx, "returnAndSummarize", {
						showSummaryLoader: true,
						notifySuccess: false,
					});
					if (finalized !== "ok") {
						return;
					}

					ctx.ui.notify("Loop fixing complete: no blocking findings remain.", "info");
					return;
				}

				ctx.ui.notify(`Loop fixing pass ${pass}: found blocking findings, returning to fix them...`, "info");

				const fixBaselineAssistantId = getLastAssistantSnapshot(ctx)?.id;
				const sentFixPrompt = await executeEndReviewAction(ctx, "returnAndFix", {
					showSummaryLoader: true,
					notifySuccess: false,
				});
				if (sentFixPrompt !== "ok") {
					return;
				}

				const fixTurnStarted = await waitForLoopTurnToStart(ctx, fixBaselineAssistantId);
				if (!fixTurnStarted) {
					ctx.ui.notify("Loop fixing stopped: fix pass did not start in time.", "error");
					return;
				}

				await ctx.waitForIdle();

				const fixSnapshot = getLastAssistantSnapshot(ctx);
				if (!fixSnapshot || fixSnapshot.id === fixBaselineAssistantId) {
					ctx.ui.notify("Loop fixing stopped: could not read the fix pass result.", "warning");
					return;
				}
				if (fixSnapshot.stopReason === "aborted") {
					ctx.ui.notify("Loop fixing stopped: fix pass was aborted.", "warning");
					return;
				}
				if (fixSnapshot.stopReason === "error") {
					ctx.ui.notify("Loop fixing stopped: fix pass failed with an error.", "error");
					return;
				}
				if (fixSnapshot.stopReason === "length") {
					ctx.ui.notify("Loop fixing stopped: fix pass output was truncated (stopReason=length).", "warning");
					return;
				}
			}

			ctx.ui.notify(
				`Loop fixing stopped after ${REVIEW_LOOP_MAX_ITERATIONS} passes (safety limit reached).`,
				"warning",
			);
		} finally {
			reviewLoopInProgress = false;
			setReviewWidget(ctx, Boolean(reviewOriginId));
		}
	}

	// Register the /review command
	pi.registerCommand("review", {
		description: "Review code changes (PR, uncommitted, branch, commit, folder, or custom)",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Review requires interactive mode", "error");
				return;
			}

			if (reviewLoopInProgress) {
				ctx.ui.notify("Loop fixing review is already running.", "warning");
				return;
			}

			// Check if we're already in a review
			if (reviewOriginId) {
				ctx.ui.notify("Already in a review. Use /end-review to finish first.", "warning");
				return;
			}

			// Check if we're in a git repository
			const { code } = await pi.exec("git", ["rev-parse", "--git-dir"]);
			if (code !== 0) {
				ctx.ui.notify("Not a git repository", "error");
				return;
			}

			// Try to parse direct arguments
			let target: ReviewTarget | null = null;
			let fromSelector = false;
			const parsed = parseArgs(args);

			if (parsed) {
				if (parsed.type === "pr") {
					// Handle PR checkout (async operation)
					target = await handlePrCheckout(ctx, parsed.ref);
					if (!target) {
						ctx.ui.notify("PR review failed. Returning to review menu.", "warning");
					}
				} else {
					target = parsed;
				}
			}

			// If no args or invalid args, show selector
			if (!target) {
				fromSelector = true;
			}

			while (true) {
				if (!target && fromSelector) {
					target = await showReviewSelector(ctx);
				}

				if (!target) {
					ctx.ui.notify("Review cancelled", "info");
					return;
				}

				if (reviewLoopFixingEnabled && !isLoopCompatibleTarget(target)) {
					ctx.ui.notify("Loop mode does not work with commit review.", "error");
					if (fromSelector) {
						target = null;
						continue;
					}
					return;
				}

				if (reviewLoopFixingEnabled) {
					await runLoopFixingReview(ctx, target);
					return;
				}

				// Determine if we should use fresh session mode
				// Check if this is a new session (no messages yet)
				const entries = ctx.sessionManager.getEntries();
				const messageCount = entries.filter((e) => e.type === "message").length;

				// In an empty session, default to fresh review mode so /end-review works consistently.
				let useFreshSession = messageCount === 0;

				if (messageCount > 0) {
					// Existing session - ask user which mode they want
					const choice = await ctx.ui.select("Start review in:", ["Empty branch", "Current session"]);

					if (choice === undefined) {
						if (fromSelector) {
							target = null;
							continue;
						}
						ctx.ui.notify("Review cancelled", "info");
						return;
					}

					useFreshSession = choice === "Empty branch";
				}

				await executeReview(ctx, target, useFreshSession);
				return;
			}
		},
	});

	pi.registerCommand("workflows-review", {
		description: "Compound Engineering review with PR-first target resolution",
		handler: async (args, ctx) => {
			await runCeReviewCommand(args, ctx);
		},
	});

	pi.registerCommand("ce-review", {
		description: "Alias for /workflows-review",
		handler: async (args, ctx) => {
			await runCeReviewCommand(args, ctx);
		},
	});

	pi.registerCommand("ce:review", {
		description: "Deprecated alias for /workflows-review",
		handler: async (args, ctx) => {
			ctx.ui.notify("/ce:review is deprecated; running canonical /workflows-review", "info");
			await runCeReviewCommand(args, ctx);
		},
	});

	pi.registerCommand("workflows:review", {
		description: "Deprecated alias for /workflows-review",
		handler: async (args, ctx) => {
			ctx.ui.notify("/workflows:review is deprecated; running canonical /workflows-review", "info");
			await runCeReviewCommand(args, ctx);
		},
	});

	// Custom prompt for review summaries - focuses on preserving actionable findings
	const REVIEW_SUMMARY_PROMPT = `We are leaving a code-review branch and returning to the main coding branch.
Create a structured handoff that can be used immediately to implement fixes.

You MUST summarize the review that happened in this branch so findings can be acted on.
Do not omit findings: include every actionable issue that was identified.

Required sections (in order):

## Review Scope
- What was reviewed (files/paths, changes, and scope)

## Verdict
- "correct" or "needs attention"

## Findings
For EACH finding, include:
- Priority tag ([P0]..[P3]) and short title
- File location (\`path/to/file.ext:line\`)
- Why it matters (brief)
- What should change (brief, actionable)

## Fix Queue
1. Ordered implementation checklist (highest priority first)

## Constraints & Preferences
- Any constraints or preferences mentioned during review
- Or "(none)"

Preserve exact file paths, function names, and error messages where available.`;

	const REVIEW_FIX_FINDINGS_PROMPT = `Use the latest review summary in this session and implement the review findings now.

Instructions:
1. Treat the summary's Findings/Fix Queue as a checklist.
2. Fix in priority order: P0, P1, then P2 (include P3 if quick and safe).
3. If a finding is invalid/already fixed/not possible right now, briefly explain why and continue.
4. Run relevant tests/checks for touched code where practical.
5. End with: fixed items, deferred/skipped items (with reasons), and verification results.`;

	type EndReviewAction = "returnOnly" | "returnAndFix" | "returnAndSummarize";
	type EndReviewActionResult = "ok" | "cancelled" | "error";
	type EndReviewActionOptions = {
		showSummaryLoader?: boolean;
		notifySuccess?: boolean;
	};

	function getActiveReviewOrigin(ctx: ExtensionContext): string | undefined {
		if (reviewOriginId) {
			return reviewOriginId;
		}

		const state = getReviewState(ctx);
		if (state?.active && state.originId) {
			reviewOriginId = state.originId;
			return reviewOriginId;
		}

		if (state?.active) {
			setReviewWidget(ctx, false);
			pi.appendEntry(REVIEW_STATE_TYPE, { active: false });
			ctx.ui.notify("Review state was missing origin info; cleared review status.", "warning");
		}

		return undefined;
	}

	function clearReviewState(ctx: ExtensionContext) {
		setReviewWidget(ctx, false);
		reviewOriginId = undefined;
		pi.appendEntry(REVIEW_STATE_TYPE, { active: false });
	}

	async function navigateWithSummary(
		ctx: ExtensionCommandContext,
		originId: string,
		showLoader: boolean,
	): Promise<{ cancelled: boolean; error?: string } | null> {
		if (showLoader && ctx.hasUI) {
			return ctx.ui.custom<{ cancelled: boolean; error?: string } | null>((tui, theme, _kb, done) => {
				const loader = new BorderedLoader(tui, theme, "Returning and summarizing review branch...");
				loader.onAbort = () => done(null);

				ctx.navigateTree(originId, {
					summarize: true,
					customInstructions: REVIEW_SUMMARY_PROMPT,
					replaceInstructions: true,
				})
					.then(done)
					.catch((err) => done({ cancelled: false, error: err instanceof Error ? err.message : String(err) }));

				return loader;
			});
		}

		try {
			return await ctx.navigateTree(originId, {
				summarize: true,
				customInstructions: REVIEW_SUMMARY_PROMPT,
				replaceInstructions: true,
			});
		} catch (error) {
			return { cancelled: false, error: error instanceof Error ? error.message : String(error) };
		}
	}

	async function executeEndReviewAction(
		ctx: ExtensionCommandContext,
		action: EndReviewAction,
		options: EndReviewActionOptions = {},
	): Promise<EndReviewActionResult> {
		const originId = getActiveReviewOrigin(ctx);
		if (!originId) {
			if (!getReviewState(ctx)?.active) {
				ctx.ui.notify("Not in a review branch (use /review first, or review was started in current session mode)", "info");
			}
			return "error";
		}

		const notifySuccess = options.notifySuccess ?? true;

		if (action === "returnOnly") {
			try {
				const result = await ctx.navigateTree(originId, { summarize: false });
				if (result.cancelled) {
					ctx.ui.notify("Navigation cancelled. Use /end-review to try again.", "info");
					return "cancelled";
				}
			} catch (error) {
				ctx.ui.notify(`Failed to return: ${error instanceof Error ? error.message : String(error)}`, "error");
				return "error";
			}

			clearReviewState(ctx);
			if (notifySuccess) {
				ctx.ui.notify("Review complete! Returned to original position.", "info");
			}
			return "ok";
		}

		const summaryResult = await navigateWithSummary(ctx, originId, options.showSummaryLoader ?? false);
		if (summaryResult === null) {
			ctx.ui.notify("Summarization cancelled. Use /end-review to try again.", "info");
			return "cancelled";
		}

		if (summaryResult.error) {
			ctx.ui.notify(`Summarization failed: ${summaryResult.error}`, "error");
			return "error";
		}

		if (summaryResult.cancelled) {
			ctx.ui.notify("Navigation cancelled. Use /end-review to try again.", "info");
			return "cancelled";
		}

		clearReviewState(ctx);

		if (action === "returnAndSummarize") {
			if (!ctx.ui.getEditorText().trim()) {
				ctx.ui.setEditorText("Act on the review findings");
			}
			if (notifySuccess) {
				ctx.ui.notify("Review complete! Returned and summarized.", "info");
			}
			return "ok";
		}

		pi.sendUserMessage(REVIEW_FIX_FINDINGS_PROMPT, { deliverAs: "followUp" });
		if (notifySuccess) {
			ctx.ui.notify("Review complete! Returned and queued a follow-up to fix findings.", "info");
		}
		return "ok";
	}

	async function runEndReview(ctx: ExtensionCommandContext): Promise<void> {
		if (!ctx.hasUI) {
			ctx.ui.notify("End-review requires interactive mode", "error");
			return;
		}

		if (reviewLoopInProgress) {
			ctx.ui.notify("Loop fixing review is running. Wait for it to finish.", "info");
			return;
		}

		if (endReviewInProgress) {
			ctx.ui.notify("/end-review is already running", "info");
			return;
		}

		endReviewInProgress = true;
		try {
			const choice = await ctx.ui.select("Finish review:", [
				"Return only",
				"Return and fix findings",
				"Return and summarize",
			]);

			if (choice === undefined) {
				ctx.ui.notify("Cancelled. Use /end-review to try again.", "info");
				return;
			}

			const action: EndReviewAction =
				choice === "Return and fix findings"
					? "returnAndFix"
					: choice === "Return and summarize"
						? "returnAndSummarize"
						: "returnOnly";

			await executeEndReviewAction(ctx, action, {
				showSummaryLoader: true,
				notifySuccess: true,
			});
		} finally {
			endReviewInProgress = false;
		}
	}

	// Register the /end-review command
	pi.registerCommand("end-review", {
		description: "Complete review and return to original position",
		handler: async (_args, ctx) => {
			await runEndReview(ctx);
		},
	});
}
