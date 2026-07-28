import { GroupedAssetIndex } from "@/components/site/grouped-asset-index"
import { loadCatalog } from "@/src/registry/catalog"

export default async function TemplatesPage() {
  const items = (await loadCatalog()).filter((item) => (item.type as string) === "registry:template")
  return <GroupedAssetIndex title="Templates" description="可作为项目起点的完整页面模板。" items={items} />
}
