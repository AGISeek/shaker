import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SyncPlan } from "@/src/sync/sync-plan"
import { applySyncPlan } from "@/src/sync/apply-plan"
import { formatSyncReport } from "@/src/sync/report"

const fsControl = vi.hoisted(() => ({
  failFinalRename: false,
  writtenPaths: [] as string[],
}))

vi.mock("@/src/sync/fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/sync/fs")>()
  const rename: typeof actual.rename = async (oldPath, newPath) => {
    // The final swap renames the staged registry onto "<root>/registry"; the
    // rollback rename targets the same path but the flag is already consumed.
    if (fsControl.failFinalRename && String(newPath).split("/").pop() === "registry") {
      fsControl.failFinalRename = false
      throw new Error("Injected rename failure")
    }
    return actual.rename(oldPath, newPath)
  }
  const writeFilePatched: typeof actual.writeFile = async (path, data, options) => {
    fsControl.writtenPaths.push(String(path))
    return actual.writeFile(path, data, options)
  }
  return { ...actual, rename, writeFile: writeFilePatched }
})

const REAL_REGISTRY = join(process.cwd(), "registry")

const WIDGET_SOURCE = 'export function UpstreamWidget() {\n  return <div />\n}\n'
const WIDGET_PREVIEW = 'export default function Preview() {\n  return <div />\n}\n'

const roots: string[] = []

async function makeRepoRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "shaker-apply-plan-"))
  roots.push(root)
  await cp(REAL_REGISTRY, join(root, "registry"), { recursive: true })
  return root
}

beforeEach(() => {
  fsControl.failFinalRename = false
  fsControl.writtenPaths = []
})

afterEach(async () => {
  fsControl.failFinalRename = false
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

/** Recursively captures every file below root as { relativePath: content }. */
async function snapshotTree(root: string): Promise<Record<string, string>> {
  const entries: Record<string, string> = {}
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile()) {
        entries[relative(root, full)] = await readFile(full, "utf8")
      }
    }
  }
  await walk(root)
  return entries
}

function widgetCatalogEntry(): Record<string, unknown> {
  return {
    name: "upstream-widget",
    type: "registry:ui",
    title: "Upstream Widget",
    description: "Synced from upstream.",
    files: [
      {
        path: "upstream-widget/upstream-widget.tsx",
        type: "registry:ui",
        target: "components/ui/upstream-widget.tsx",
      },
    ],
    meta: {
      status: "experimental",
      preview: "registry/ui/upstream-widget/preview.tsx",
      addedAt: "2026-07-30",
      origin: "upstream",
      sourceRef: "v2.0.0",
      sourceDigest: "sha256:new",
      sourceId: "shadcn",
    },
  }
}

async function readUiCatalog(root: string): Promise<Record<string, unknown> & { items: unknown[] }> {
  return JSON.parse(await readFile(join(root, "registry/ui/registry.json"), "utf8"))
}

/** Rewrites the ui catalog, adding the upstream widget and dropping stale-widget. */
async function rewrittenUiCatalog(root: string): Promise<string> {
  const catalog = await readUiCatalog(root)
  const items = [
    ...catalog.items.filter((item) => (item as { name: string }).name !== "stale-widget"),
    widgetCatalogEntry(),
  ].sort((a, b) => ((a as { name: string }).name < (b as { name: string }).name ? -1 : 1))
  return `${JSON.stringify({ ...catalog, items }, null, 2)}\n`
}

