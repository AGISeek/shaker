import { describe, expect, it } from "vitest"
import type { RegistryItem } from "shadcn/schema"
import type { FetchedItem } from "@/src/sync/fetch-item"
import { DigestApprovalRequiredError } from "@/src/sync/normalize"
import { createSyncPlan } from "@/src/sync/sync-plan"
import type { CreateSyncPlanOptions } from "@/src/sync/sync-plan"
import type { InternalRegistryItem } from "@/src/registry/types"

const BUTTON_CONTENT =
  'import * as React from "react"\n\nexport function Button() {\n  return <button />\n}\n'

type FileEntry = NonNullable<RegistryItem["files"]>[number]

function buttonFile(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    path: "ui/button.tsx",
    type: "registry:ui",
    target: "components/ui/button.tsx",
    content: BUTTON_CONTENT,
    ...overrides,
  } as FileEntry
}

function fetchedButton(
  overrides: Partial<FetchedItem> = {},
  itemOverrides: Partial<RegistryItem> = {},
): FetchedItem {
  return {
    sourceId: "shadcn",
    sourceUrl: "https://example.com/r/button.json",
    sourceRef: "v2.0.0",
    digest: "sha256:new",
    item: {
      name: "button",
      type: "registry:ui",
      title: "Button",
      description: "Displays a button or a component that looks like a button.",
      dependencies: ["@radix-ui/react-slot"],
      files: [buttonFile()],
      ...itemOverrides,
    } as RegistryItem,
    ...overrides,
  }
}

function managedExistingItem(overrides: Partial<InternalRegistryItem> = {}): InternalRegistryItem {
  return {
    name: "button",
    type: "registry:ui",
    title: "Button",
    description: "Previous synced version.",
    dependencies: [],
    files: [{ path: "ui/button/button.tsx", type: "registry:ui", target: "components/ui/button.tsx" }],
    ...overrides,
    meta: {
      status: "stable",
      preview: "registry/ui/button/preview.tsx",
      addedAt: "2026-01-15",
      origin: "upstream",
      sourceRef: "v1.0.0",
      sourceDigest: "sha256:old",
      sourceId: "shadcn",
      ...overrides.meta,
    },
  } as InternalRegistryItem
}

function internalExistingItem(overrides: Partial<InternalRegistryItem> = {}): InternalRegistryItem {
  return {
    name: "approval-card",
    type: "registry:block",
    title: "Approval Card",
    description: "Internal block.",
    files: [
      {
        path: "blocks/approval-card/approval-card.tsx",
        type: "registry:block",
        target: "components/approval-card.tsx",
      },
    ],
    ...overrides,
    meta: {
      status: "stable",
      preview: "registry/blocks/approval-card/preview.tsx",
      addedAt: "2026-07-29",
      origin: "internal",
      sourceRef: "main",
      ...overrides.meta,
    },
  } as InternalRegistryItem
}

function options(overrides: Partial<CreateSyncPlanOptions> = {}): CreateSyncPlanOptions {
  return {
    registryRoot: "registry",
    existingFiles: new Map(),
    existingItems: [],
    acceptedDigests: new Map(),
    syncDate: "2026-07-29",
    ...overrides,
  }
}

function writeMap(plan: { writes: { path: string; content: string }[] }): Map<string, string> {
  return new Map(plan.writes.map((write) => [write.path, write.content]))
}

