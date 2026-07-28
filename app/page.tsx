import Link from "next/link"
import { loadCatalog } from "@/src/registry/catalog"

export default async function Home() {
  const items = await loadCatalog()
  const recent = [...items].sort((a, b) => b.meta.addedAt.localeCompare(a.meta.addedAt)).slice(0, 6)
  const featured = items.filter((item) => item.meta.featured)

  return (
    <div className="home-page">
      <section className="home-hero">
        <p className="eyebrow">SHADCN REGISTRY</p>
        <h1>团队可复用的 UI 资产</h1>
        <p>一个轻量、可审查、可被 shadcn CLI 直接消费的内部组件目录。</p>
        <div className="button-row">
          <Link className="button button--primary" href="/components/">浏览资产</Link>
          <Link className="button" href="/docs/cli/">配置 CLI</Link>
        </div>
      </section>
      <AssetSection title="最近新增" items={recent} />
      {featured.length ? <AssetSection title="精选资产" items={featured} /> : null}
    </div>
  )
}

function AssetSection({ title, items }: { title: string; items: Awaited<ReturnType<typeof loadCatalog>> }) {
  return (
    <section className="home-assets">
      <h2>{title}</h2>
      <div className="asset-list">
        {items.map((item) => (
          <Link className="asset-link" href={`/items/${item.name}/`} key={item.name}>
            <span><strong>{item.title ?? item.name}</strong><small>{item.description}</small></span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
