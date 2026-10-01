import { afterAll, describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Value } from "@sinclair/typebox/value"
import registerBundledExtension from "../extensions/compound-engineering-compat"
import { PI_COMPAT_EXTENSION_SOURCE } from "../src/templates/pi/compat-extension"

// Import the generated extension too: source-string assertions cannot catch runtime regressions.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-test-"))
const generatedPath = path.join(tempDir, "generated-extension.ts")
fs.writeFileSync(generatedPath, PI_COMPAT_EXTENSION_SOURCE)
fs.symlinkSync(path.join(import.meta.dir, "..", "node_modules"), path.join(tempDir, "node_modules"), "dir")
const registerGeneratedExtension = (await import(pathToFileURL(generatedPath).href)).default
const cwd = path.join(tempDir, "project with 'quotes'")
fs.mkdirSync(cwd)
fs.mkdirSync(path.join(cwd, "child directory"))
afterAll(() => fs.rmSync(tempDir, { recursive: true, force: true }))

type Task = { agent: string; task: string; cwd?: string; model?: string }
type Params = {
  agent?: string
  task?: string
  cwd?: string
  model?: string
  tasks?: Task[]
  chain?: Task[]
  maxConcurrency?: number
  timeoutMs?: number
  includeOutputs?: boolean
}
type Result = {
  isError?: boolean
  content: { type: string; text: string }[]
  details: { mode?: string; results?: { output: string; exitCode: number }[] }
}
type ExecOptions = { signal?: AbortSignal; timeout?: number }
type Tool = {
  name: string
  parameters: Parameters<typeof Value.Check>[0]
  execute: (id: string, params: Params, signal: AbortSignal | undefined, onUpdate: undefined, ctx: { cwd: string }) => Promise<Result>
}
type Call = { cwd: string; argv: string[]; options: ExecOptions }

function createHarness(register: typeof registerBundledExtension, exitCodes: number[] = []) {
  const tools: Tool[] = []
  const calls: Call[] = []
  const pi = {
    registerTool: (tool: Tool) => tools.push(tool),
    exec: async (command: string, args: string[], options: ExecOptions) => {
      expect(command).toBe("bash")
      expect(args[0]).toBe("-lc")
      // Run the real shell command, replacing only the paid Pi call with a function.
      // NUL-delimited output lets us inspect exact argument boundaries and cwd.
      const proc = Bun.spawn(["bash", "-c", "pi() { printf '%s\\0' \"$PWD\" \"$@\"; }; " + args[1]], {
        stdout: "pipe",
        stderr: "pipe",
      })
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ])
      expect(exitCode).toBe(0)
      expect(stderr).toBe("")
      const [actualCwd, ...argv] = stdout.split("\0").slice(0, -1)
      calls.push({ cwd: actualCwd, argv, options })
      const index = calls.length - 1
      return { code: exitCodes[index] ?? 0, stdout: `output-${index + 1}`, stderr: "" }
    },
  }
  // Registration must not depend on the developer's installed pi-subagents package.
  const home = spyOn(os, "homedir").mockReturnValue(tempDir)
  try {
    register(pi as unknown as Parameters<typeof registerBundledExtension>[0])
  } finally {
    home.mockRestore()
  }
  const tool = tools.find((item) => item.name === "subagent")!
  expect(tool).toBeDefined()
  return {
    tool,
    calls,
    run: (params: Params, signal?: AbortSignal) => {
      expect(Value.Check(tool.parameters, params)).toBe(true)
      return tool.execute("test-call", params, signal, undefined, { cwd })
    },
  }
}

test("bundled and generated Pi compatibility extensions stay identical", () => {
  const bundled = fs.readFileSync(path.join(import.meta.dir, "..", "extensions", "compound-engineering-compat.ts"), "utf8")
  expect(bundled.trim()).toBe(PI_COMPAT_EXTENSION_SOURCE.trim())
})

