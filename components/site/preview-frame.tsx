"use client"

import { useState } from "react"

type PreviewFrameProps = { name: string; title: string }
type Width = "1280" | "768" | "390"

export function PreviewFrame({ name, title }: PreviewFrameProps) {
  const [mode, setMode] = useState<"preview" | "code">("preview")
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [width, setWidth] = useState<Width>("1280")
  const [refresh, setRefresh] = useState(0)
  const [copied, setCopied] = useState(false)
  const src = theme === "light" ? `/preview/${name}/` : `/preview/${name}/?theme=dark`
  const command = `pnpm dlx shadcn@latest add @internal/${name}`

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // The installation panel retains an accessible failure message for manual copying.
    }
  }

  return (
    <section className="preview-frame" aria-label={`${title} 预览`}>
      <div className="preview-frame__toolbar">
        <div role="group" aria-label="内容模式">
          <button className={mode === "preview" ? "is-active" : ""} onClick={() => setMode("preview")}>Preview</button>
          <button className={mode === "code" ? "is-active" : ""} onClick={() => setMode("code")}>Code</button>
        </div>
        <div role="group" aria-label="主题">
          <button className={theme === "light" ? "is-active" : ""} onClick={() => setTheme("light")}>Light</button>
          <button className={theme === "dark" ? "is-active" : ""} onClick={() => setTheme("dark")}>Dark</button>
        </div>
        <div role="group" aria-label="预览宽度">
          <button onClick={() => setWidth("1280")}>Desktop</button>
          <button onClick={() => setWidth("768")}>Tablet</button>
          <button onClick={() => setWidth("390")}>Mobile</button>
        </div>
        <button aria-label="刷新预览" onClick={() => setRefresh((value) => value + 1)}>刷新</button>
        <a href={src} target="_blank" rel="noreferrer">新标签页</a>
        <button onClick={copyCommand}>{copied ? "已复制" : "复制命令"}</button>
      </div>
      {mode === "preview" ? (
        <div className="preview-frame__viewport" data-testid="preview-viewport" style={{ width: `${width}px` }}>
          <iframe key={`${src}-${refresh}`} src={src} title={`${title} preview`} />
        </div>
      ) : <p className="preview-frame__code-hint">请在下方 Code 区域查看源码。</p>}
    </section>
  )
}
