import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { RegistryItem } from "shadcn/schema"
import { describe, expect, it } from "vitest"
import type { UpstreamSource } from "@/src/sync/config"
import { resolveItemUrl } from "@/src/sync/config"
import type { FetchedItem } from "@/src/sync/fetch-item"
import {
  rewriteMirroredDependencies,
  resolveDependencyClosure,
} from "@/src/sync/dependency-closure"

const fixturesDir = join(import.meta.dirname, "../fixtures/upstream")

function source(overrides: Partial<UpstreamSource> = {}): UpstreamSource {
  return {
    id: "shadcn",
    catalog: "https://example.com/r/registry.json",
    itemTemplate: "https://example.com/r/{name}.json",
    items: ["approval-card", "button"],
    pin: { kind: "none" },
    allowDigestPin: true,
    recursiveDependencies: true,
    ...overrides,
  }
}

type FetchRecorder = { calls: string[] }

function fixtureFetcher(
  extra: Record<string, RegistryItem> = {},
): { fetchItem: (source: UpstreamSource, name: string) => Promise<FetchedItem>; calls: FetchRecorder["calls"] } {
  const calls: string[] = []
  const fetchItem = async (src: UpstreamSource, name: string): Promise<FetchedItem> => {
    calls.push(name)
    const inline = extra[name]
    const item =
      inline ??
      (JSON.parse(
        await readFile(join(fixturesDir, `${name}.json`), "utf8"),
      ) as RegistryItem)
    return {
      sourceId: src.id,
      sourceUrl: resolveItemUrl(src, name),
      sourceRef: "test-ref",
      digest: `sha256:${name}`,
      item,
    }
  }
  return { fetchItem, calls }
}

function inlineItem(name: string, registryDependencies?: string[]): RegistryItem {
  return {
    name,
    type: "registry:block",
    ...(registryDependencies ? { registryDependencies } : {}),
  } as RegistryItem
}

