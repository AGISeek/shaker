import { loadCatalog } from "@/src/registry/catalog"
import { GroupedAssetIndex } from "@/components/site/grouped-asset-index"

export default async function BlocksPage() {
  const items = (await loadCatalog()).filter((item) => item.type === "registry:block")
  return <GroupedAssetIndex title="Blocks" description="由多个组件组合而成的页面区块。" items={items} />
}
