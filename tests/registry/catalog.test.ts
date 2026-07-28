import { describe, expect, it } from "vitest"
import { loadRegistryItem } from "shadcn/registry"
import { loadCatalog } from "@/src/registry/catalog"

describe("loadCatalog", () => {
  it("resolves included registry items", async () => {
    const items = await loadCatalog()
    expect(items.map((item) => item.name)).toEqual(["button", "approval-card", "admin-dashboard"])
    expect(items.find((item) => item.name === "button")?.meta).toMatchObject({
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

    expect(item.files?.map((file) => file.path)).toEqual(["ui/button/button.tsx"])
    expect(item.files?.[0]?.content).toContain("export function Button")
  })
})