for (const [name, register] of [
  ["bundled", registerBundledExtension],
  ["generated", registerGeneratedExtension],
] as const) {
  describe(`${name} subagent model selection`, () => {
    test("single mode trims and forwards provider/model and thinking suffix as one argument", async () => {
      const h = createHarness(register)
      const signal = new AbortController().signal
      const result = await h.run({ agent: "reviewer", task: "Check tests", model: "  openai/gpt-5:high  ", timeoutMs: 1234 }, signal)
      expect(result.isError).toBe(false)
      expect(result.details.mode).toBe("single")
      expect(h.calls).toHaveLength(1)
      expect(h.calls[0]).toEqual({
        cwd,
        argv: ["--no-session", "--model", "openai/gpt-5:high", "-p", "/skill:reviewer Check tests"],
        options: { signal, timeout: 1234 },
      })
    })

    test("single mode accepts fuzzy model names and resolves task cwd", async () => {
      const h = createHarness(register)
      await h.run({ agent: "scout", task: "Inspect", cwd: "child directory", model: "haiku" })
      expect(h.calls[0].cwd).toBe(path.join(cwd, "child directory"))
      expect(h.calls[0].argv).toEqual(["--no-session", "--model", "haiku", "-p", "/skill:scout Inspect"])
    })

    for (const model of [undefined, "", " \t\n "]) {
      test(`single mode omits --model for ${JSON.stringify(model)}`, async () => {
        const h = createHarness(register)
        await h.run({ agent: "scout", task: "Inspect", model })
        expect(h.calls[0].argv).toEqual(["--no-session", "-p", "/skill:scout Inspect"])
      })
    }

    test("parallel tasks inherit the root model, allow overrides, and can clear the default", async () => {
      const h = createHarness(register)
      const params = {
        model: "  sonnet  ",
        tasks: [
          { agent: "scout", task: "Inspect" },
          { agent: "reviewer", task: "Review", model: "  openai/gpt-5  " },
          { agent: "worker", task: "Work", model: " \t " },
          { agent: "planner", task: "Plan", model: "" },
        ],
      }
      const original = structuredClone(params)
      const result = await h.run(params)
      expect(result.isError).toBe(false)
      expect(result.details.mode).toBe("parallel")
      const argvByPrompt = new Map(h.calls.map((call) => [call.argv.at(-1), call.argv]))
      expect(argvByPrompt.get("/skill:scout Inspect")).toEqual(["--no-session", "--model", "sonnet", "-p", "/skill:scout Inspect"])
      expect(argvByPrompt.get("/skill:reviewer Review")).toEqual(["--no-session", "--model", "openai/gpt-5", "-p", "/skill:reviewer Review"])
      expect(argvByPrompt.get("/skill:worker Work")).toEqual(["--no-session", "-p", "/skill:worker Work"])
      expect(argvByPrompt.get("/skill:planner Plan")).toEqual(["--no-session", "-p", "/skill:planner Plan"])
      expect(params).toEqual(original)
    })

    test("chain steps preserve model overrides and previous output substitution", async () => {
      const h = createHarness(register)
      const result = await h.run({
        model: "sonnet",
        chain: [
          { agent: "scout", task: "Inspect" },
          { agent: "reviewer", task: "Review {previous}", model: "  openai/gpt-5  " },
          { agent: "planner", task: "Plan {previous}", model: "" },
          { agent: "worker", task: "Work {previous}", model: " \t " },
          { agent: "reviewer", task: "Finish {previous}" },
        ],
      })
      expect(result.isError).toBe(false)
      expect(result.details.mode).toBe("chain")
      expect(h.calls.map((call) => call.argv)).toEqual([
        ["--no-session", "--model", "sonnet", "-p", "/skill:scout Inspect"],
        ["--no-session", "--model", "openai/gpt-5", "-p", "/skill:reviewer Review output-1"],
        ["--no-session", "-p", "/skill:planner Plan output-2"],
        ["--no-session", "-p", "/skill:worker Work output-3"],
        ["--no-session", "--model", "sonnet", "-p", "/skill:reviewer Finish output-4"],
      ])
      expect(result.content[0].text).toContain("Final output:\noutput-5")
    })

    for (const mode of ["tasks", "chain"] as const) {
      test(`${mode} keeps existing default-model behavior when no model is supplied`, async () => {
        const h = createHarness(register)
        await h.run({ [mode]: [{ agent: "scout", task: "Inspect" }, { agent: "reviewer", task: "Review" }] })
        expect(h.calls).toHaveLength(2)
        expect(h.calls.every((call) => !call.argv.includes("--model"))).toBe(true)
      })
    }

    test("model and prompt shell metacharacters remain literal, not executable", async () => {
      const h = createHarness(register)
      const marker = path.join(tempDir, `${name}-injected`)
      const model = `vendor/model'; touch '${marker}'; #`
      const task = `Inspect $(touch '${marker}') and 'quotes'`
      const result = await h.run({ agent: "reviewer", task, model })
      expect(result.isError).toBe(false)
      expect(h.calls[0].argv).toEqual(["--no-session", "--model", model, "-p", "/skill:reviewer " + task])
      expect(fs.existsSync(marker)).toBe(false)
    })

    test("a failed chain step stops execution and reports failure", async () => {
      const h = createHarness(register, [1])
      const result = await h.run({
        model: "sonnet",
        chain: [{ agent: "scout", task: "Inspect" }, { agent: "reviewer", task: "Review" }],
      })
      expect(result.isError).toBe(true)
      expect(h.calls).toHaveLength(1)
      expect(result.details.results?.[0].exitCode).toBe(1)
    })

    test("the registered schema rejects non-string models in every mode", () => {
      const h = createHarness(register)
      for (const params of [
        { agent: "scout", task: "Inspect", model: 42 },
        { tasks: [{ agent: "scout", task: "Inspect", model: 42 }] },
        { chain: [{ agent: "scout", task: "Inspect", model: 42 }] },
      ]) {
        expect(Value.Check(h.tool.parameters, params)).toBe(false)
      }
    })
  })
}
