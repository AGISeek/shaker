import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AssetIndex } from "@/components/site/asset-index"
import { DocsShell } from "@/components/site/docs-shell"
import { GroupedAssetIndex } from "@/components/site/grouped-asset-index"
import type { InternalRegistryItem } from "@/src/registry/types"
import { filterTemplateItems } from "@/app/templates/page"

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

describe("template and docs indexes", () => {
  it("keeps registry:page assets in the templates directory", () => {
    const pageTemplate = { ...items[0], type: "registry:page" } as InternalRegistryItem
    expect(filterTemplateItems([items[0], pageTemplate])).toEqual([pageTemplate])
  })

  it("puts uncategorized assets in a fallback group", () => {
    const uncategorized = { ...items[0], categories: [] }
    render(<GroupedAssetIndex title="Blocks" description="Blocks" items={[uncategorized]} />)
    expect(screen.getByRole("heading", { name: "未分类" })).toBeInTheDocument()
  })

  it("provides expandable mobile documentation navigation", () => {
    render(<DocsShell navigation={[{ href: "/docs/cli/", label: "CLI 配置" }]} toc={[{ href: "#install", label: "安装资产" }]}><p>内容</p></DocsShell>)
    expect(screen.getByText("文档导航").closest("details")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "CLI 配置" })).toHaveLength(2)
    expect(screen.getAllByRole("link", { name: "安装资产" })).toHaveLength(2)
  })
})
