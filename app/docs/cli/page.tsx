import { DocsShell } from "@/components/site/docs-shell"

const navigation = [{ href: "/docs/cli/", label: "CLI 配置" }]
const toc = [{ href: "#install", label: "安装资产" }, { href: "#config", label: "Registry 配置" }]

export default function CliDocsPage() {
  return (
    <DocsShell navigation={navigation} toc={toc}>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">DOCS</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">配置 CLI</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">将内部 Registry 地址写入 shadcn 配置后，即可按名称安装资产。</p>
      <h2 id="install" className="mt-12 text-xl font-semibold tracking-tight">安装资产</h2>
      <pre className="mt-4 overflow-x-auto rounded-md border bg-muted p-4 text-sm"><code>pnpm dlx shadcn@latest add @internal/button</code></pre>
      <h2 id="config" className="mt-12 text-xl font-semibold tracking-tight">Registry 配置</h2>
      <pre className="mt-4 overflow-x-auto rounded-md border bg-muted p-4 text-sm"><code>{`{\n  "registries": { "@internal": "https://registry.example.com/r/{name}.json" }\n}`}</code></pre>
    </DocsShell>
  )
}
