import { readFile, realpath } from "node:fs/promises"
import { resolve, sep } from "node:path"
import type { InternalRegistryItem } from "./types"

export type ItemSource = { path: string; content: string }

function isWithin(root: string, target: string): boolean {
  return target === root || target.startsWith(`${root}${sep}`)
}

function sourceDirectory(item: InternalRegistryItem): string {
  if (item.type === "registry:block") return "blocks"
  if (item.type === "registry:page") return "templates"
  return "ui"
}

export async function readItemSources(item: InternalRegistryItem, cwd = process.cwd()): Promise<ItemSource[]> {
  const registryRoot = await realpath(resolve(cwd, "registry"))
  const itemRoot = resolve(registryRoot, sourceDirectory(item))

  return Promise.all((item.files ?? []).map(async (file) => {
    if (file.path.split(/[\\/]/).includes("..")) throw new Error("Source path escapes registry root")

    const candidates = [resolve(itemRoot, file.path), resolve(registryRoot, file.path)]
    for (const path of candidates) {
      if (!isWithin(registryRoot, path)) throw new Error("Source path escapes registry root")
      try {
        const canonicalPath = await realpath(path)
        if (!isWithin(registryRoot, canonicalPath)) throw new Error("Source path escapes registry root")
        return { path: file.path, content: await readFile(canonicalPath, "utf8") }
      } catch (error) {
        if (error instanceof Error && error.message === "Source path escapes registry root") throw error
      }
    }

    throw new Error(`Source file does not exist: ${file.path}`)
  }))
}
