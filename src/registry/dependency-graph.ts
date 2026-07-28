import type { InternalRegistryItem } from "./types"

const internalDependencyPrefix = "@internal/"

export function internalDependencyNames(item: InternalRegistryItem): string[] {
  return (item.registryDependencies ?? []).flatMap((dependency) =>
    dependency.startsWith(internalDependencyPrefix)
      ? [dependency.slice(internalDependencyPrefix.length)]
      : [],
  )
}

export function findDependencyCycle(items: InternalRegistryItem[]): string[] | null {
  const itemsByName = new Map(items.map((item) => [item.name, item]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const path: string[] = []

  function visit(name: string): string[] | null {
    if (visiting.has(name)) {
      const cycleStart = path.indexOf(name)
      return [...path.slice(cycleStart), name]
    }

    if (visited.has(name)) return null

    const item = itemsByName.get(name)
    if (!item) return null

    visiting.add(name)
    path.push(name)

    for (const dependency of internalDependencyNames(item)) {
      const cycle = visit(dependency)
      if (cycle) return cycle
    }

    path.pop()
    visiting.delete(name)
    visited.add(name)
    return null
  }

  for (const item of items) {
    const cycle = visit(item.name)
    if (cycle) return cycle
  }

  return null
}