describe("resolveDependencyClosure", () => {
  it("mirrors recursive dependencies and rewrites them to @internal", async () => {
    const { fetchItem } = fixtureFetcher()

    const items = await resolveDependencyClosure({
      source: source(),
      roots: ["approval-card"],
      allowedItems: new Set(["approval-card", "button"]),
      fetchItem,
    })

    const approval = items.find(({ item }) => item.name === "approval-card")!.item
    expect(approval.registryDependencies).toEqual(["@internal/button"])
  })

  it("returns each item once, sorted by item name", async () => {
    const { fetchItem, calls } = fixtureFetcher()

    const items = await resolveDependencyClosure({
      source: source(),
      roots: ["button", "approval-card"],
      allowedItems: new Set(["approval-card", "button"]),
      fetchItem,
    })

    expect(items.map(({ item }) => item.name)).toEqual(["approval-card", "button"])
    expect(calls.filter((name) => name === "button")).toHaveLength(1)
  })

  it("fetches a shared dependency only once", async () => {
    const { fetchItem, calls } = fixtureFetcher({
      "card-a": inlineItem("card-a", ["button"]),
      "card-b": inlineItem("card-b", ["button"]),
    })

    const items = await resolveDependencyClosure({
      source: source(),
      roots: ["card-a", "card-b"],
      allowedItems: new Set(["card-a", "card-b"]),
      fetchItem,
    })

    expect(items.map(({ item }) => item.name)).toEqual(["button", "card-a", "card-b"])
    expect(calls.filter((name) => name === "button")).toHaveLength(1)
  })

  it("terminates on dependency cycles without refetching", async () => {
    const { fetchItem, calls } = fixtureFetcher({
      "cycle-a": inlineItem("cycle-a", ["cycle-b"]),
      "cycle-b": inlineItem("cycle-b", ["cycle-a"]),
    })

    const items = await resolveDependencyClosure({
      source: source(),
      roots: ["cycle-a"],
      allowedItems: new Set(["cycle-a"]),
      fetchItem,
    })

    expect(items.map(({ item }) => item.name)).toEqual(["cycle-a", "cycle-b"])
    expect(calls).toEqual(["cycle-a", "cycle-b"])
    const cycleB = items.find(({ item }) => item.name === "cycle-b")!.item
    expect(cycleB.registryDependencies).toEqual(["@internal/cycle-a"])
  })

  it("treats dependencies in the source namespace as local items", async () => {
    const { fetchItem } = fixtureFetcher({
      "namespaced-card": inlineItem("namespaced-card", ["@shadcn/button"]),
    })

    const items = await resolveDependencyClosure({
      source: source({ namespace: "shadcn" }),
      roots: ["namespaced-card"],
      allowedItems: new Set(["namespaced-card"]),
      fetchItem,
    })

    expect(items.map(({ item }) => item.name)).toEqual(["button", "namespaced-card"])
    const card = items.find(({ item }) => item.name === "namespaced-card")!.item
    expect(card.registryDependencies).toEqual(["@internal/button"])
  })

  it("keeps existing @internal dependencies without fetching them", async () => {
    const { fetchItem, calls } = fixtureFetcher({
      "half-mirrored": inlineItem("half-mirrored", ["@internal/button", "button"]),
    })

    const items = await resolveDependencyClosure({
      source: source(),
      roots: ["half-mirrored"],
      allowedItems: new Set(["half-mirrored"]),
      fetchItem,
    })

    expect(calls).toEqual(["half-mirrored", "button"])
    const mirrored = items.find(({ item }) => item.name === "half-mirrored")!.item
    expect(mirrored.registryDependencies).toEqual(["@internal/button"])
  })

  it("rejects a root that is not in the allowlist", async () => {
    const { fetchItem, calls } = fixtureFetcher()

    await expect(
      resolveDependencyClosure({
        source: source(),
        roots: ["approval-card"],
        allowedItems: new Set(["button"]),
        fetchItem,
      }),
    ).rejects.toThrow(/approval-card/)
    expect(calls).toHaveLength(0)
  })

  it("fails the whole operation on URL dependencies", async () => {
    const { fetchItem } = fixtureFetcher()

    await expect(
      resolveDependencyClosure({
        source: source(),
        roots: ["external-dependency"],
        allowedItems: new Set(["external-dependency"]),
        fetchItem,
      }),
    ).rejects.toThrow(/https:\/\/evil\.example\/r\/x\.json/)
  })

  it("fails the whole operation on dependencies from another namespace", async () => {
    const { fetchItem } = fixtureFetcher({
      "foreign-card": inlineItem("foreign-card", ["@other/foo"]),
    })

    await expect(
      resolveDependencyClosure({
        source: source({ namespace: "shadcn" }),
        roots: ["foreign-card"],
        allowedItems: new Set(["foreign-card"]),
        fetchItem,
      }),
    ).rejects.toThrow(/@other\/foo/)
  })

  it("propagates fetch failures instead of returning partial results", async () => {
    const fetchItem = async (src: UpstreamSource, name: string): Promise<FetchedItem> => {
      throw new Error(`boom fetching ${name} from ${src.id}`)
    }

    await expect(
      resolveDependencyClosure({
        source: source(),
        roots: ["approval-card"],
        allowedItems: new Set(["approval-card", "button"]),
        fetchItem,
      }),
    ).rejects.toThrow(/boom fetching approval-card/)
  })
})

describe("rewriteMirroredDependencies", () => {
  it("rewrites bare mirrored names to @internal and keeps the rest", () => {
    const item = inlineItem("card", ["button", "@internal/dialog", "unknown"])

    const rewritten = rewriteMirroredDependencies(item, new Set(["button"]))

    expect(rewritten.registryDependencies).toEqual([
      "@internal/button",
      "@internal/dialog",
      "unknown",
    ])
    expect(item.registryDependencies).toEqual(["button", "@internal/dialog", "unknown"])
  })

  it("returns the item unchanged when it has no registry dependencies", () => {
    const item = inlineItem("button")

    expect(rewriteMirroredDependencies(item, new Set(["button"]))).toBe(item)
  })
})
