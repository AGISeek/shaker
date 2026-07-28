import { describe, expect, it } from "vitest"
import { loadRegistryItem } from "shadcn/registry"
import { loadCatalog } from "@/src/registry/catalog"

describe("loadCatalog", () => {
  it("resolves includes and returns the button item", async () => {
    const items = await loadCatalog()
    expect(items.map((item) => item.name)).toEqual(["button"])
    expect(items[0]?.meta).toMatchObject({
      status: "stable",
      preview: "registry/ui/button/preview.tsx",
      addedAt: "2026-07-29",
    })
  })

  it("loads the button source files through the public loader", async () => {
    const item = await loadRegistryItem("button", {
      cwd: process.cwd(),
      registryFile: "registry/registry.json",
    })

    expect(item.files?.map((file) => file.path)).toEqual([
      "ui/button/button.tsx",
      "ui/button/preview.tsx",
    ])
    expect(item.files?.[0]?.content).toContain("export function Button")
  })
})
