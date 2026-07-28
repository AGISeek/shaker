import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { readItemSources } from "@/src/registry/source"
import type { InternalRegistryItem } from "@/src/registry/types"

let fixtureRoot: string

function item(name: string, overrides: Partial<InternalRegistryItem> = {}): InternalRegistryItem {
  return {
    name,
    type: "registry:ui",
    files: [{ path: `${name}/${name}.tsx`, type: "registry:ui" }],
    meta: {
      status: "stable",
      preview: `registry/ui/${name}/preview.tsx`,
      addedAt: "2026-07-29",
      origin: "internal",
      sourceRef: "main",
    },
    ...overrides,
  } as InternalRegistryItem
}

beforeEach(async () => {
  fixtureRoot = await mkdtemp(join(tmpdir(), "registry-source-"))
  await mkdir(join(fixtureRoot, "registry", "ui", "button"), { recursive: true })
  await writeFile(join(fixtureRoot, "registry", "ui", "button", "button.tsx"), "export const Button = () => null\n")
})

describe("readItemSources", () => {
  it("reads item files from the registry root", async () => {
    await expect(readItemSources(item("button"), fixtureRoot)).resolves.toEqual([
      { path: "button/button.tsx", content: "export const Button = () => null\n" },
    ])
  })

  it("rejects source paths that escape the repository", async () => {
    const unsafe = item("unsafe", {
      files: [{ path: "../secret.txt", type: "registry:file", target: "secret.txt" }],
    })

    await expect(readItemSources(unsafe, fixtureRoot)).rejects.toThrow("Source path escapes registry root")
  })
})
