import type { InternalRegistryItem } from "./types"

export type SearchDocument = {
  name: string
  title: string
  description: string
  type: string
  categories: string[]
  status: InternalRegistryItem["meta"]["status"]
  addedAt: string
  href: string
}

export function toSearchDocument(item: InternalRegistryItem): SearchDocument {
  return {
    name: item.name,
    title: item.title ?? item.name,
    description: item.description ?? "",
    type: item.type,
    categories: item.categories ?? [],
    status: item.meta.status,
    addedAt: item.meta.addedAt,
    href: `/items/${item.name}/`,
  }
}
