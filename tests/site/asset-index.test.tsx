import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AssetIndex } from "@/components/site/asset-index"
import type { InternalRegistryItem } from "@/src/registry/types"

const items: InternalRegistryItem[] = [
  {
    name: "button",
    type: "registry:ui",
    title: "Button",
    description: "A button for internal interfaces.",
    categories: ["ui"],
    files: [],
    meta: {
      status: "stable",
      preview: "registry/ui/button/preview.tsx",
      addedAt: "2026-07-29",
      origin: "internal",
      sourceRef: "main",
    },
  },
]

describe("AssetIndex", () => {
  it("separates recently added assets from the alphabetical index", () => {
    render(<AssetIndex title="Components" description="Internal components" items={items} />)

    expect(screen.getByRole("heading", { name: "最近新增" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "全部组件" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Button" })).toHaveAttribute("href", "/items/button/")
  })
})
