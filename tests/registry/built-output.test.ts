import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("built registry output", () => {
  it("builds a flat catalog and item payloads", async () => {
    const catalog = JSON.parse(await readFile("public/r/registry.json", "utf8"))
    const button = JSON.parse(await readFile("public/r/button.json", "utf8"))

    expect(catalog.include).toBeUndefined()
    expect(catalog.items.map((item: { name: string }) => item.name)).toContain("button")
    expect(button.files[0].content).toContain("export")
  })
})
