import { mkdir, writeFile } from "node:fs/promises"
import { relative, resolve } from "node:path"
import { loadCatalog } from "./catalog"
import { toSearchDocument } from "./search-index"
import { assertValidCatalog } from "./validate"

function previewImportPath(preview: string): string {
  const path = relative("generated", preview).replace(/\\/g, "/")
  return path.replace(/\.(?:[cm]?[jt]sx?)$/, "")
}

function previewMapSource(items: Awaited<ReturnType<typeof loadCatalog>>): string {
  const entries = items
    .map(
      (item) =>
        `  ${JSON.stringify(item.name)}: dynamic(() => import(${JSON.stringify(previewImportPath(item.meta.preview))}), { ssr: false }),`,
    )
    .join("\n")

  return [
    '"use client"',
    'import type { ComponentType } from "react"',
    'import dynamic from "next/dynamic"',
    "",
    "export const previewMap: Record<string, ComponentType> = {",
    entries,
    "}",
    "",
  ].join("\n")
}

export async function generateAssets(cwd = process.cwd()): Promise<void> {
  const items = await loadCatalog(cwd)
  await assertValidCatalog(items, cwd)
  const sortedItems = [...items].sort((left, right) => left.name.localeCompare(right.name))

  await mkdir(resolve(cwd, "generated"), { recursive: true })
  await mkdir(resolve(cwd, "public"), { recursive: true })
  await writeFile(resolve(cwd, "generated/preview-map.ts"), previewMapSource(sortedItems))
  await writeFile(
    resolve(cwd, "public/search-index.json"),
    `${JSON.stringify(sortedItems.map(toSearchDocument), null, 2)}\n`,
  )
}
