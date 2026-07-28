import { execFile as execFileCallback } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"
import { describe, expect, it } from "vitest"

const execFile = promisify(execFileCallback)

describe("static preview export", () => {
  it("exports an isolated preview document instead of a 404 page", async () => {
    await execFile("pnpm", ["registry:generate"], { cwd: process.cwd() })
    await execFile("pnpm", ["build:site"], { cwd: process.cwd() })
    const html = await readFile("out/preview/button/index.html", "utf8")

    expect(html).toContain("preview-host")
    expect(html).not.toContain("__next_error__")
    expect(html).not.toContain("site-header")
    expect(html).not.toContain("site-footer")
    expect(html).not.toContain("site-main")
  }, 120_000)
})
