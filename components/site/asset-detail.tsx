"use client"

import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/ui/alert"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import type { ItemSource } from "@/src/registry/source"
import type { InternalRegistryItem } from "@/src/registry/types"
import { withBasePath } from "@/src/base-path"
import { PreviewFrame } from "./preview-frame"

export function AssetDetail({ item, sources }: { item: InternalRegistryItem; sources: ItemSource[] }) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const command = `pnpm dlx shadcn@latest add @internal/${item.name}`

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setCopyFailed(false)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{item.type}</p>
        <h1 className="text-4xl font-bold tracking-tight">{item.title ?? item.name}</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          状态：
          <Badge variant={item.meta.status === "deprecated" ? "destructive" : item.meta.status === "experimental" ? "outline" : "secondary"}>{item.meta.status}</Badge>
          来源：
          <Badge variant="outline">{item.meta.origin}</Badge>
        </p>
        {item.description ? <p className="max-w-2xl leading-relaxed text-muted-foreground">{item.description}</p> : null}
        {item.meta.status === "deprecated" ? (
          <Alert>
            <AlertTitle>此资产已弃用</AlertTitle>
            <AlertDescription>
              {item.meta.replacedBy ? <>请改用 <a className="underline" href={withBasePath(`/items/${item.meta.replacedBy}/`)}>{item.meta.replacedBy}</a>。</> : null}
            </AlertDescription>
          </Alert>
        ) : null}
      </header>
      <Section title="Preview"><PreviewFrame name={item.name} title={item.title ?? item.name} code={sources[0]?.content} /></Section>
      <Section title="Code">
        {sources.length ? sources.map((source) => (
          <details key={source.path} className="rounded-md border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">{source.path}</summary>
            <pre className="overflow-x-auto border-t p-4 text-sm"><code>{source.content}</code></pre>
          </details>
        )) : <p className="text-sm text-muted-foreground">暂无源码文件。</p>}
      </Section>
      <Section title="Installation">
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted p-3">
          <code className="text-sm">{command}</code>
          <Button size="sm" variant="outline" onClick={copyCommand}>{copied ? "已复制" : "复制命令"}</Button>
        </div>
        {copyFailed ? <p className="mt-2 text-sm text-destructive" role="alert">复制失败，请手动复制</p> : null}
      </Section>
      <Section title="Usage"><p className="text-sm">通过 shadcn CLI 安装后，在项目中导入该资产。</p></Section>
      <Section title="Examples"><p className="text-sm">预览区域展示默认使用方式。</p></Section>
      <Section title="Dependencies">
        {item.registryDependencies?.length ? (
          <ul className="list-disc pl-5 text-sm">{item.registryDependencies.map((dependency) => <li key={dependency}>{dependency}</li>)}</ul>
        ) : <p className="text-sm text-muted-foreground">无内部依赖。</p>}
      </Section>
      <Section title="Docs">
        {item.docs ? <a className="text-sm underline" href={item.docs} target="_blank" rel="noreferrer">查看补充文档</a> : <p className="text-sm text-muted-foreground">暂无补充文档</p>}
      </Section>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-6">
      <h2 className="mb-4 text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}
