import { describe, expect, test } from "bun:test"
import { formatFrontmatter, parseFrontmatter } from "../src/utils/frontmatter"

describe("frontmatter", () => {
  test("parseFrontmatter returns body when no frontmatter", () => {
    const raw = "Hello\nWorld"
    const result = parseFrontmatter(raw)
    expect(result.data).toEqual({})
    expect(result.body).toBe(raw)
  })

  test("formatFrontmatter round trips", () => {
    const body = "Body text"
    const formatted = formatFrontmatter({ name: "agent", description: "Test" }, body)
    const parsed = parseFrontmatter(formatted)
    expect(parsed.data.name).toBe("agent")
    expect(parsed.data.description).toBe("Test")
    expect(parsed.body.trim()).toBe(body)
  })
})
