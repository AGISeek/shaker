import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { generateAssets } from "@/src/registry/generate"

describe("generateAssets", () => {
  it("creates deterministic preview and search manifests", async () => {
    await generateAssets()
    const firstPreview = await readFile("generated/preview-map.ts", "utf8")
    const firstSearch = await readFile("public/search-index.json", "utf8")
    const search = JSON.parse(firstSearch)

    expect(firstPreview).toContain(
      '"button": dynamic(() => import("../registry/ui/button/preview"), { ssr: false })',
    )
    expect(search.find((item: { name: string }) => item.name === "button")).toMatchObject({
      name: "button",
      status: "stable",
      href: "/items/button/",
    })
    expect(firstSearch).toMatch(/\n$/)

    await generateAssets()

    await expect(readFile("generated/preview-map.ts", "utf8")).resolves.toBe(firstPreview)
    await expect(readFile("public/search-index.json", "utf8")).resolves.toBe(firstSearch)
  })
})
