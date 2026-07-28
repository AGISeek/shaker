import { notFound } from "next/navigation"
import { AssetDetail } from "@/components/site/asset-detail"
import { loadCatalog } from "@/src/registry/catalog"
import { readItemSources } from "@/src/registry/source"

export async function generateStaticParams() {
  return (await loadCatalog()).map(({ name }) => ({ name }))
}

export default async function ItemPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const item = (await loadCatalog()).find((candidate) => candidate.name === name)
  if (!item) notFound()

  return <AssetDetail item={item} sources={await readItemSources(item)} />
}
