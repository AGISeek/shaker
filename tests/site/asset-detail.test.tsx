import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AssetDetail } from "@/components/site/asset-detail"
import type { InternalRegistryItem } from "@/src/registry/types"

const item: InternalRegistryItem = {
  name: "button",
  type: "registry:ui",
  title: "Button",
  description: "A reusable action trigger.",
  categories: ["ui"],
  docs: "https://internal.example/docs/button",
  files: [],
  registryDependencies: ["@internal/icon"],
  meta: {
    status: "deprecated",
    preview: "registry/ui/button/preview.tsx",
    addedAt: "2026-07-29",
    origin: "internal",
    sourceRef: "main",
    replacedBy: "new-button",
  },
}

describe("AssetDetail", () => {
  it("renders documentation in the required order with deprecation guidance", () => {
    const { container } = render(<AssetDetail item={item} sources={[{ path: "button.tsx", content: "export {}" }]} />)
    const text = container.textContent ?? ""

    for (const label of ["Preview", "Code", "Installation", "Usage", "Examples", "Dependencies", "Docs"]) {
      expect(text.indexOf(label)).toBeGreaterThan(-1)
    }
    expect(text.indexOf("Preview")).toBeLessThan(text.indexOf("Code"))
    expect(text.indexOf("Code")).toBeLessThan(text.indexOf("Installation"))
    expect(text.indexOf("Installation")).toBeLessThan(text.indexOf("Usage"))
    expect(screen.getByText("此资产已弃用")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "new-button" })).toHaveAttribute("href", "/items/new-button/")
    expect(screen.getByText("pnpm dlx shadcn@latest add @internal/button")).toBeInTheDocument()
  })

  it("shows the empty documentation state", () => {
    render(<AssetDetail item={{ ...item, meta: { ...item.meta, status: "stable", replacedBy: undefined }, docs: undefined }} sources={[]} />)
    expect(screen.getByText("暂无补充文档")).toBeInTheDocument()
  })
})