describe("createSyncPlan normalization", () => {
  it("splits embedded contents and records provenance", () => {
    const fetched = fetchedButton()
    const plan = createSyncPlan([fetched], options())

    expect(plan.writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "registry/ui/button/button.tsx",
          content: expect.stringContaining("export"),
        }),
      ]),
    )
    expect(plan.registryItems[0].meta).toMatchObject({
      origin: "upstream",
      sourceRef: fetched.sourceRef,
      sourceDigest: fetched.digest,
    })
  })

  it("strips content from local files and keeps type and target", () => {
    const plan = createSyncPlan([fetchedButton()], options())

    expect(plan.registryItems[0].files).toEqual([
      { path: "ui/button/button.tsx", type: "registry:ui", target: "components/ui/button.tsx" },
    ])
  })

  it("marks new entries as experimental with the sync date and managed preview", () => {
    const plan = createSyncPlan([fetchedButton()], options())

    expect(plan.registryItems[0].meta).toMatchObject({
      status: "experimental",
      addedAt: "2026-07-29",
      sourceId: "shadcn",
      preview: "registry/ui/button/preview.tsx",
    })
  })

  it("maps item types to fixed categories", () => {
    const block = fetchedButton({ sourceUrl: "https://example.com/r/card.json" }, {
      name: "card",
      type: "registry:block",
      files: [buttonFile({ path: "blocks/card.tsx", type: "registry:block" })],
    })
    const page = fetchedButton({ sourceUrl: "https://example.com/r/dashboard.json" }, {
      name: "dashboard",
      type: "registry:page",
      files: [buttonFile({ path: "templates/dashboard/page.tsx", type: "registry:page" })],
    })
    const component = fetchedButton({ sourceUrl: "https://example.com/r/chip.json" }, {
      name: "chip",
      type: "registry:component",
      files: [buttonFile({ path: "ui/chip.tsx", type: "registry:component" })],
    })

    const plan = createSyncPlan([block, page, component], options())
    const paths = plan.writes.map((write) => write.path)

    expect(paths).toContain("registry/blocks/card/card.tsx")
    expect(paths).toContain("registry/templates/dashboard/page.tsx")
    expect(paths).toContain("registry/ui/chip/chip.tsx")
  })

  it("fails item types outside the fixed category mapping", () => {
    const fetched = fetchedButton({}, { type: "registry:theme" as RegistryItem["type"] })

    expect(() => createSyncPlan([fetched], options())).toThrow(/unsupported type/i)
  })

  it("writes a controlled empty-state preview for synced items", () => {
    const plan = createSyncPlan([fetchedButton()], options())
    const writes = writeMap(plan)
    const preview = writes.get("registry/ui/button/preview.tsx")

    expect(preview).toBeDefined()
    expect(preview).toContain("export default")
    expect(preview).toContain("该上游资产尚未配置内部预览")
  })

  it("does not overwrite an existing preview", () => {
    const plan = createSyncPlan(
      [fetchedButton()],
      options({ existingFiles: new Map([["registry/ui/button/preview.tsx", "// custom preview"]]) }),
    )

    expect(writeMap(plan).get("registry/ui/button/preview.tsx")).toBeUndefined()
  })

  it("writes a source id marker into each synced item directory", () => {
    const plan = createSyncPlan([fetchedButton()], options())

    expect(writeMap(plan).get("registry/ui/button/.upstream-source")).toBe("shadcn\n")
  })
})

describe("createSyncPlan path safety", () => {
  it.each([
    ["absolute path", "/etc/passwd"],
    ["windows absolute path", "C:\\windows\\system32\\evil.ts"],
    ["parent traversal", "../evil.ts"],
    ["nested parent traversal", "ui/../../evil.ts"],
    ["empty path", ""],
    ["category prefix only", "ui"],
  ])("rejects %s and produces no plan", (_label, path) => {
    const fetched = fetchedButton({}, { files: [buttonFile({ path })] })

    expect(() => createSyncPlan([fetched], options())).toThrow()
  })

  it("requires embedded content for every file", () => {
    const fetched = fetchedButton({}, { files: [{ path: "ui/button.tsx", type: "registry:ui" }] })

    expect(() => createSyncPlan([fetched], options())).toThrow(/content/)
  })

  it("rejects files that would collide with the managed preview entry", () => {
    const fetched = fetchedButton({}, { files: [buttonFile({ path: "ui/preview.tsx" })] })

    expect(() => createSyncPlan([fetched], options())).toThrow(/preview/)
  })

  it("rejects upstream paths that collapse to the same local file", () => {
    const fetched = fetchedButton({}, {
      files: [
        buttonFile({ path: "ui/button.tsx" }),
        buttonFile({ path: "button/button.tsx" }),
      ],
    })

    expect(() => createSyncPlan([fetched], options())).toThrow(/duplicate/i)
  })
})