/** Installs a stale-widget item directory (with source marker) and catalog entry. */
async function seedStaleWidget(root: string, marker = "shadcn\n"): Promise<void> {
  const dir = join(root, "registry/ui/stale-widget")
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, "stale-widget.tsx"), "export function Stale() {}\n")
  await writeFile(join(dir, "preview.tsx"), WIDGET_PREVIEW)
  await writeFile(join(dir, ".upstream-source"), marker)
  const catalog = await readUiCatalog(root)
  catalog.items.push({
    name: "stale-widget",
    type: "registry:ui",
    title: "Stale Widget",
    description: "Previously synced, now gone upstream.",
    files: [{ path: "stale-widget/stale-widget.tsx", type: "registry:ui" }],
    meta: {
      status: "experimental",
      preview: "registry/ui/stale-widget/preview.tsx",
      addedAt: "2026-07-01",
      origin: "upstream",
      sourceRef: "v1.0.0",
      sourceDigest: "sha256:stale",
      sourceId: "shadcn",
    },
  })
  await writeFile(
    join(root, "registry/ui/registry.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
  )
}

async function happyPathPlan(root: string): Promise<SyncPlan> {
  return {
    sourceId: "shadcn",
    registryItems: [],
    writes: [
      { path: "registry/ui/upstream-widget/upstream-widget.tsx", content: WIDGET_SOURCE },
      { path: "registry/ui/upstream-widget/preview.tsx", content: WIDGET_PREVIEW },
      { path: "registry/ui/upstream-widget/.upstream-source", content: "shadcn\n" },
      { path: "registry/ui/registry.json", content: await rewrittenUiCatalog(root) },
    ],
    deletes: ["registry/ui/stale-widget"],
    summary: {
      added: 3,
      changed: 1,
      removed: 3,
      npmDependencies: [],
      registryDependencies: [],
      digests: [{ item: "upstream-widget", previous: undefined, next: "sha256:new" }],
    },
  }
}

function minimalPlan(overrides: Partial<SyncPlan> = {}): SyncPlan {
  return {
    sourceId: "shadcn",
    registryItems: [],
    writes: [],
    deletes: [],
    summary: {
      added: 0,
      changed: 0,
      removed: 0,
      npmDependencies: [],
      registryDependencies: [],
      digests: [],
    },
    ...overrides,
  }
}

