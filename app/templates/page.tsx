import { GroupedAssetIndex } from "@/components/site/grouped-asset-index"
import { loadCatalog } from "@/src/registry/catalog"
import type { InternalRegistryItem } from "@/src/registry/types"

export function filterTemplateItems(items: InternalRegistryItem[]) {
  return items.filter((item) => item.type === "registry:page")
}

export default async function TemplatesPage() {
  const items = filterTemplateItems(await loadCatalog())
  return <GroupedAssetIndex title="Templates" description="可作为项目起点的完整页面模板。" items={items} />
}
