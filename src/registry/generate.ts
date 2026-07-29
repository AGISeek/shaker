import { mkdir, writeFile } from "node:fs/promises"
import { relative, resolve } from "node:path"
import { loadCatalog } from "./catalog"
import { toSearchDocument } from "./search-index"
import type { InternalRegistryItem } from "./types"
import { assertValidCatalog } from "./validate"

function previewImportPath(preview: string): string {
  const path = relative("generated", preview).replace(/\\/g, "/")
  return path.replace(/\.(?:[cm]?[jt]sx?)$/, "")
}

function previewMapSource(items: InternalRegistryItem[]): string {
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

async function loadValidatedCatalog(cwd: string): Promise<InternalRegistryItem[]> {
  const items = await loadCatalog(cwd)
  await assertValidCatalog(items, cwd)
  return [...items].sort((left, right) => left.name.localeCompare(right.name))
}

async function writePreviewMap(items: InternalRegistryItem[], cwd: string): Promise<void> {
  await mkdir(resolve(cwd, "generated"), { recursive: true })
  await writeFile(resolve(cwd, "generated/preview-map.ts"), previewMapSource(items))
}

async function writeSearchIndex(items: InternalRegistryItem[], cwd: string): Promise<void> {
  await mkdir(resolve(cwd, "public"), { recursive: true })
  await writeFile(
    resolve(cwd, "public/search-index.json"),
    `${JSON.stringify(items.map(toSearchDocument), null, 2)}\n`,
  )
}

export async function generatePreviewMap(cwd = process.cwd()): Promise<void> {
  await writePreviewMap(await loadValidatedCatalog(cwd), cwd)
}

export async function generateSearchIndex(cwd = process.cwd()): Promise<void> {
  await writeSearchIndex(await loadValidatedCatalog(cwd), cwd)
}

export async function generateAssets(cwd = process.cwd()): Promise<void> {
  const items = await loadValidatedCatalog(cwd)
  await writePreviewMap(items, cwd)
  await writeSearchIndex(items, cwd)
}
