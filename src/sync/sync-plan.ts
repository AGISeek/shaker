import type { InternalRegistryItem } from "../registry/types"
import type { FetchedItem } from "./fetch-item"
import { categoryForType, DigestApprovalRequiredError, ITEM_NAME_PATTERN, normalizeFetchedItem, UPSTREAM_SOURCE_MARKER } from "./normalize"
import type { NormalizedItem, SyncCategory } from "./normalize"

export type PlannedWrite = { path: string; content: string }

export type DependencyChange = { item: string; added: string[]; removed: string[] }

export type SyncSummary = {
  added: number
  changed: number
  removed: number
  npmDependencies: DependencyChange[]
  registryDependencies: DependencyChange[]
}

export type SyncPlan = {
  sourceId: string
  registryItems: InternalRegistryItem[]
  writes: PlannedWrite[]
  deletes: string[]
  summary: SyncSummary
}

export type CreateSyncPlanOptions = {
  registryRoot: string
  existingFiles: Map<string, string>
  existingItems: InternalRegistryItem[]
  acceptedDigests: Map<string, string>
  syncDate: string
}

const REGISTRY_SCHEMA_URL = "https://ui.shadcn.com/schema/registry.json"

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function isManagedBy(item: InternalRegistryItem, sourceId: string): boolean {
  return item.meta?.origin === "upstream" && item.meta.sourceId === sourceId
}

