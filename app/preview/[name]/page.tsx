import { notFound } from "next/navigation"
import { Suspense } from "react"
import { PreviewHost } from "@/components/site/preview-host"
import { loadCatalog } from "@/src/registry/catalog"

export async function generateStaticParams() {
  return (await loadCatalog()).map(({ name }) => ({ name }))
}

export default async function PreviewPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const exists = (await loadCatalog()).some((item) => item.name === name)
  if (!exists) notFound()

  return <Suspense fallback={<div className="preview-host" />}><PreviewHost name={name} /></Suspense>
}
