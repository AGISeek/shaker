import type { InternalMeta, InternalRegistryItem } from "../registry/types"
import type { FetchedItem } from "./fetch-item"

export type SyncCategory = "ui" | "blocks" | "templates"

/** Marker file written into every synced item directory; used by delete guards. */
export const UPSTREAM_SOURCE_MARKER = ".upstream-source"

/** shadcn naming convention for registry item names. */
export const ITEM_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/

const categoryByType: Record<string, SyncCategory> = {
  "registry:ui": "ui",
  "registry:component": "ui",
  "registry:block": "blocks",
  "registry:page": "templates",
}

export class DigestApprovalRequiredError extends Error {
  constructor(
    readonly itemName: string,
    readonly previousDigest: string | undefined,
    readonly newDigest: string,
  ) {
    super(
      `Upstream item "${itemName}" digest changed from ${previousDigest ?? "none"} to ${newDigest}; ` +
        `re-run with --accept-digest ${itemName}=${newDigest} to approve the update`,
    )
    this.name = "DigestApprovalRequiredError"
  }
}

export function categoryForType(itemName: string, type: string): SyncCategory {
  const category = categoryByType[type]
  if (category === undefined) {
    throw new Error(`Item "${itemName}" has unsupported type "${type}" for upstream sync`)
  }
  return category
}

/**
 * Converts an upstream file path (shadcn convention: category-prefixed, e.g.
 * "ui/button.tsx") into a path relative to the local item directory. Rejects
 * absolute paths, parent traversal, empty paths and anything that would land
 * outside the item directory or collide with the managed preview entry.
 */
export function normalizeFilePath(
  itemName: string,
  category: SyncCategory,
  rawPath: string,
): string {
  if (typeof rawPath !== "string" || rawPath.trim() === "") {
    throw new Error(`Upstream item "${itemName}" has an empty file path`)
  }
  const unified = rawPath.replaceAll("\\", "/")
  if (unified.startsWith("/") || /^[A-Za-z]:($|\/)/.test(unified)) {
    throw new Error(
      `Upstream item "${itemName}" file path "${rawPath}" is absolute; only relative paths are allowed`,
    )
  }
  const segments = unified.split("/").filter((segment) => segment !== "" && segment !== ".")
  if (segments.some((segment) => segment === "..")) {
    throw new Error(
      `Upstream item "${itemName}" file path "${rawPath}" escapes the item directory`,
    )
  }
  // Strip the conventional upstream category prefix ("ui/button.tsx") and a
  // redundant item-name prefix ("ui/button/button.tsx"), if present.
  if (segments[0] === category) segments.shift()
  if (segments[0] === itemName) segments.shift()
  if (segments.length === 0) {
    throw new Error(
      `Upstream item "${itemName}" file path "${rawPath}" does not resolve to a file inside the item directory`,
    )
  }
  const relative = segments.join("/")
  if (relative === "preview.tsx") {
    throw new Error(
      `Upstream item "${itemName}" file path "${rawPath}" conflicts with the managed preview entry`,
    )
  }
  if (relative === UPSTREAM_SOURCE_MARKER) {
    throw new Error(
      `Upstream item "${itemName}" file path "${rawPath}" conflicts with the managed source marker`,
    )
  }
  return relative
}

export type NormalizedSourceFile = {
  /** Path relative to the registry root, e.g. "ui/button/button.tsx". */
  registryPath: string
  /** Path relative to the item directory, e.g. "button.tsx". */
  relativePath: string
  content: string
  type: string
  target?: string
}

export type NormalizedItem = {
  name: string
  category: SyncCategory
  registryItem: InternalRegistryItem
  sourceFiles: NormalizedSourceFile[]
}

/**
 * Splits a fetched upstream item into local source files plus an internal
 * registry definition with provenance metadata. Pure: no filesystem access.
 */
export function normalizeFetchedItem(
  fetched: FetchedItem,
  context: { registryRoot: string; syncDate: string; existing?: InternalRegistryItem },
): NormalizedItem {
  const { item } = fetched
  const category = categoryForType(item.name, item.type)
  const files = item.files ?? []
  if (files.length === 0) {
    throw new Error(`Upstream item "${item.name}" has no files to sync`)
  }

  const seen = new Set<string>()
  const sourceFiles: NormalizedSourceFile[] = files.map((file) => {
    if (typeof file.content !== "string") {
      throw new Error(
        `Upstream item "${item.name}" file "${file.path}" has no embedded content to split out`,
      )
    }
    const relativePath = normalizeFilePath(item.name, category, file.path)
    if (seen.has(relativePath)) {
      throw new Error(
        `Upstream item "${item.name}" has duplicate file path "${relativePath}" after normalization`,
      )
    }
    seen.add(relativePath)
    return {
      registryPath: `${category}/${item.name}/${relativePath}`,
      relativePath,
      content: file.content,
      type: file.type,
      ...(file.target !== undefined ? { target: file.target } : {}),
    }
  })

  const existingMeta = context.existing?.meta
  const meta: InternalMeta = {
    status: existingMeta?.status ?? "experimental",
    preview: `${context.registryRoot}/${category}/${item.name}/preview.tsx`,
    addedAt: existingMeta?.addedAt ?? context.syncDate,
    ...(existingMeta?.featured !== undefined ? { featured: existingMeta.featured } : {}),
    origin: "upstream",
    sourceRef: fetched.sourceRef,
    sourceDigest: fetched.digest,
    sourceId: fetched.sourceId,
    ...(existingMeta?.replacedBy !== undefined ? { replacedBy: existingMeta.replacedBy } : {}),
  }

  const { $schema: _schema, ...itemWithoutSchema } = item as typeof item & { $schema?: string }
  // The shadcn RegistryItem union cannot be reassembled member-wise after
  // overriding files, so build the plain object and cast to the internal type.
  const registryItem = {
    ...itemWithoutSchema,
    files: sourceFiles.map((file) => ({
      path: file.registryPath,
      type: file.type,
      ...(file.target !== undefined ? { target: file.target } : {}),
    })),
    meta,
  } as InternalRegistryItem

  return { name: item.name, category, registryItem, sourceFiles }
}