function previewPlaceholder(): string {
  return [
    "export default function UpstreamPreviewPlaceholder() {",
    "  return (",
    '    <div className="flex min-h-screen items-center justify-center p-6">',
    '      <p className="text-sm text-muted-foreground">该上游资产尚未配置内部预览</p>',
    "    </div>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function diffDependencies(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const previous = new Set(before)
  const next = new Set(after)
  return {
    added: [...next].filter((dep) => !previous.has(dep)).sort(compareStrings),
    removed: [...previous].filter((dep) => !next.has(dep)).sort(compareStrings),
  }
}

function readCatalogBase(raw: string | undefined, category: SyncCategory): Record<string, unknown> {
  if (raw === undefined) {
    return { $schema: REGISTRY_SCHEMA_URL, name: `internal-${category}` }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `Existing catalog registry/${category}/registry.json is not valid JSON (${(error as Error).message})`,
    )
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Existing catalog registry/${category}/registry.json must be a JSON object`)
  }
  const { items: _items, ...base } = parsed as Record<string, unknown>
  return base
}

/** Resolves "."/".." segments and unifies separators; null if it escapes above the root. */
function normalizePathSegments(path: string): string[] | null {
  const segments: string[] = []
  for (const segment of path.replaceAll("\\", "/").split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") {
      if (segments.length === 0) return null
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return segments
}

/**
 * Verifies a planned delete resolves to exactly "<registryRoot>/<category>/<name>".
 * The path is built from existing item metadata, so a malicious or corrupted
 * item name must not be able to point the delete outside the registry root.
 */
function assertSafeDeletePath(registryRoot: string, path: string): void {
  const rootSegments = normalizePathSegments(registryRoot)
  const pathSegments = normalizePathSegments(path)
  const categories: readonly string[] = ["ui", "blocks", "templates"]
  const safe =
    rootSegments !== null &&
    pathSegments !== null &&
    pathSegments.length === rootSegments.length + 2 &&
    rootSegments.every((segment, index) => pathSegments[index] === segment) &&
    categories.includes(pathSegments[rootSegments.length] as string) &&
    ITEM_NAME_PATTERN.test(pathSegments[rootSegments.length + 1] as string)
  if (!safe) {
    throw new Error(`Refusing to plan a delete outside the registry root: ${path}`)
  }
}

/**
 * Converts an in-memory (loadCatalog-expanded) item into the catalog-file
 * form: file paths become relative to the category directory.
 */
function toCatalogItem(item: InternalRegistryItem, category: SyncCategory): InternalRegistryItem {
  return {
    ...item,
    files: item.files?.map((file) => ({
      ...file,
      path: file.path.startsWith(`${category}/`) ? file.path.slice(category.length + 1) : file.path,
    })),
  }
}

/**
 * Builds a pure, deterministic write plan for a fetched upstream batch.
 * All validation happens before the plan is assembled, so a thrown error
 * (path escape, missing digest approval, ownership conflict) never produces
 * partial writes.
 */
export function createSyncPlan(items: FetchedItem[], options: CreateSyncPlanOptions): SyncPlan {
  if (items.length === 0) {
    throw new Error("createSyncPlan requires at least one fetched item")
  }
  const sourceId = items[0]!.sourceId
  for (const fetched of items) {
    if (fetched.sourceId !== sourceId) {
      throw new Error(
        `createSyncPlan requires a single source id, got "${sourceId}" and "${fetched.sourceId}"`,
      )
    }
  }

  const existingByName = new Map(options.existingItems.map((item) => [item.name, item]))

  // Pass 1: validate ownership, digest approvals and paths. Any failure here
  // aborts the whole sync before a single write is planned.
  const seenNames = new Set<string>()
  const normalized: NormalizedItem[] = items.map((fetched) => {
    const name = fetched.item.name
    // Item names become path segments; an unvalidated name (e.g. "../../escape"
    // pulled in via a transitive dependency) could escape the registry root.
    if (!ITEM_NAME_PATTERN.test(name)) {
      throw new Error(
        `Upstream source "${sourceId}" returned an invalid item name "${name}"; ` +
          "names must match /^[a-z0-9][a-z0-9-]*$/",
      )
    }
    if (seenNames.has(name)) {
      throw new Error(`Upstream item "${name}" appears more than once in the sync batch`)
    }
    seenNames.add(name)

    const existing = existingByName.get(name)
    if (existing !== undefined) {
      if (!isManagedBy(existing, sourceId)) {
        throw new Error(
          `Upstream item "${name}" conflicts with an existing asset that is not managed by source "${sourceId}"`,
        )
      }
      const previousDigest = existing.meta.sourceDigest
      if (previousDigest !== fetched.digest && options.acceptedDigests.get(name) !== fetched.digest) {
        throw new DigestApprovalRequiredError(name, previousDigest, fetched.digest)
      }
    }

    return normalizeFetchedItem(fetched, {
      registryRoot: options.registryRoot,
      syncDate: options.syncDate,
      existing,
    })
  })

  const sortedNew = [...normalized].sort((a, b) => compareStrings(a.name, b.name))
  const newByName = new Map(normalized.map((item) => [item.name, item]))

  // Deletes: directories this source previously managed that are no longer
  // synced (or moved to another category). Internal assets and items managed
  // by other sources are never touched.
  const deletes = new Set<string>()
  const affectedCategories = new Set<SyncCategory>(normalized.map((item) => item.category))
  const removedItems: InternalRegistryItem[] = []
  for (const existing of options.existingItems) {
    if (!isManagedBy(existing, sourceId)) continue
    const existingCategory = categoryForType(existing.name, existing.type)
    const next = newByName.get(existing.name)
    if (next === undefined || next.category !== existingCategory) {
      deletes.add(`${options.registryRoot}/${existingCategory}/${existing.name}`)
      affectedCategories.add(existingCategory)
      // A category change is already reported through the new item's diff;
      // only truly removed items get a full removal entry in the summary.
      if (next === undefined) removedItems.push(existing)
    }
  }
  for (const path of deletes) {
    assertSafeDeletePath(options.registryRoot, path)
  }

  // Pass 2: assemble writes, skipping content that already exists unchanged.
  const writes = new Map<string, string>()
  const planWrite = (path: string, content: string) => {
    if (options.existingFiles.get(path) === content) return
    writes.set(path, content)
  }

  for (const item of normalized) {
    for (const file of item.sourceFiles) {
      planWrite(`${options.registryRoot}/${file.registryPath}`, file.content)
    }
    const previewPath = `${options.registryRoot}/${item.category}/${item.name}/preview.tsx`
    // Never overwrite an existing preview: maintainers may have replaced the
    // generated placeholder with a real one.
    if (!options.existingFiles.has(previewPath)) {
      planWrite(previewPath, previewPlaceholder())
    }
    planWrite(
      `${options.registryRoot}/${item.category}/${item.name}/${UPSTREAM_SOURCE_MARKER}`,
      `${sourceId}\n`,
    )
  }

  // Rewrite affected category catalogs: keep internal and other-source items,
  // replace the entries this source manages, sort by name.
  for (const category of [...affectedCategories].sort(compareStrings)) {
    const kept = options.existingItems.filter(
      (item) => categoryForType(item.name, item.type) === category && !isManagedBy(item, sourceId),
    )
    const merged = [
      ...kept,
      ...sortedNew.filter((item) => item.category === category).map((item) => item.registryItem),
    ].sort((a, b) => compareStrings(a.name, b.name))

    const catalogPath = `${options.registryRoot}/${category}/registry.json`
    const base = readCatalogBase(options.existingFiles.get(catalogPath), category)
    const content =
      `${JSON.stringify({ ...base, items: merged.map((item) => toCatalogItem(item, category)) }, null, 2)}\n`
    planWrite(catalogPath, content)
  }

  const writeList = [...writes.entries()]
    .map(([path, content]) => ({ path, content }))
    .sort((a, b) => compareStrings(a.path, b.path))

  const npmDependencies: DependencyChange[] = []
  const registryDependencies: DependencyChange[] = []
  const recordChanges = (name: string, before: InternalRegistryItem | undefined, afterDeps: { npm: string[]; registry: string[] }) => {
    const npm = diffDependencies(before?.dependencies ?? [], afterDeps.npm)
    if (npm.added.length > 0 || npm.removed.length > 0) {
      npmDependencies.push({ item: name, ...npm })
    }
    const registry = diffDependencies(before?.registryDependencies ?? [], afterDeps.registry)
    if (registry.added.length > 0 || registry.removed.length > 0) {
      registryDependencies.push({ item: name, ...registry })
    }
  }
  for (const item of sortedNew) {
    recordChanges(item.name, existingByName.get(item.name), {
      npm: item.registryItem.dependencies ?? [],
      registry: item.registryItem.registryDependencies ?? [],
    })
  }
  for (const removed of removedItems) {
    recordChanges(removed.name, removed, { npm: [], registry: [] })
  }
  npmDependencies.sort((a, b) => compareStrings(a.item, b.item))
  registryDependencies.sort((a, b) => compareStrings(a.item, b.item))

  const sortedDeletes = [...deletes].sort(compareStrings)
  const removed = sortedDeletes.reduce(
    (count, dir) =>
      count + [...options.existingFiles.keys()].filter((key) => key.startsWith(`${dir}/`)).length,
    0,
  )

  return {
    sourceId,
    registryItems: sortedNew.map((item) => item.registryItem),
    writes: writeList,
    deletes: sortedDeletes,
    summary: {
      added: writeList.filter((write) => !options.existingFiles.has(write.path)).length,
      changed: writeList.filter((write) => options.existingFiles.has(write.path)).length,
      removed,
      npmDependencies,
      registryDependencies,
    },
  }
}
