import { notFound } from "next/navigation"
import { PreviewHost } from "@/components/site/preview-host"
import { loadCatalog } from "@/src/registry/catalog"
import { previewMap } from "@/generated/preview-map"

export async function generateStaticParams() {
  return (await loadCatalog()).map(({ name }) => ({ name }))
}

export default async function PreviewPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const exists = (await loadCatalog()).some((item) => item.name === name)
  if (!exists || !previewMap[name]) notFound()

  return <PreviewHost name={name} />
}
