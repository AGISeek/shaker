import { realpath } from "node:fs/promises"
import { resolve, sep, win32 } from "node:path"
import { findDependencyCycle, internalDependencyNames } from "./dependency-graph"
import type { InternalRegistryItem } from "./types"

export type ValidationIssue = {
  item: string
  field: string
  message: string
}

const allowedStatuses = new Set(["experimental", "stable", "deprecated"])
const supportedRegistryTypes = new Set([
  "registry:ui",
  "registry:component",
  "registry:block",
  "registry:page",
])

export class RegistryValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(issues.map((issue) => `${issue.item}.${issue.field}: ${issue.message}`).join("\n"))
    this.name = "RegistryValidationError"
  }
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function isWithin(root: string, target: string): boolean {
  return target === root || target.startsWith(`${root}${sep}`)
}

function isSafeConsumerTarget(target: string): boolean {
  const normalizedTarget = target.replaceAll("\\", "/")
  const installationRoot = resolve(sep, "registry-installation-root")
  return !win32.isAbsolute(target)
    && !normalizedTarget.startsWith(sep)
    && isWithin(installationRoot, resolve(installationRoot, normalizedTarget))
}

function hasMetadata(item: InternalRegistryItem): boolean {
  return typeof item.meta === "object" && item.meta !== null
}

function sourcePaths(cwd: string, sourcePath: string): string[] {
  return [resolve(cwd, sourcePath), resolve(cwd, "registry", sourcePath)]
}

type SourcePathResult =
  | { kind: "found"; path: string }
  | { kind: "missing" }
  | { kind: "outside" }

async function existingSourcePath(cwd: string, sourcePath: string): Promise<SourcePathResult> {
  for (const candidate of sourcePaths(cwd, sourcePath)) {
    if (!isWithin(cwd, candidate)) return { kind: "outside" }
    try {
      const canonicalCandidate = await realpath(candidate)
      if (!isWithin(cwd, canonicalCandidate)) return { kind: "outside" }
      return { kind: "found", path: canonicalCandidate }
    } catch {
      // Check the next source-root-compatible path.
    }
  }
  return { kind: "missing" }
}

export async function validateCatalog(
  items: InternalRegistryItem[],
  cwd = process.cwd(),
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const root = await realpath(resolve(cwd))
  const names = new Set<string>()
  const itemNames = new Set(items.map((item) => item.name))

  for (const item of items) {
    if (names.has(item.name)) {
      issues.push({ item: item.name, field: "name", message: `Duplicate registry item name: ${item.name}` })
    }
    names.add(item.name)
  }

  for (const item of items) {
    if (!hasMetadata(item)) {
      issues.push({ item: item.name, field: "meta", message: "Metadata is required" })
      continue
    }
    if (!item.meta.origin?.trim()) {
      issues.push({ item: item.name, field: "meta.origin", message: "Origin is required" })
    }
    if (!item.meta.sourceRef?.trim()) {
      issues.push({ item: item.name, field: "meta.sourceRef", message: "Source reference is required" })
    }
  }

  for (const item of items) {
    if (!supportedRegistryTypes.has(item.type)) {
      issues.push({ item: item.name, field: "type", message: `Unsupported registry type: ${item.type}` })
    }
  }

  for (const item of items) {
    if (!hasMetadata(item)) continue
    if (!allowedStatuses.has(item.meta.status)) {
      issues.push({ item: item.name, field: "meta.status", message: `Invalid status: ${item.meta.status}` })
    }
  }

  for (const item of items) {
    if (!hasMetadata(item)) continue
    if (!isValidDate(item.meta.addedAt)) {
      issues.push({ item: item.name, field: "meta.addedAt", message: `Invalid date: ${item.meta.addedAt}` })
    }
  }

  const previews = new Map<string, string | null>()
  for (const item of items) {
    if (!hasMetadata(item)) continue
    const preview = await existingSourcePath(root, item.meta.preview)
    previews.set(item.name, preview.kind === "found" ? preview.path : null)
    if (preview.kind === "outside") {
      issues.push({
        item: item.name,
        field: "meta.preview",
        message: `Preview file is outside the repository: ${item.meta.preview}`,
      })
    } else if (preview.kind === "missing") {
      issues.push({
        item: item.name,
        field: "meta.preview",
        message: `Preview file does not exist: ${item.meta.preview}`,
      })
    }
  }

  const filesByItem = new Map<string, Set<string>>()
  for (const item of items) {
    const filePaths = new Set<string>()
    for (const file of item.files ?? []) {
      if (file.target !== undefined && (typeof file.target !== "string" || !isSafeConsumerTarget(file.target))) {
        issues.push({
          item: item.name,
          field: "files[].target",
          message: `File target is outside the consumer installation root: ${String(file.target)}`,
        })
      }
      const sourcePath = await existingSourcePath(root, file.path)
      if (sourcePath.kind === "outside") {
        issues.push({
          item: item.name,
          field: "files[].path",
          message: `File path is outside the repository: ${file.path}`,
        })
        continue
      }
      if (sourcePath.kind === "missing") {
        issues.push({ item: item.name, field: "files[].path", message: `File does not exist: ${file.path}` })
        continue
      }
      filePaths.add(sourcePath.path)
    }
    filesByItem.set(item.name, filePaths)
  }

  for (const item of items) {
    if (!hasMetadata(item)) continue
    const preview = previews.get(item.name)
    if (preview && filesByItem.get(item.name)?.has(preview)) {
      issues.push({ item: item.name, field: "meta.preview", message: "Preview must not be included in files" })
    }
  }

  for (const item of items) {
    for (const dependency of internalDependencyNames(item)) {
      if (!itemNames.has(dependency)) {
        issues.push({
          item: item.name,
          field: "registryDependencies",
          message: `Internal dependency does not exist: ${dependency}`,
        })
      }
    }
  }

  const cycle = findDependencyCycle(items)
  if (cycle) {
    issues.push({
      item: cycle[0]!,
      field: "registryDependencies",
      message: `Dependency cycle: ${cycle.join(" -> ")}`,
    })
  }

  for (const item of items) {
    if (!hasMetadata(item)) continue
    if (item.meta.status !== "deprecated") continue
    const replacement = item.meta.replacedBy
    if (replacement === item.name) {
      issues.push({ item: item.name, field: "meta.replacedBy", message: "Replacement must not reference itself" })
    } else if (!replacement || !itemNames.has(replacement)) {
      issues.push({
        item: item.name,
        field: "meta.replacedBy",
        message: `Replacement does not exist: ${replacement ?? ""}`,
      })
    }
  }

  return issues
}

export async function assertValidCatalog(items: InternalRegistryItem[], cwd = process.cwd()): Promise<void> {
  const issues = await validateCatalog(items, cwd)
  if (issues.length > 0) throw new RegistryValidationError(issues)
}
