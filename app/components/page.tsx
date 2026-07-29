import { AssetIndex } from "@/components/site/asset-index"
import { loadCatalog } from "@/src/registry/catalog"
import type { InternalRegistryItem } from "@/src/registry/types"

export function filterComponentItems(items: InternalRegistryItem[]) {
  return items.filter((item) => item.type === "registry:ui" || item.type === "registry:component")
}

export default async function ComponentsPage() {
  const items = filterComponentItems(await loadCatalog())
  return <AssetIndex title="Components" description="适用于产品界面的基础可复用组件。" items={items} />
}
