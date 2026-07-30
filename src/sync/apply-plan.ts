import { randomBytes } from "node:crypto"
import { dirname, join, resolve } from "node:path"
import { loadCatalog } from "../registry/catalog"
import { assertValidCatalog } from "../registry/validate"
import { cp, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "./fs"
import { ITEM_NAME_PATTERN, UPSTREAM_SOURCE_MARKER } from "./normalize"
import type { SyncPlan } from "./sync-plan"

const CATEGORIES = new Set(["ui", "blocks", "templates"])
const REGISTRY_DIR = "registry"
const STAGING_PREFIX = ".upstream-sync-"
const BACKUP_PREFIX = ".upstream-backup-"

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
 * Verifies a planned write lands at "<registry>/<category>/<file...>" and
 * returns the path inside the staging copy. Anything else (traversal above
 * the registry root, unknown category, catalog roots) is rejected before a
 * single byte is written.
 */
function stagedWritePath(stagingRoot: string, path: string): string {
  const segments = normalizePathSegments(path)
  if (
    segments === null ||
    segments.length < 3 ||
    segments[0] !== REGISTRY_DIR ||
    !CATEGORIES.has(segments[1] as string)
  ) {
    throw new Error(`Refusing to apply a write outside the registry categories: ${path}`)
  }
  return join(stagingRoot, ...segments)
}

/**
 * Verifies a planned delete names exactly "<registry>/<category>/<item>".
 * The repository root, the registry root and category directories can never
 * be delete targets.
 */
function stagedDeletePath(stagingRoot: string, path: string): string {
  const segments = normalizePathSegments(path)
  if (
    segments === null ||
    segments.length !== 3 ||
    segments[0] !== REGISTRY_DIR ||
    !CATEGORIES.has(segments[1] as string) ||
    !ITEM_NAME_PATTERN.test(segments[2] as string)
  ) {
    throw new Error(`Refusing to delete a path outside the registry item directories: ${path}`)
  }
  return join(stagingRoot, ...segments)
}

/**
 * A directory may only be recursively deleted when it carries the upstream
 * source marker naming the source that is being synced. Internal assets and
 * directories managed by other sources are never touched.
 */
async function assertManagedBySource(dir: string, sourceId: string, planPath: string): Promise<void> {
  let marker: string | null = null
  try {
    marker = await readFile(join(dir, UPSTREAM_SOURCE_MARKER), "utf8")
  } catch {
    marker = null
  }
  if (marker === null || marker.trim() !== sourceId) {
    throw new Error(
      `Refusing to delete ${planPath}: it is not marked as managed by upstream source "${sourceId}"`,
    )
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** Recursive delete is only ever allowed on the exact backup path of this run. */
function assertBackupPath(root: string, backup: string, token: string): void {
  const expected = join(resolve(root), `${BACKUP_PREFIX}${token}`)
  if (resolve(backup) !== expected) {
    throw new Error(`Refusing to remove unexpected backup path: ${backup}`)
  }
}

/**
 * Applies a sync plan atomically: all writes and deletes are staged in a
 * temporary copy of the registry, the staged tree is validated with the core
 * catalog checks, and only then is it swapped into place via two renames.
 * If the swap's second rename fails, the backup is immediately moved back.
 * On any failure the original registry tree is left byte-for-byte unchanged.
 */
export async function applySyncPlan(plan: SyncPlan, root: string): Promise<void> {
  // Resolve and validate every planned path before touching the filesystem.
  const writes = plan.writes.map((write) => ({
    path: write.path,
    content: write.content,
  }))
  const deletes = [...plan.deletes]

  const registryPath = join(root, REGISTRY_DIR)
  const stagingRoot = await mkdtemp(join(root, STAGING_PREFIX))
  const token = randomBytes(8).toString("hex")
  const backupPath = join(root, `${BACKUP_PREFIX}${token}`)
  let swapped = false

  try {
    const stagedWrites = writes.map((write) => ({
      target: stagedWritePath(stagingRoot, write.path),
      content: write.content,
    }))
    const stagedDeletes = deletes.map((path) => ({
      planPath: path,
      target: stagedDeletePath(stagingRoot, path),
    }))

    await cp(registryPath, join(stagingRoot, REGISTRY_DIR), { recursive: true })

    for (const write of stagedWrites) {
      let existing: string | null = null
      try {
        existing = await readFile(write.target, "utf8")
      } catch {
        existing = null
      }
      // Do not rewrite identical content: keeps mtimes stable and avoids
      // touching files the sync does not actually change.
      if (existing === write.content) continue
      await mkdir(dirname(write.target), { recursive: true })
      await writeFile(write.target, write.content)
    }

    for (const deletion of stagedDeletes) {
      if (!(await pathExists(deletion.target))) continue
      await assertManagedBySource(deletion.target, plan.sourceId, deletion.planPath)
      await rm(deletion.target, { recursive: true })
    }

    const stagedItems = await loadCatalog(stagingRoot)
    await assertValidCatalog(stagedItems, stagingRoot)

    await rename(registryPath, backupPath)
    try {
      await rename(join(stagingRoot, REGISTRY_DIR), registryPath)
    } catch (error) {
      // Roll back immediately: the backup still holds the original tree.
      await rename(backupPath, registryPath)
      throw error
    }
    swapped = true
  } finally {
    await rm(stagingRoot, { recursive: true, force: true })
    if (swapped) {
      assertBackupPath(root, backupPath, token)
      await rm(backupPath, { recursive: true, force: true })
    }
  }
}
