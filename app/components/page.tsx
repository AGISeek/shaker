import { AssetIndex } from "@/components/site/asset-index"
import { loadCatalog } from "@/src/registry/catalog"

export default async function ComponentsPage() {
  const items = (await loadCatalog()).filter((item) => item.type === "registry:ui")
  return <AssetIndex title="Components" description="适用于产品界面的基础可复用组件。" items={items} />
}
