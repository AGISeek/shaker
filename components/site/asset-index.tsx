import type { InternalRegistryItem } from "@/src/registry/types"
import { withBasePath } from "@/src/base-path"

type AssetIndexProps = {
  title: string
  description: string
  items: InternalRegistryItem[]
}

function AssetLink({ item, labelSuffix }: { item: InternalRegistryItem; labelSuffix?: string }) {
  return (
    <a className="group flex items-center justify-between gap-4 border-b py-4" href={withBasePath(`/items/${item.name}/`)} aria-label={`${item.title ?? item.name}${labelSuffix ?? ""}`}>
      <span>
        <strong className="block text-base font-semibold group-hover:underline">{item.title ?? item.name}</strong>
        <small className="mt-1 block text-sm text-muted-foreground">{item.description}</small>
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
    <section>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">资产目录</p>
      <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      <section className="mt-12" aria-labelledby="recent-assets">
        <h2 id="recent-assets" className="text-xl font-semibold tracking-tight">最近新增</h2>
        <div className="border-t">{recentlyAdded.map((item) => <AssetLink key={item.name} item={item} labelSuffix="，最近新增" />)}</div>
      </section>
      <section className="mt-12" aria-labelledby="all-assets">
        <h2 id="all-assets" className="text-xl font-semibold tracking-tight">全部组件</h2>
        <div className="border-t">{alphabetical.map((item) => <AssetLink key={item.name} item={item} />)}</div>
      </section>
    </section>
  )
}
