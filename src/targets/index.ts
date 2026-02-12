import type { ClaudePlugin } from "../types/claude"
import type { OpenCodeBundle } from "../types/opencode"
import type { CodexBundle } from "../types/codex"
import type { PiBundle } from "../types/pi"
import { convertClaudeToOpenCode, type ClaudeToOpenCodeOptions } from "../converters/claude-to-opencode"
import { convertClaudeToCodex } from "../converters/claude-to-codex"
import { convertClaudeToPi } from "../converters/claude-to-pi"
import { writeOpenCodeBundle } from "./opencode"
import { writeCodexBundle } from "./codex"
import { writePiBundle } from "./pi"

export type TargetHandler<TBundle = any> = {
  name: string
  implemented: boolean
  convert: (plugin: ClaudePlugin, options: ClaudeToOpenCodeOptions) => TBundle | null
  write: (outputRoot: string, bundle: TBundle) => Promise<void>
}

export const targets: Record<string, TargetHandler> = {
  opencode: {
    name: "opencode",
    implemented: true,
    convert: convertClaudeToOpenCode,
    write: writeOpenCodeBundle,
  },
  codex: {
    name: "codex",
    implemented: true,
    convert: convertClaudeToCodex as TargetHandler<CodexBundle>["convert"],
    write: writeCodexBundle as TargetHandler<CodexBundle>["write"],
  },
  pi: {
    name: "pi",
    implemented: true,
    convert: convertClaudeToPi as TargetHandler<PiBundle>["convert"],
    write: writePiBundle as TargetHandler<PiBundle>["write"],
  },
}
