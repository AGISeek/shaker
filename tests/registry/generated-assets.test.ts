import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { generateAssets } from "@/src/registry/generate"

describe("generateAssets", () => {
  it("creates deterministic preview and search manifests", async () => {
    await generateAssets()
    const preview = await readFile("generated/preview-map.ts", "utf8")
    const search = JSON.parse(await readFile("public/search-index.json", "utf8"))

    expect(preview).toContain(
      '"button": dynamic(() => import("../registry/ui/button/preview"), { ssr: false })',
    )
    expect(search.find((item: { name: string }) => item.name === "button")).toMatchObject({
      name: "button",
      status: "stable",
      href: "/items/button/",
    })
  })
})
