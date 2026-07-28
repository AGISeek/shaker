import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { findDependencyCycle } from "@/src/registry/dependency-graph"
import {
  assertValidCatalog,
  RegistryValidationError,
  validateCatalog,
} from "@/src/registry/validate"
import type { InternalRegistryItem } from "@/src/registry/types"

let fixtureRoot: string

function item(
  name: string,
  overrides: Partial<InternalRegistryItem> = {},
): InternalRegistryItem {
  return {
    name,
    type: "registry:ui",
    files: [{ path: `registry/ui/${name}.tsx`, type: "registry:ui" }],
    meta: {
      status: "stable",
      preview: `registry/ui/${name}.preview.tsx`,
      addedAt: "2026-07-29",
      origin: "internal",
      sourceRef: "main",
    },
    ...overrides,
  } as InternalRegistryItem
}

async function writeItemFiles(name: string) {
  await mkdir(join(fixtureRoot, "registry", "ui"), { recursive: true })
  await writeFile(join(fixtureRoot, "registry", "ui", `${name}.tsx`), "export {}")
  await writeFile(join(fixtureRoot, "registry", "ui", `${name}.preview.tsx`), "export {}")
}

beforeEach(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "registry-validation-"))
  await writeItemFiles("a")
  await writeItemFiles("b")
})

describe("findDependencyCycle", () => {
  it("returns the closed path of an internal dependency cycle", () => {
    expect(
      findDependencyCycle([
        item("a", { registryDependencies: ["@internal/b"] }),
        item("b", { registryDependencies: ["@internal/a"] }),
      ]),
    ).toEqual(["a", "b", "a"])
  })

  it("ignores dependencies outside the internal namespace", () => {
    expect(findDependencyCycle([item("a", { registryDependencies: ["@acme/a"] })])).toBeNull()
  })
})

describe("validateCatalog", () => {
  it("reports duplicate names", async () => {
    const issues = await validateCatalog([item("a"), item("a")], fixtureRoot)
    expect(issues).toContainEqual({
      item: "a",
      field: "name",
      message: "Duplicate registry item name: a",
    })
  })

  it("reports an invalid status", async () => {
    const issues = await validateCatalog(
      [item("a", { meta: { ...item("a").meta, status: "unknown" as "stable" } })],
      fixtureRoot,
    )
    expect(issues).toContainEqual({ item: "a", field: "meta.status", message: "Invalid status: unknown" })
  })

  it("reports an invalid added date", async () => {
    const issues = await validateCatalog(
      [item("a", { meta: { ...item("a").meta, addedAt: "2026-02-30" } })],
      fixtureRoot,
    )
    expect(issues).toContainEqual({ item: "a", field: "meta.addedAt", message: "Invalid date: 2026-02-30" })
  })

  it("reports a missing preview", async () => {
    const issues = await validateCatalog(
      [item("a", { meta: { ...item("a").meta, preview: "registry/ui/missing.tsx" } })],
      fixtureRoot,
    )
    expect(issues).toContainEqual({
      item: "a",
      field: "meta.preview",
      message: "Preview file does not exist: registry/ui/missing.tsx",
    })
  })

  it("reports a missing file and source outside the repository", async () => {
    const issues = await validateCatalog(
      [item("a", { files: [{ path: "../outside.tsx", type: "registry:ui" }] })],
      fixtureRoot,
    )
    expect(issues).toContainEqual({
      item: "a",
      field: "files[].path",
      message: "File path is outside the repository: ../outside.tsx",
    })
  })

  it("reports a preview included in the installation payload", async () => {
    const preview = "registry/ui/a.preview.tsx"
    const issues = await validateCatalog([item("a", { files: [{ path: preview, type: "registry:ui" }] })], fixtureRoot)
    expect(issues).toContainEqual({
      item: "a",
      field: "meta.preview",
      message: "Preview must not be included in files",
    })
  })

  it("reports a missing internal dependency", async () => {
    const issues = await validateCatalog([item("a", { registryDependencies: ["@internal/missing"] })], fixtureRoot)
    expect(issues).toContainEqual({
      item: "a",
      field: "registryDependencies",
      message: "Internal dependency does not exist: missing",
    })
  })

  it("reports a dependency cycle with the item path", async () => {
    const items = [
      item("a", { registryDependencies: ["@internal/b"] }),
      item("b", { registryDependencies: ["@internal/a"] }),
    ]
    const issues = await validateCatalog(items, fixtureRoot)
    expect(issues).toContainEqual({
      item: "a",
      field: "registryDependencies",
      message: "Dependency cycle: a -> b -> a",
    })
  })

  it("reports a deprecated item without a distinct replacement", async () => {
    const issues = await validateCatalog(
      [item("a", { meta: { ...item("a").meta, status: "deprecated", replacedBy: "a" } })],
      fixtureRoot,
    )
    expect(issues).toContainEqual({
      item: "a",
      field: "meta.replacedBy",
      message: "Replacement must not reference itself",
    })
  })

  it("formats issues when asserting a catalog is valid", async () => {
    await expect(assertValidCatalog([item("a"), item("a")], fixtureRoot)).rejects.toMatchObject({
      name: RegistryValidationError.name,
      message: "a.name: Duplicate registry item name: a",
    })
  })
})
