import type { InternalRegistryItem } from "@/src/registry/types"
import { withBasePath } from "@/src/base-path"

type AssetIndexProps = {
  title: string
  description: string
  items: InternalRegistryItem[]
}

function AssetLink({ item, labelSuffix }: { item: InternalRegistryItem; labelSuffix?: string }) {
  return (
    <a className="asset-link" href={withBasePath(`/items/${item.name}/`)} aria-label={`${item.title ?? item.name}${labelSuffix ?? ""}`}>
      <span>
        <strong>{item.title ?? item.name}</strong>
        <small>{item.description}</small>
      </span>
      <span aria-hidden="true">→</span>
    </a>
  )
}

export function AssetIndex({ title, description, items }: AssetIndexProps) {
  const recentlyAdded = [...items]
    .sort((left, right) => right.meta.addedAt.localeCompare(left.meta.addedAt))
    .slice(0, 6)
  const alphabetical = [...items].sort((left, right) => left.name.localeCompare(right.name))

  return (
    <section className="asset-index">
      <p className="eyebrow">资产目录</p>
      <h1>{title}</h1>
      <p className="page-intro">{description}</p>
      <section aria-labelledby="recent-assets">
        <h2 id="recent-assets">最近新增</h2>
        <div className="asset-list">{recentlyAdded.map((item) => <AssetLink key={item.name} item={item} labelSuffix="，最近新增" />)}</div>
      </section>
      <section aria-labelledby="all-assets">
        <h2 id="all-assets">全部组件</h2>
        <div className="asset-list">{alphabetical.map((item) => <AssetLink key={item.name} item={item} />)}</div>
      </section>
    </section>
  )
}
