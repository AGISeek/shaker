"use client"

import { useState } from "react"
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react"
import { Button } from "@/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/ui/toggle-group"
import { withBasePath } from "@/src/base-path"

type PreviewFrameProps = { name: string; title: string; code?: string }
type Width = "1280" | "768" | "390"

export function PreviewFrame({ name, title, code }: PreviewFrameProps) {
  const [mode, setMode] = useState<"preview" | "code">("preview")
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [width, setWidth] = useState<Width>("1280")
  const [refresh, setRefresh] = useState(0)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const src = withBasePath(theme === "light" ? `/preview/${name}/` : `/preview/${name}/?theme=dark`)
  const command = `pnpm dlx shadcn@latest add @internal/${name}`

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
    <section className="rounded-md border" aria-label={`${title} 预览`}>
      <div className="flex flex-wrap items-center gap-2 border-b p-2">
        {/* Radix type="single" 渲染 radio 语义，这里用 multiple 模拟单选以保留 button 角色 */}
        <ToggleGroup type="multiple" value={[mode]} onValueChange={(values) => { const next = values.at(-1); if (next) setMode(next as "preview" | "code") }} aria-label="内容模式" size="sm">
          <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
          <ToggleGroupItem value="code">Code</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="multiple" value={[theme]} onValueChange={(values) => { const next = values.at(-1); if (next) setTheme(next as "light" | "dark") }} aria-label="主题" size="sm">
          <ToggleGroupItem value="light">Light</ToggleGroupItem>
          <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="multiple" value={[width]} onValueChange={(values) => { const next = values.at(-1); if (next) setWidth(next as Width) }} aria-label="预览宽度" size="sm">
          <ToggleGroupItem value="1280">Desktop</ToggleGroupItem>
          <ToggleGroupItem value="768">Tablet</ToggleGroupItem>
          <ToggleGroupItem value="390">Mobile</ToggleGroupItem>
        </ToggleGroup>
        <Button variant="outline" size="sm" aria-label="刷新预览" onClick={() => setRefresh((value) => value + 1)}>
          <RefreshCw />刷新
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={src} target="_blank" rel="noreferrer"><ExternalLink />新标签页</a>
        </Button>
        <Button variant="outline" size="sm" onClick={copyCommand}>
          {copied ? <><Check />已复制</> : <><Copy />复制命令</>}
        </Button>
      </div>
      {mode === "preview" ? (
        <div className="overflow-auto bg-muted p-4">
          <div data-testid="preview-viewport" className="mx-auto" style={{ width: `${width}px`, maxWidth: "100%" }}>
            <iframe key={`${src}-${refresh}`} src={src} title={`${title} preview`} className="block h-96 w-full border-0 bg-background" />
          </div>
        </div>
      ) : code ? (
        <pre className="overflow-x-auto p-4 text-sm"><code>{code}</code></pre>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">暂无源码文件。</p>
      )}
      {copyFailed ? <p className="m-2 text-sm text-destructive" role="alert">复制失败，请手动复制</p> : null}
    </section>
  )
}
