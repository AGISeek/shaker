import { describe, expect, it } from "vitest"
import { loadCatalog } from "@/src/registry/catalog"

describe("loadCatalog", () => {
  it("resolves includes and returns the button item", async () => {
    const items = await loadCatalog()
    expect(items.map((item) => item.name)).toContain("button")
    expect(items.find((item) => item.name === "button")?.meta).toMatchObject({
      status: "stable",
      preview: "registry/ui/button/preview.tsx",
      addedAt: "2026-07-29",
    })
  })
})
