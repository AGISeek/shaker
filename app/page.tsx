import Link from "next/link"
import { Button } from "@/ui/button"
import { loadCatalog } from "@/src/registry/catalog"

export default async function Home() {
  const items = await loadCatalog()
  const recent = [...items].sort((a, b) => b.meta.addedAt.localeCompare(a.meta.addedAt)).slice(0, 6)
  const featured = items.filter((item) => item.meta.featured)

  return (
    <div>
      <section className="border-b pb-16 pt-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">SHADCN REGISTRY</p>
        <h1 className="mt-2 text-5xl font-bold tracking-tight">团队可复用的 UI 资产</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">一个轻量、可审查、可被 shadcn CLI 直接消费的内部组件目录。</p>
        <div className="mt-7 flex gap-3">
          <Button asChild><Link href="/components/">浏览资产</Link></Button>
          <Button variant="outline" asChild><Link href="/docs/cli/">配置 CLI</Link></Button>
        </div>
      </section>
      <AssetSection title="最近新增" items={recent} />
      {featured.length ? <AssetSection title="精选资产" items={featured} /> : null}
    </div>
  )
}

function AssetSection({ title, items }: { title: string; items: Awaited<ReturnType<typeof loadCatalog>> }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="border-t">
        {items.map((item) => (
          <Link className="group flex items-center justify-between gap-4 border-b py-4" href={`/items/${item.name}/`} key={item.name}>
            <span>
              <strong className="block text-base font-semibold group-hover:underline">{item.title ?? item.name}</strong>
              <small className="mt-1 block text-sm text-muted-foreground">{item.description}</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
