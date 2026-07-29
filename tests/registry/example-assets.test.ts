import { describe, expect, it } from "vitest"
import { loadRegistryItem } from "shadcn/registry"
import { loadCatalog } from "@/src/registry/catalog"
import { assertValidCatalog } from "@/src/registry/validate"

describe("example registry assets", () => {
  it("contains one valid item for each supported asset class", async () => {
    const items = await loadCatalog()

    expect(items.map(({ name, type }) => [name, type])).toEqual(
      expect.arrayContaining([
        ["button", "registry:ui"],
        ["approval-card", "registry:block"],
        ["admin-dashboard", "registry:page"],
      ]),
    )
    await expect(assertValidCatalog(items)).resolves.toBeUndefined()
  })

  it("provides installable files and internal dependencies for the examples", async () => {
    const approvalCard = await loadRegistryItem("approval-card", {
      cwd: process.cwd(),
      registryFile: "registry/registry.json",
    })
    const dashboard = await loadRegistryItem("admin-dashboard", {
      cwd: process.cwd(),
      registryFile: "registry/registry.json",
    })

    expect(approvalCard.registryDependencies).toEqual(["@internal/button"])
    expect(approvalCard.files?.[0]).toMatchObject({ target: "components/approval-card.tsx" })
    expect(approvalCard.files?.[0]?.content).toContain('from "@/components/ui/button"')
    expect(dashboard.registryDependencies).toEqual(["@internal/approval-card"])
    expect(dashboard.files?.[0]).toMatchObject({ target: "app/admin/page.tsx" })
    expect(dashboard.files?.[0]?.content).toContain('from "@/components/approval-card"')
  })
})
