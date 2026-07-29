import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"
import { beforeAll, describe, expect, it } from "vitest"

const run = promisify(execFile)

describe("built registry output", () => {
  beforeAll(async () => {
    await run("pnpm", ["registry:build"])
  })

  it("builds a flat catalog and item payloads", async () => {
    const catalog = JSON.parse(await readFile("public/r/registry.json", "utf8"))
    const button = JSON.parse(await readFile("public/r/button.json", "utf8"))

    expect(catalog.include).toBeUndefined()
    expect(catalog.items.map((item: { name: string }) => item.name)).toContain("button")
    expect(button.files[0].content).toContain("export")
  })
})
