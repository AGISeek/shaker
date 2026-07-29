"use client"

import { useState } from "react"
import type { ItemSource } from "@/src/registry/source"
import type { InternalRegistryItem } from "@/src/registry/types"
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
    <article className="asset-detail">
      <header>
        <p className="eyebrow">{item.type}</p>
        <h1>{item.title ?? item.name}</h1>
        <p className="asset-detail__meta">状态：{item.meta.status} · 来源：{item.meta.origin}</p>
        {item.description ? <p className="page-intro">{item.description}</p> : null}
        {item.meta.status === "deprecated" ? <p className="asset-warning"><strong>此资产已弃用</strong>。{item.meta.replacedBy ? <>请改用 <a href={`/items/${item.meta.replacedBy}/`}>{item.meta.replacedBy}</a>。</> : null}</p> : null}
      </header>
      <section><h2>Preview</h2><PreviewFrame name={item.name} title={item.title ?? item.name} code={sources[0]?.content} /></section>
      <section><h2>Code</h2>{sources.length ? sources.map((source) => <details key={source.path}><summary>{source.path}</summary><pre><code>{source.content}</code></pre></details>) : <p>暂无源码文件。</p>}</section>
      <section><h2>Installation</h2><div className="install-command"><code>{command}</code><button className="button" onClick={copyCommand}>{copied ? "已复制" : "复制命令"}</button></div>{copyFailed ? <p role="alert">复制失败，请手动复制</p> : null}</section>
      <section><h2>Usage</h2><p>通过 shadcn CLI 安装后，在项目中导入该资产。</p></section>
      <section><h2>Examples</h2><p>预览区域展示默认使用方式。</p></section>
      <section><h2>Dependencies</h2>{item.registryDependencies?.length ? <ul>{item.registryDependencies.map((dependency) => <li key={dependency}>{dependency}</li>)}</ul> : <p>无内部依赖。</p>}</section>
      <section><h2>Docs</h2>{item.docs ? <a href={item.docs} target="_blank" rel="noreferrer">查看补充文档</a> : <p>暂无补充文档</p>}</section>
    </article>
  )
}
