import Link from "next/link"
import type { InternalRegistryItem } from "@/src/registry/types"

type GroupedAssetIndexProps = {
  title: string
  description: string
  items: InternalRegistryItem[]
}

export function GroupedAssetIndex({ title, description, items }: GroupedAssetIndexProps) {
  const groups = new Map<string, InternalRegistryItem[]>()
  for (const item of items) {
    const categories = item.categories?.length ? item.categories : ["未分类"]
    for (const category of categories) {
      groups.set(category, [...(groups.get(category) ?? []), item])
    }
  }

  return (
    <section className="grouped-index">
      <p className="eyebrow">资产目录</p><h1>{title}</h1><p className="page-intro">{description}</p>
      {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, group]) => (
        <section key={category}><h2>{category}</h2><div className="asset-list asset-list--large">
          {group.map((item) => <Link className="asset-link" href={`/items/${item.name}/`} key={item.name}><span><strong>{item.title ?? item.name}</strong><small>{item.description}</small></span><span aria-hidden="true">→</span></Link>)}
        </div></section>
      ))}
    </section>
  )
}
