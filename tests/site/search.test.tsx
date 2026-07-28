import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CommandMenu } from "@/components/site/command-menu"
import { SiteHeader } from "@/components/site/site-header"
import type { SearchDocument } from "@/src/registry/search-index"
import { rankSearch } from "@/src/registry/search"

const docs: SearchDocument[] = [
  {
    name: "approval-card",
    title: "Request approval",
    description: "A card with a button action.",
    type: "registry:block",
    categories: ["workflow"],
    status: "experimental",
    addedAt: "2026-07-29",
    href: "/items/approval-card/",
  },
  {
    name: "button-group",
    title: "Button group",
    description: "Groups related actions.",
    type: "registry:ui",
    categories: ["form"],
    status: "stable",
    addedAt: "2026-07-29",
    href: "/items/button-group/",
  },
  {
    name: "button",
    title: "Button",
    description: "Triggers an action.",
    type: "registry:ui",
    categories: ["form"],
    status: "stable",
    addedAt: "2026-07-29",
    href: "/items/button/",
  },
]

describe("rankSearch", () => {
  it("ranks exact names before title prefixes and description matches", () => {
    expect(rankSearch("button", docs).map((doc) => doc.name)).toEqual([
      "button",
      "button-group",
      "approval-card",
    ])
  })

  it("supports type and status filters before ranking", () => {
    expect(rankSearch("button", docs, { type: "registry:ui", status: "stable" })
      .map((doc) => doc.name)).toEqual(["button", "button-group"])
  })

  it("returns all documents alphabetically for an empty query", () => {
    expect(rankSearch("", docs).map((doc) => doc.name)).toEqual([
      "approval-card",
      "button",
      "button-group",
    ])
  })
})

describe("CommandMenu", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("opens from the shortcut, filters static documents, and exposes navigable results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => docs }))
    render(<SiteHeader />)

    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    const dialog = await screen.findByRole("dialog", { name: "搜索资产" })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /搜索资产/ })).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K")

    await waitFor(() => expect(screen.getAllByRole("option", { name: /Button/ })).toHaveLength(2))
    fireEvent.change(screen.getByRole("combobox", { name: "状态" }), { target: { value: "stable" } })
    expect(screen.queryByRole("option", { name: /Request approval/ })).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: "ArrowDown" })
    const results = within(screen.getByRole("listbox", { name: "搜索结果" })).getAllByRole("option")
    await waitFor(() => expect(results[1]).toHaveAttribute("aria-selected", "true"))
    expect(results[1]).toHaveAttribute("href", "/items/button-group/")
    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByRole("dialog", { name: "搜索资产" })).not.toBeInTheDocument()
  })

  it("navigates the arrow-selected result when Enter is pressed", async () => {
    const onNavigate = vi.fn()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => docs }))
    render(<CommandMenu open onOpenChange={vi.fn()} onNavigate={onNavigate} />)

    await waitFor(() => expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(3))
    fireEvent.change(screen.getByRole("combobox", { name: "状态" }), { target: { value: "stable" } })
    fireEvent.keyDown(window, { key: "ArrowDown" })
    await waitFor(() => expect(within(screen.getByRole("listbox")).getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true"))
    fireEvent.keyDown(window, { key: "Enter" })

    expect(onNavigate).toHaveBeenCalledWith("/items/button-group/")
  })

  it("clears a transient loading error after reopening and retrying", async () => {
    const fetchSearchIndex = vi.fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({ ok: true, json: async () => docs })
    vi.stubGlobal("fetch", fetchSearchIndex)
    const onOpenChange = vi.fn()
    const view = render(<CommandMenu open onOpenChange={onOpenChange} />)

    expect(await screen.findByText("搜索索引加载失败，请稍后重试。")).toBeInTheDocument()
    view.rerender(<CommandMenu open={false} onOpenChange={onOpenChange} />)
    view.rerender(<CommandMenu open onOpenChange={onOpenChange} />)

    await waitFor(() => expect(screen.queryByText("搜索索引加载失败，请稍后重试。")).not.toBeInTheDocument())
    await waitFor(() => expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(3))
    expect(fetchSearchIndex).toHaveBeenCalledTimes(2)
  })
})
