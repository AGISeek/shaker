import { access } from "node:fs/promises"
import { resolve, sep } from "node:path"
import { findDependencyCycle, internalDependencyNames } from "./dependency-graph"
import type { InternalRegistryItem } from "./types"

export type ValidationIssue = {
  item: string
  field: string
  message: string
}

const allowedStatuses = new Set(["experimental", "stable", "deprecated"])

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

function sourcePaths(cwd: string, sourcePath: string): string[] {
  return [resolve(cwd, sourcePath), resolve(cwd, "registry", sourcePath)]
}

async function existingSourcePath(cwd: string, sourcePath: string): Promise<string | null> {
  for (const candidate of sourcePaths(cwd, sourcePath)) {
    if (!isWithin(cwd, candidate)) continue
    try {
      await access(candidate)
      return candidate
    } catch {
      // Check the next source-root-compatible path.
    }
  }
  return null
}

export async function validateCatalog(
  items: InternalRegistryItem[],
  cwd = process.cwd(),
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const root = resolve(cwd)
  const names = new Set<string>()
  const itemNames = new Set(items.map((item) => item.name))

  for (const item of items) {
    if (names.has(item.name)) {
      issues.push({ item: item.name, field: "name", message: `Duplicate registry item name: ${item.name}` })
    }
    names.add(item.name)
  }

  for (const item of items) {
    if (!allowedStatuses.has(item.meta.status)) {
      issues.push({ item: item.name, field: "meta.status", message: `Invalid status: ${item.meta.status}` })
    }
  }

  for (const item of items) {
    if (!isValidDate(item.meta.addedAt)) {
      issues.push({ item: item.name, field: "meta.addedAt", message: `Invalid date: ${item.meta.addedAt}` })
    }
  }

  const previews = new Map<string, string | null>()
  for (const item of items) {
    const preview = await existingSourcePath(root, item.meta.preview)
    previews.set(item.name, preview)
    if (!preview) {
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
      const candidates = sourcePaths(root, file.path)
      if (!isWithin(root, candidates[0]!)) {
        issues.push({
          item: item.name,
          field: "files[].path",
          message: `File path is outside the repository: ${file.path}`,
        })
        continue
      }

      const sourcePath = await existingSourcePath(root, file.path)
      if (!sourcePath) {
        issues.push({ item: item.name, field: "files[].path", message: `File does not exist: ${file.path}` })
        continue
      }
      filePaths.add(sourcePath)
    }
    filesByItem.set(item.name, filePaths)
  }

  for (const item of items) {
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
