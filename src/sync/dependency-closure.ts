import type { RegistryItem } from "shadcn/schema"
import type { UpstreamSource } from "./config"
import { fetchRegistryItem } from "./fetch-item"
import type { FetchedItem } from "./fetch-item"

export type DependencyRequest = {
  source: UpstreamSource
  roots: string[]
  allowedItems: ReadonlySet<string>
  fetchItem?: (source: UpstreamSource, name: string) => Promise<FetchedItem>
}

type DependencyRef =
  | { kind: "local"; name: string }
  | { kind: "internal"; name: string }
  | { kind: "external"; value: string }

const NAMESPACED_PATTERN = /^@([^/]+)\/(.+)$/

function classifyDependency(dep: string, source: UpstreamSource): DependencyRef {
  if (dep.startsWith("http://") || dep.startsWith("https://")) {
    return { kind: "external", value: dep }
  }
  const namespaced = NAMESPACED_PATTERN.exec(dep)
  if (namespaced) {
    const [, scope, name] = namespaced
    if (scope === "internal") return { kind: "internal", name }
    if (source.namespace !== undefined && scope === source.namespace) {
      return { kind: "local", name }
    }
    return { kind: "external", value: dep }
  }
  return { kind: "local", name: dep }
}

export function rewriteMirroredDependencies(
  item: RegistryItem,
  mirroredNames: ReadonlySet<string>,
): RegistryItem {
  const deps = item.registryDependencies
  if (deps === undefined || deps.length === 0) return item
  const rewritten = deps.map((dep) =>
    !dep.startsWith("@") && mirroredNames.has(dep) ? `@internal/${dep}` : dep,
  )
  return {
    ...item,
    registryDependencies: rewritten.filter((dep, index) => rewritten.indexOf(dep) === index),
  }
}

export async function resolveDependencyClosure(
  request: DependencyRequest,
): Promise<FetchedItem[]> {
  const { source, roots, allowedItems } = request
  const fetchItem = request.fetchItem ?? ((s, n) => fetchRegistryItem(s, n))

  const allowed = new Set(allowedItems)
  const visited = new Set<string>()
  const fetched = new Map<string, FetchedItem>()
  const queue = [...roots]

  while (queue.length > 0) {
    const name = queue.shift() as string
    if (visited.has(name)) continue
    visited.add(name)

    if (!allowed.has(name)) {
      throw new Error(
        `Upstream source "${source.id}" item "${name}" is not in the configured allowlist`,
      )
    }

    const result = await fetchItem(source, name)

    // Normalize local dependencies (bare names or the source's own namespace)
    // to bare names, mirror them recursively, and reject everything else.
    const normalizedDeps: string[] = []
    for (const dep of result.item.registryDependencies ?? []) {
      const ref = classifyDependency(dep, source)
      if (ref.kind === "external") {
        throw new Error(
          `Upstream source "${source.id}" item "${name}" requires external dependency "${ref.value}", which is not mapped to an allowlisted source`,
        )
      }
      if (ref.kind === "internal") {
        if (!normalizedDeps.includes(dep)) normalizedDeps.push(dep)
        continue
      }
      if (!normalizedDeps.includes(ref.name)) normalizedDeps.push(ref.name)
      if (!visited.has(ref.name) && !queue.includes(ref.name)) {
        allowed.add(ref.name)
        queue.push(ref.name)
      }
    }

    const item =
      normalizedDeps.length > 0 || (result.item.registryDependencies ?? []).length > 0
        ? { ...result.item, registryDependencies: normalizedDeps }
        : result.item
    fetched.set(name, { ...result, item })
  }

  const names = [...fetched.keys()].sort()
  const mirroredNames = new Set(names)
  return names.map((name) => {
    const result = fetched.get(name) as FetchedItem
    return { ...result, item: rewriteMirroredDependencies(result.item, mirroredNames) }
  })
}
