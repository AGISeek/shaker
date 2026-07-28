import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"
import { describe, expect, it } from "vitest"

const run = promisify(execFile)

describe("project configuration", () => {
  it("exports a static Next.js site and exposes the required build script", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"))
    const config = await import("../../next.config")

    expect(config.default.output).toBe("export")
    expect(config.default.trailingSlash).toBe(true)
    expect(pkg.scripts["build:site"]).toBe("next build")
  })

  it("allows the e2e runner before browser specs are added", async () => {
    await expect(run("pnpm", ["test:e2e"])).resolves.toMatchObject({})
  })
})
