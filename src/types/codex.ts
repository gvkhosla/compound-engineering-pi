import type { ClaudeMcpServer } from "./claude"

export type CodexPrompt = {
  name: string
  content: string
}

export type CodexSkillDir = {
  name: string
  sourceDir: string
}

export type CodexGeneratedSkill = {
  name: string
  content: string
}

export type CodexBundle = {
  prompts: CodexPrompt[]
  skillDirs: CodexSkillDir[]
  generatedSkills: CodexGeneratedSkill[]
  mcpServers?: Record<string, ClaudeMcpServer>
}