describe("createSyncPlan digest approval", () => {
  it("throws DigestApprovalRequiredError when the digest changed without acceptance", () => {
    const error = (() => {
      try {
        createSyncPlan(
          [fetchedButton({ digest: "sha256:new" })],
          options({ existingItems: [managedExistingItem()] }),
        )
        return null
      } catch (caught) {
        return caught
      }
    })()

    expect(error).toBeInstanceOf(DigestApprovalRequiredError)
    const approvalError = error as DigestApprovalRequiredError
    expect(approvalError.itemName).toBe("button")
    expect(approvalError.previousDigest).toBe("sha256:old")
    expect(approvalError.newDigest).toBe("sha256:new")
  })

  it("proceeds when the new digest is explicitly accepted", () => {
    const plan = createSyncPlan(
      [fetchedButton({ digest: "sha256:new" })],
      options({
        existingItems: [managedExistingItem()],
        acceptedDigests: new Map([["button", "sha256:new"]]),
      }),
    )

    expect(plan.registryItems[0].meta.sourceDigest).toBe("sha256:new")
  })

  it("does not require acceptance when the digest is unchanged", () => {
    const plan = createSyncPlan(
      [fetchedButton({ digest: "sha256:old" })],
      options({ existingItems: [managedExistingItem()] }),
    )

    expect(plan.registryItems).toHaveLength(1)
  })

  it("preserves addedAt and status when updating an existing entry", () => {
    const plan = createSyncPlan(
      [fetchedButton({ digest: "sha256:old" })],
      options({ existingItems: [managedExistingItem()] }),
    )

    expect(plan.registryItems[0].meta).toMatchObject({
      addedAt: "2026-01-15",
      status: "stable",
    })
  })

  it("refuses to replace assets not managed by this source", () => {
    const internal = internalExistingItem({ name: "button", type: "registry:ui" })

    expect(() =>
      createSyncPlan([fetchedButton()], options({ existingItems: [internal] })),
    ).toThrow(/not managed by source/i)
  })
})

describe("createSyncPlan writes and deletes", () => {
  it("skips writes whose content already exists unchanged", () => {
    const plan = createSyncPlan(
      [fetchedButton()],
      options({
        existingFiles: new Map([["registry/ui/button/button.tsx", BUTTON_CONTENT]]),
      }),
    )
    const paths = plan.writes.map((write) => write.path)

    expect(paths).not.toContain("registry/ui/button/button.tsx")
  })

  it("rewrites files whose content changed and counts them in the summary", () => {
    const plan = createSyncPlan(
      [fetchedButton()],
      options({
        existingFiles: new Map([["registry/ui/button/button.tsx", "outdated"]]),
      }),
    )

    expect(writeMap(plan).get("registry/ui/button/button.tsx")).toBe(BUTTON_CONTENT)
    expect(plan.summary.changed).toBe(1)
  })

  it("counts newly added files in the summary", () => {
    const plan = createSyncPlan([fetchedButton()], options())

    // button.tsx, preview.tsx, .upstream-source, registry.json
    expect(plan.summary.added).toBe(4)
    expect(plan.summary.changed).toBe(0)
    expect(plan.summary.removed).toBe(0)
  })

  it("deletes item directories previously managed by this source that are gone upstream", () => {
    const stale = managedExistingItem({ name: "stale-widget" })
    const plan = createSyncPlan(
      [fetchedButton()],
      options({
        existingItems: [managedExistingItem(), stale],
        existingFiles: new Map([
          ["registry/ui/stale-widget/stale-widget.tsx", "old"],
          ["registry/ui/stale-widget/preview.tsx", "old"],
        ]),
        acceptedDigests: new Map([["button", "sha256:new"]]),
      }),
    )

    expect(plan.deletes).toEqual(["registry/ui/stale-widget"])
    expect(plan.summary.removed).toBe(2)
  })

  it("never deletes internal or other-source assets", () => {
    const otherSource = managedExistingItem({ name: "other" })
    otherSource.meta.sourceId = "other-registry"
    const plan = createSyncPlan(
      [fetchedButton()],
      options({ existingItems: [internalExistingItem(), otherSource] }),
    )

    expect(plan.deletes).toEqual([])
  })

  it("deletes the old directory when an item changes category", () => {
    const existing = managedExistingItem({ type: "registry:block" })
    existing.meta.preview = "registry/blocks/button/preview.tsx"
    const plan = createSyncPlan(
      [fetchedButton({ digest: "sha256:old" })],
      options({ existingItems: [existing] }),
    )

    expect(plan.deletes).toEqual(["registry/blocks/button"])
    // Both catalogs are rewritten and the dependency diff is reported once.
    const paths = plan.writes.map((write) => write.path)
    expect(paths).toContain("registry/blocks/registry.json")
    expect(paths).toContain("registry/ui/registry.json")
    expect(plan.summary.npmDependencies).toEqual([
      { item: "button", added: ["@radix-ui/react-slot"], removed: [] },
    ])
  })
})

