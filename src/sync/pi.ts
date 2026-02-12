import fs from "fs/promises"
import path from "path"
import type { ClaudeHomeConfig } from "../parsers/claude-home"
import type { ClaudeMcpServer } from "../types/claude"
import { forceSymlink, isValidSkillName } from "../utils/symlink"

type McporterServer = {
  baseUrl?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  headers?: Record<string, string>
}

type McporterConfig = {
  mcpServers: Record<string, McporterServer>
}

export async function syncToPi(
  config: ClaudeHomeConfig,
  outputRoot: string,
): Promise<void> {
  const skillsDir = path.join(outputRoot, "skills")
  const mcporterPath = path.join(outputRoot, "compound-engineering", "mcporter.json")

  await fs.mkdir(skillsDir, { recursive: true })

  for (const skill of config.skills) {
    if (!isValidSkillName(skill.name)) {
      console.warn(`Skipping skill with invalid name: ${skill.name}`)
      continue
    }
    const target = path.join(skillsDir, skill.name)
    await forceSymlink(skill.sourceDir, target)
  }

  if (Object.keys(config.mcpServers).length > 0) {
    await fs.mkdir(path.dirname(mcporterPath), { recursive: true })

    const existing = await readJsonSafe(mcporterPath)
    const converted = convertMcpToMcporter(config.mcpServers)
    const merged: McporterConfig = {
      mcpServers: {
        ...(existing.mcpServers ?? {}),
        ...converted.mcpServers,
      },
    }

    await fs.writeFile(mcporterPath, JSON.stringify(merged, null, 2), { mode: 0o600 })
  }
}

async function readJsonSafe(filePath: string): Promise<Partial<McporterConfig>> {
  try {
    const content = await fs.readFile(filePath, "utf-8")
    return JSON.parse(content) as Partial<McporterConfig>
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {}
    }
    throw err
  }
}

function convertMcpToMcporter(servers: Record<string, ClaudeMcpServer>): McporterConfig {
  const mcpServers: Record<string, McporterServer> = {}

  for (const [name, server] of Object.entries(servers)) {
    if (server.command) {
      mcpServers[name] = {
        command: server.command,
        args: server.args,
        env: server.env,
        headers: server.headers,
      }
      continue
    }

    if (server.url) {
      mcpServers[name] = {
        baseUrl: server.url,
        headers: server.headers,
      }
    }
  }

  return { mcpServers }
}
