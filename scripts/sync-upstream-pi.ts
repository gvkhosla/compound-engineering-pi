import { mkdtemp, rm, cp } from "fs/promises"
import os from "os"
import path from "path"

const repoRoot = path.resolve(import.meta.dir, "..")
const sourceRoot = process.env.COMPOUND_PLUGIN_SOURCE
  ? path.resolve(process.env.COMPOUND_PLUGIN_SOURCE)
  : path.resolve(repoRoot, "../compound-engineering-plugin")

const sourcePluginDir = path.join(sourceRoot, "plugins", "compound-engineering")
const targetPluginDir = path.join(repoRoot, "plugins", "compound-engineering")
const generatedRoot = await mkdtemp(path.join(os.tmpdir(), "compound-engineering-pi-sync-"))

try {
  await run("bun", [
    "run",
    "src/index.ts",
    "install",
    "./plugins/compound-engineering",
    "--to",
    "pi",
    "--pi-home",
    generatedRoot,
  ], sourceRoot)

  const generatedPiRoot = path.join(generatedRoot, ".pi")
  const generatedSkillsDir = path.join(generatedPiRoot, "skills")
  const generatedMcporterPath = path.join(generatedPiRoot, "compound-engineering", "mcporter.json")

  console.log(`Syncing vendored plugin snapshot from ${sourcePluginDir}`)
  await replaceDir(targetPluginDir, sourcePluginDir)

  console.log(`Syncing generated Pi skills from ${generatedSkillsDir}`)
  await replaceDir(path.join(repoRoot, "skills"), generatedSkillsDir)

  console.log(`Syncing bundled MCPorter config from ${generatedMcporterPath}`)
  await copyFileToPath(generatedMcporterPath, path.join(repoRoot, "pi-resources", "compound-engineering", "mcporter.json"))

  console.log("Done. Note: prompts/ and extensions/ are preserved for Pi-specific compatibility and docs.")
} finally {
  await rm(generatedRoot, { recursive: true, force: true })
}

async function run(command: string, args: string[], cwd: string) {
  console.log(`$ (cd ${cwd} && ${[command, ...args].join(" ")})`)
  const proc = Bun.spawn([command, ...args], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  })

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`${command} exited with code ${exitCode}`)
  }
}

async function replaceDir(target: string, source: string) {
  await rm(target, { recursive: true, force: true })
  await cp(source, target, { recursive: true })
}

async function copyFileToPath(source: string, target: string) {
  await rm(target, { force: true })
  await cp(source, target)
}
