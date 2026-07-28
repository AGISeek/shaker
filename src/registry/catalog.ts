import { loadRegistry } from "shadcn/registry"
import type { InternalRegistryItem } from "./types"

export async function loadCatalog(cwd = process.cwd()): Promise<InternalRegistryItem[]> {
  const registry = await loadRegistry({ cwd, registryFile: "registry/registry.json" })
  return registry.items as InternalRegistryItem[]
}