describe("createSyncPlan registry catalog rewrite", () => {
  const existingCatalog = JSON.stringify({
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: "internal-ui",
    items: [internalExistingItem({ name: "toggle", type: "registry:ui" })],
  })

  it("rewrites the category catalog keeping internal and other-source entries sorted by name", () => {
    const otherSource = managedExistingItem({ name: "other-widget" })
    otherSource.meta.sourceId = "other-registry"
    const plan = createSyncPlan(
      [fetchedButton()],
      options({
        existingItems: [internalExistingItem({ name: "toggle", type: "registry:ui" }), otherSource],
        existingFiles: new Map([["registry/ui/registry.json", existingCatalog]]),
      }),
    )

    const raw = writeMap(plan).get("registry/ui/registry.json")
    expect(raw).toBeDefined()
    const catalog = JSON.parse(raw as string) as {
      $schema: string
      name: string
      items: { name: string; files?: { path: string }[] }[]
    }
    expect(catalog.$schema).toBe("https://ui.shadcn.com/schema/registry.json")
    expect(catalog.name).toBe("internal-ui")
    expect(catalog.items.map((item) => item.name)).toEqual(["button", "other-widget", "toggle"])
    const button = catalog.items.find((item) => item.name === "button")
    expect(button?.files?.[0]?.path).toBe("button/button.tsx")
    expect(button?.files?.[0]).not.toHaveProperty("content")
  })

  it("creates a catalog for categories without an existing one", () => {
    const plan = createSyncPlan([fetchedButton()], options())
    const raw = writeMap(plan).get("registry/ui/registry.json")

    expect(raw).toBeDefined()
    const catalog = JSON.parse(raw as string) as { name: string; items: unknown[] }
    expect(catalog.name).toBe("internal-ui")
    expect(catalog.items).toHaveLength(1)
  })

  it("drops catalog entries of deleted managed items", () => {
    const stale = managedExistingItem({ name: "stale-widget" })
    const plan = createSyncPlan(
      [fetchedButton()],
      options({
        existingItems: [managedExistingItem(), stale],
        acceptedDigests: new Map([["button", "sha256:new"]]),
      }),
    )
    const raw = writeMap(plan).get("registry/ui/registry.json")
    const catalog = JSON.parse(raw as string) as { items: { name: string }[] }

    expect(catalog.items.map((item) => item.name)).toEqual(["button"])
  })
})

describe("createSyncPlan summary and determinism", () => {
  it("reports npm and registry dependency changes per item", () => {
    const existing = managedExistingItem()
    existing.dependencies = ["old-dep"]
    existing.registryDependencies = ["@internal/old"]
    const fetched = fetchedButton({ digest: "sha256:new" }, {
      dependencies: ["@radix-ui/react-slot"],
      registryDependencies: ["@internal/button"],
    })

    const plan = createSyncPlan(
      [fetched],
      options({
        existingItems: [existing],
        acceptedDigests: new Map([["button", "sha256:new"]]),
      }),
    )

    expect(plan.summary.npmDependencies).toEqual([
      { item: "button", added: ["@radix-ui/react-slot"], removed: ["old-dep"] },
    ])
    expect(plan.summary.registryDependencies).toEqual([
      { item: "button", added: ["@internal/button"], removed: ["@internal/old"] },
    ])
  })

  it("produces a stable, sorted plan across calls", () => {
    const first = createSyncPlan([fetchedButton()], options())
    const second = createSyncPlan([fetchedButton()], options())

    expect(second).toEqual(first)
    const paths = first.writes.map((write) => write.path)
    expect(paths).toEqual([...paths].sort())
  })

  it("requires a single source id across the batch", () => {
    const other = fetchedButton({ sourceId: "other" }, { name: "chip" })

    expect(() => createSyncPlan([fetchedButton(), other], options())).toThrow(/source/i)
  })
})