describe("applySyncPlan", () => {
  it("applies writes and deletes and leaves no staging or backup leftovers", async () => {
    const root = await makeRepoRoot()
    await seedStaleWidget(root)

    await applySyncPlan(await happyPathPlan(root), root)

    expect(await readFile(join(root, "registry/ui/upstream-widget/upstream-widget.tsx"), "utf8")).toBe(
      WIDGET_SOURCE,
    )
    expect(await readFile(join(root, "registry/ui/upstream-widget/.upstream-source"), "utf8")).toBe(
      "shadcn\n",
    )
    await expect(readdir(join(root, "registry/ui/stale-widget"))).rejects.toThrow()
    const catalog = await readUiCatalog(root)
    const names = catalog.items.map((item) => (item as { name: string }).name)
    expect(names).toContain("upstream-widget")
    expect(names).not.toContain("stale-widget")
    expect(names).toContain("button")
    const leftovers = (await readdir(root)).filter((entry) => entry.startsWith(".upstream-"))
    expect(leftovers).toEqual([])
  })

  it("leaves the existing tree unchanged when a staged write fails", async () => {
    const root = await makeRepoRoot()
    const invalidPlan = minimalPlan({
      writes: [{ path: "registry/../escape.txt", content: "escape" }],
    })

    const before = await snapshotTree(root)
    await expect(applySyncPlan(invalidPlan, root)).rejects.toThrow()
    expect(await snapshotTree(root)).toEqual(before)
  })

  it("leaves the existing tree unchanged when catalog validation fails", async () => {
    const root = await makeRepoRoot()
    const invalidPlan = minimalPlan({
      writes: [{ path: "registry/ui/registry.json", content: "{ not valid json" }],
    })

    const before = await snapshotTree(root)
    await expect(applySyncPlan(invalidPlan, root)).rejects.toThrow()
    expect(await snapshotTree(root)).toEqual(before)
  })

  it("restores the original registry when the final rename fails", async () => {
    const root = await makeRepoRoot()
    await seedStaleWidget(root)
    fsControl.failFinalRename = true

    const before = await snapshotTree(root)
    await expect(applySyncPlan(await happyPathPlan(root), root)).rejects.toThrow(
      "Injected rename failure",
    )
    expect(await snapshotTree(root)).toEqual(before)
    const leftovers = (await readdir(root)).filter((entry) => entry.startsWith(".upstream-"))
    expect(leftovers).toEqual([])
  })

  it("refuses to delete a directory without a matching source marker", async () => {
    const root = await makeRepoRoot()
    // approval-card is an internal asset: no .upstream-source marker.
    const plan = minimalPlan({ deletes: ["registry/blocks/approval-card"] })

    const before = await snapshotTree(root)
    await expect(applySyncPlan(plan, root)).rejects.toThrow(/Refusing to delete/)
    expect(await snapshotTree(root)).toEqual(before)
  })

  it("refuses to delete a directory whose marker names another source", async () => {
    const root = await makeRepoRoot()
    await seedStaleWidget(root, "other-source\n")
    const plan = minimalPlan({ deletes: ["registry/ui/stale-widget"] })

    const before = await snapshotTree(root)
    await expect(applySyncPlan(plan, root)).rejects.toThrow(/Refusing to delete/)
    expect(await snapshotTree(root)).toEqual(before)
  })

  it("refuses to delete the registry root or the repository root", async () => {
    const root = await makeRepoRoot()

    const before = await snapshotTree(root)
    await expect(applySyncPlan(minimalPlan({ deletes: ["registry"] }), root)).rejects.toThrow()
    await expect(applySyncPlan(minimalPlan({ deletes: ["."] }), root)).rejects.toThrow()
    await expect(applySyncPlan(minimalPlan({ deletes: ["registry/ui"] }), root)).rejects.toThrow()
    expect(await snapshotTree(root)).toEqual(before)
  })

  it("does not rewrite files whose content is already up to date", async () => {
    const root = await makeRepoRoot()
    const buttonPath = join(root, "registry/ui/button/button.tsx")
    const content = await readFile(buttonPath, "utf8")
    const plan = minimalPlan({
      writes: [{ path: "registry/ui/button/button.tsx", content }],
    })

    await applySyncPlan(plan, root)

    expect(await readFile(buttonPath, "utf8")).toBe(content)
    const rewritten = fsControl.writtenPaths.filter((path) =>
      path.endsWith("registry/ui/button/button.tsx"),
    )
    expect(rewritten).toEqual([])
  })
})

describe("formatSyncReport", () => {
  it("renders every section with counts and changes", () => {
    const plan = minimalPlan({
      summary: {
        added: 1,
        changed: 0,
        removed: 0,
        npmDependencies: [],
        registryDependencies: [{ item: "approval-card", added: ["@internal/button"], removed: ["button"] }],
        digests: [{ item: "button", previous: undefined, next: "sha256:abc" }],
      },
    })

    expect(formatSyncReport(plan)).toBe(
      [
        "Source: shadcn",
        "Added files: 1",
        "Changed files: 0",
        "Removed files: 0",
        "NPM dependency changes:",
        "- none",
        "Registry dependency changes:",
        "- approval-card: button -> @internal/button",
        "Digest changes:",
        "- button: new -> sha256:abc",
      ].join("\n"),
    )
  })

  it("renders npm dependency changes and digest updates", () => {
    const plan = minimalPlan({
      summary: {
        added: 0,
        changed: 2,
        removed: 1,
        npmDependencies: [{ item: "button", added: ["@radix-ui/react-slot"], removed: [] }],
        registryDependencies: [],
        digests: [{ item: "button", previous: "sha256:old", next: "sha256:new" }],
      },
    })

    expect(formatSyncReport(plan)).toBe(
      [
        "Source: shadcn",
        "Added files: 0",
        "Changed files: 2",
        "Removed files: 1",
        "NPM dependency changes:",
        "- button: none -> @radix-ui/react-slot",
        "Registry dependency changes:",
        "- none",
        "Digest changes:",
        "- button: sha256:old -> sha256:new",
      ].join("\n"),
    )
  })
})
