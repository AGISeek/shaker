import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/ui/card"
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
    <section>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">资产目录</p>
      <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, group]) => (
        <section key={category} className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">{category}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {group.map((item) => (
              <Link href={`/items/${item.name}/`} key={item.name} className="block">
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle>{item.title ?? item.name}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </section>
  )
}
