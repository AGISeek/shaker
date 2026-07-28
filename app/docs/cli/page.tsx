import { DocsShell } from "@/components/site/docs-shell"

const navigation = [{ href: "/docs/cli/", label: "CLI 配置" }]
const toc = [{ href: "#install", label: "安装资产" }, { href: "#config", label: "Registry 配置" }]

export default function CliDocsPage() {
  return <DocsShell navigation={navigation} toc={toc}>
    <p className="eyebrow">DOCS</p><h1>配置 CLI</h1>
    <p className="page-intro">将内部 Registry 地址写入 shadcn 配置后，即可按名称安装资产。</p>
    <h2 id="install">安装资产</h2><pre><code>pnpm dlx shadcn@latest add @internal/button</code></pre>
    <h2 id="config">Registry 配置</h2><pre><code>{`{\n  "registries": { "@internal": "https://registry.example.com/r/{name}.json" }\n}`}</code></pre>
  </DocsShell>
}
