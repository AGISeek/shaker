import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("project configuration", () => {
  it("exports a static Next.js site and exposes the required build script", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"))
    const config = await import("../../next.config")

    expect(config.default.output).toBe("export")
    expect(config.default.trailingSlash).toBe(true)
    expect(pkg.scripts["build:site"]).toBe("next build")
  })

  it("exposes the browser regression command", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"))
    expect(pkg.scripts["test:e2e"]).toBe("playwright test")
  })
})
