# 站点 shadcn/ui 化改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Shaker UI 站点展示层完整迁移到 shadcn/ui 组件与 CSS 变量 token 体系，主题切换改用 next-themes，保持现有交互契约与 `pnpm verify` 全绿。

**Architecture:** 官方 `shadcn` CLI 初始化并安装组件到 `components/ui/`；按组件逐个重写 `components/site/`，同步删除 `app/globals.css` 中对应的自定义类；最后接入 next-themes（`.dark` class）并清理遗留样式。`registry/`、CLI 契约与 `src/` 逻辑不动。

**Tech Stack:** Next.js 16（静态导出）、React 19、Tailwind CSS v4、shadcn/ui（new-york, neutral）、next-themes、cmdk、Radix UI、lucide-react、Vitest、Testing Library（含 user-event）、Playwright。

**Spec:** `docs/superpowers/specs/2026-07-29-shadcn-site-adoption-design.md`

## Global Constraints

- 路由、信息架构、中文文案不变。
- 交互契约不变：aria-label（`搜索资产…`、`切换主题`、`搜索资产`）、`role="option"`、`data-testid="preview-viewport"`、iframe `title="{title} preview"`、预览宽度 Mobile=390px、`.site-header`/`.site-footer`/`.site-main`/`.preview-host` 类名保留在对应元素上（仅作标记，无样式）。
- 所有非 `next/link` 站内路径继续经 `src/base-path.ts` 的 `withBasePath()` 处理。
- `registry/`、`/r/*.json`、`src/registry/*` 不修改。
- 每个 Task 结束必须 `pnpm test` 全绿且 `pnpm build:site` 成功后才提交。

## 关键背景（执行者零上下文所需）

- 本地 Node 20 跑不动 Vitest（jsdom 30 依赖 Node 22 的 API），请在 Node 22+ 环境执行；CI 使用 Node 22。
- `src/base-path.ts` 导出 `withBasePath(href)`：为 `/` 开头的路径加 `NEXT_PUBLIC_BASE_PATH` 前缀，其他原样返回。
- 现有测试是迁移的验收契约；除 Task 3（command-menu 重写）和 Task 7（主题断言）外不得修改。
- `app/preview/[name]/page.tsx` 的预览页通过 `?theme=dark` 查询参数控制预览主题，该契约必须保留。
- 推送方式：`git push` 需要凭据助手：`git -c credential.helper='!f() { echo username=x-access-token; echo password=$(gh auth token); }; f' push origin main`。

---

### Task 1: shadcn 基础设施初始化

**Files:**
- Create: `components.json`
- Create: `lib/utils.ts`
- Create: `components/ui/*.tsx`（CLI 生成）
- Modify: `app/globals.css`
- Modify: `vitest.setup.ts`
- Modify: `package.json` / `pnpm-lock.yaml`

- [ ] **Step 1: 运行 shadcn init**

```bash
pnpm dlx shadcn@latest init -y -b neutral
```

Expected: 生成 `components.json`（style new-york、baseColor neutral、cssVariables true、别名 `@/components`、`@/lib/utils` 等）与 `lib/utils.ts`（`cn()`），安装 `class-variance-authority`、`clsx`、`tailwind-merge`、`tw-animate-css`，并向 `app/globals.css` 写入 token 模板。若 init 覆盖了 `globals.css` 中的自定义规则，从 git 恢复后进入下一步手工合并。

- [ ] **Step 2: 安装站点所需组件**

```bash
pnpm dlx shadcn@latest add button card dialog command select toggle-group badge alert
pnpm add next-themes lucide-react
pnpm add -D @testing-library/user-event
```

Expected: `components/ui/` 下出现 8 个组件文件；`package.json` 新增上述依赖与 radix 包。

- [ ] **Step 3: 合并 globals.css**

确保 `app/globals.css` 顶部为 shadcn 标准 token 模板（若 init 已生成，核对一致即可）：

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.371 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* legacy: 以下自定义规则随组件迁移逐步删除，Task 7 全部移除 */
```

在 `/* legacy ... */` 注释之后，原样追加改造前 `app/globals.css` 的全部旧规则（即从 `:root { color: #171717; ... }` 到媒体查询的完整内容），末尾加 `/* legacy end */`。这些旧规则在 Task 2–7 中按选择器分批删除。

- [ ] **Step 4: 为 jsdom 补充 cmdk/Radix 桩**

在 `vitest.setup.ts` 末尾追加：

```ts
// jsdom stubs required by cmdk and Radix primitives
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
```

- [ ] **Step 5: 基线验证**

Run: `pnpm test && pnpm build:site`

Expected: 全部 PASS；构建成功（legacy 规则仍在，页面视觉不变）。

- [ ] **Step 6: 提交**

```bash
git add components.json lib components/ui app/globals.css vitest.setup.ts package.json pnpm-lock.yaml
git commit -m "chore: init shadcn ui for the site"
```

---

### Task 2: PreviewFrame 迁移到 ToggleGroup/Button

**Files:**
- Modify: `components/site/preview-frame.tsx`
- Modify: `app/globals.css`（删除 legacy 中 `.preview-frame`、`.preview-frame__toolbar`、`.preview-frame__viewport`、`.preview-frame iframe`、`.preview-frame__code`、`.preview-frame__code-hint`、`.preview-frame__copy-error` 规则）
- Test: `tests/site/preview-frame.test.tsx`（不改，作为契约）

- [ ] **Step 1: 确认契约测试基线**

Run: `pnpm test tests/site/preview-frame.test.tsx`
Expected: 4 个测试 PASS（当前实现）。

- [ ] **Step 2: 重写 preview-frame.tsx**

完整替换为：

```tsx
"use client"

import { useState } from "react"
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
        <ToggleGroup type="single" value={mode} onValueChange={(value) => { if (value) setMode(value as "preview" | "code") }} aria-label="内容模式" size="sm">
          <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
          <ToggleGroupItem value="code">Code</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="single" value={theme} onValueChange={(value) => { if (value) setTheme(value as "light" | "dark") }} aria-label="主题" size="sm">
          <ToggleGroupItem value="light">Light</ToggleGroupItem>
          <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="single" value={width} onValueChange={(value) => { if (value) setWidth(value as Width) }} aria-label="预览宽度" size="sm">
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
```

- [ ] **Step 3: 删除对应 legacy CSS**

从 `app/globals.css` 的 legacy 块中删除所有 `.preview-frame`、`.preview-frame__*`、`.preview-frame iframe` 规则。

- [ ] **Step 4: 运行测试与构建**

Run: `pnpm test tests/site/preview-frame.test.tsx && pnpm build:site`

Expected: 4 个测试 PASS（选择器与断言全部兼容新实现）；构建成功。

- [ ] **Step 5: 提交**

```bash
git add components/site/preview-frame.tsx app/globals.css
git commit -m "refactor: rebuild preview frame with shadcn toggle group"
```

---

### Task 3: CommandMenu 迁移到 Dialog + Command + Select

**Files:**
- Modify: `components/site/command-menu.tsx`（整体重写）
- Modify: `tests/site/search.test.tsx`（CommandMenu 部分重写；`rankSearch` 部分不动）
- Modify: `tests/e2e/registry-site.spec.ts`（1 行）
- Modify: `app/globals.css`（删除 legacy 中 `.command-menu-backdrop`、`.command-menu`、`.command-menu__*` 规则）

- [ ] **Step 1: 先写失败测试**

将 `tests/site/search.test.tsx` 中 `describe("CommandMenu", ...)` 整块替换为（`rankSearch` 的 describe 保持原样）：

```tsx
describe("CommandMenu", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("opens from the shortcut, filters documents, and exposes navigable results", async () => {
    const user = userEvent.setup()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => docs }))
    render(<SiteHeader />)

    fireEvent.keyDown(window, { key: "k", ctrlKey: true })
    expect(await screen.findByRole("dialog", { name: "搜索资产" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /搜索资产/ })).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K")

    await waitFor(() => expect(screen.getAllByRole("option", { name: /Button/ })).toHaveLength(2))
    await user.click(screen.getByRole("combobox", { name: "状态" }))
    await user.click(await screen.findByRole("option", { name: "stable" }))
    expect(screen.queryByRole("option", { name: /Request approval/ })).not.toBeInTheDocument()

    const input = screen.getByRole("combobox", { name: "搜索资产" })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    const results = within(screen.getByRole("listbox", { name: "搜索结果" })).getAllByRole("option")
    await waitFor(() => expect(results[1]).toHaveAttribute("aria-selected", "true"))
    fireEvent.keyDown(input, { key: "Escape" })
    expect(screen.queryByRole("dialog", { name: "搜索资产" })).not.toBeInTheDocument()
  })

  it("navigates the arrow-selected result when Enter is pressed", async () => {
    const onNavigate = vi.fn()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => docs }))
    render(<CommandMenu open onOpenChange={vi.fn()} onNavigate={onNavigate} />)

    await waitFor(() => expect(within(screen.getByRole("listbox", { name: "搜索结果" })).getAllByRole("option")).toHaveLength(3))
    const input = screen.getByRole("combobox", { name: "搜索资产" })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(input, { key: "ArrowDown" })
    await waitFor(() => expect(within(screen.getByRole("listbox", { name: "搜索结果" })).getAllByRole("option")[2]).toHaveAttribute("aria-selected", "true"))
    fireEvent.keyDown(input, { key: "Enter" })

    expect(onNavigate).toHaveBeenCalledWith("/items/button-group/")
  })

  it("clears a transient loading error after reopening and retrying", async () => {
    const fetchSearchIndex = vi.fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({ ok: true, json: async () => docs })
    vi.stubGlobal("fetch", fetchSearchIndex)
    const onOpenChange = vi.fn()
    const view = render(<CommandMenu open onOpenChange={onOpenChange} />)

    expect(await screen.findByText("搜索索引加载失败，请稍后重试。")).toBeInTheDocument()
    view.rerender(<CommandMenu open={false} onOpenChange={onOpenChange} />)
    view.rerender(<CommandMenu open onOpenChange={onOpenChange} />)

    await waitFor(() => expect(screen.queryByText("搜索索引加载失败，请稍后重试。")).not.toBeInTheDocument())
    await waitFor(() => expect(within(screen.getByRole("listbox", { name: "搜索结果" })).getAllByRole("option")).toHaveLength(3))
    expect(fetchSearchIndex).toHaveBeenCalledTimes(2)
  })
})
```

同时在文件头部 import 中加入 `userEvent`：

```ts
import userEvent from "@testing-library/user-event"
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/site/search.test.tsx`

Expected: FAIL（旧实现没有 cmdk combobox 输入框和 Radix Select）。

- [ ] **Step 3: 重写 command-menu.tsx**

完整替换为：

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { rankSearch, type SearchFilters } from "@/src/registry/search"
import type { SearchDocument } from "@/src/registry/search-index"
import { withBasePath } from "@/src/base-path"

type CommandMenuProps = {
  open: boolean
  onOpenChange(open: boolean): void
  onNavigate?(href: string): void
}

const ALL = "__all__"

function navigateToAsset(href: string) {
  window.location.assign(href)
}

export function CommandMenu({ open, onOpenChange, onNavigate = navigateToAsset }: CommandMenuProps) {
  const [documents, setDocuments] = useState<SearchDocument[]>([])
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<SearchFilters>({})
  const [hasLoaded, setHasLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!open || hasLoaded) return

    let cancelled = false
    setLoadError(false)
    fetch(withBasePath("/search-index.json"))
      .then((response) => {
        if (!response.ok) throw new Error("无法加载搜索索引")
        return response.json() as Promise<SearchDocument[]>
      })
      .then((items) => {
        if (!cancelled) {
          setDocuments(items)
          setHasLoaded(true)
          setLoadError(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })

    return () => { cancelled = true }
  }, [hasLoaded, open])

  const results = useMemo(() => rankSearch(query, documents, filters), [documents, filters, query])
  const types = useMemo(() => [...new Set(documents.map((item) => item.type))].sort(), [documents])
  const categories = useMemo(() => [...new Set(documents.flatMap((item) => item.categories))].sort(), [documents])
  const statuses = useMemo(() => [...new Set(documents.map((item) => item.status))].sort(), [documents])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">搜索资产</DialogTitle>
        <Command shouldFilter={false}>
          <CommandInput aria-label="搜索资产" placeholder="搜索组件、区块或模板" value={query} onValueChange={setQuery} />
          <div className="flex gap-2 border-b px-3 py-2" aria-label="筛选资产">
            <FilterSelect label="类型" placeholder="全部类型" values={types} value={filters.type} onChange={(type) => setFilters((current) => ({ ...current, type }))} />
            <FilterSelect label="分类" placeholder="全部分类" values={categories} value={filters.category} onChange={(category) => setFilters((current) => ({ ...current, category }))} />
            <FilterSelect label="状态" placeholder="全部状态" values={statuses} value={filters.status} onChange={(status) => setFilters((current) => ({ ...current, status: status as SearchDocument["status"] | undefined }))} />
          </div>
          <CommandList aria-label="搜索结果">
            {loadError ? <p className="m-3 text-sm text-muted-foreground">搜索索引加载失败，请稍后重试。</p> : null}
            {!loadError && !hasLoaded ? <p className="m-3 text-sm text-muted-foreground">正在加载资产…</p> : null}
            {hasLoaded && !loadError ? (
              <>
                <CommandEmpty>没有匹配的资产。</CommandEmpty>
                <CommandGroup>
                  {results.map((result) => (
                    <CommandItem key={result.name} value={result.name} onSelect={() => onNavigate(withBasePath(result.href))}>
                      <span>
                        <strong>{result.title}</strong>
                        <small className="block text-muted-foreground">{result.description}</small>
                      </span>
                      <small className="text-muted-foreground">{result.status}</small>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function FilterSelect({ label, placeholder, values, value, onChange }: {
  label: string
  placeholder: string
  values: string[]
  value: string | undefined
  onChange(value: string | undefined): void
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? undefined : next)}>
      <SelectTrigger aria-label={label} size="sm" className="w-32">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {values.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 4: 更新 E2E 中的搜索输入角色**

`tests/e2e/registry-site.spec.ts` 第 7 行，cmdk 输入框 role 为 combobox：

```ts
// 旧
await page.getByRole("textbox", { name: "搜索资产" }).fill("button")
// 新
await page.getByRole("combobox", { name: "搜索资产" }).fill("button")
```

- [ ] **Step 5: 删除对应 legacy CSS**

从 legacy 块删除 `.command-menu-backdrop`、`.command-menu`、`.command-menu__input`、`.command-menu__filters`、`.command-menu__results`、`.command-menu__result` 规则。

- [ ] **Step 6: 运行测试与构建**

Run: `pnpm test tests/site/search.test.tsx && pnpm build:site`

Expected: PASS；构建成功。

- [ ] **Step 7: 提交**

```bash
git add components/site/command-menu.tsx tests/site/search.test.tsx tests/e2e/registry-site.spec.ts app/globals.css
git commit -m "refactor: rebuild command menu with shadcn dialog and command"
```

---

### Task 4: AssetDetail 迁移到 Badge/Alert/Button

**Files:**
- Modify: `components/site/asset-detail.tsx`
- Modify: `app/globals.css`（删除 legacy 中 `.asset-detail`、`.asset-detail__meta`、`.asset-warning`、`.asset-detail pre`、`.asset-detail details + details`、`.install-command` 规则）
- Test: `tests/site/asset-detail.test.tsx`（不改，作为契约）

- [ ] **Step 1: 确认契约测试基线**

Run: `pnpm test tests/site/asset-detail.test.tsx`
Expected: 2 个测试 PASS。

- [ ] **Step 2: 重写 asset-detail.tsx**

完整替换为：

```tsx
"use client"

import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
```

- [ ] **Step 3: 删除对应 legacy CSS 并验证**

从 legacy 块删除 `.asset-detail`、`.asset-detail__meta`、`.asset-warning`、`.asset-detail pre`、`.asset-detail details + details`、`.install-command` 规则。

Run: `pnpm test tests/site/asset-detail.test.tsx && pnpm test tests/site/preview-frame.test.tsx && pnpm build:site`

Expected: 全部 PASS（内容顺序、弃用提示、replacedBy 链接、安装命令断言不变）。

- [ ] **Step 4: 提交**

```bash
git add components/site/asset-detail.tsx app/globals.css
git commit -m "refactor: rebuild asset detail with shadcn badge and alert"
```

---

### Task 5: 目录页与首页迁移

**Files:**
- Modify: `components/site/asset-index.tsx`
- Modify: `components/site/grouped-asset-index.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`（删除 legacy 中 `.asset-index`、`.grouped-index`、`.asset-list`、`.asset-list--large`、`.asset-link`、`.home-assets`、`.home-hero`、`.button-row`、`.eyebrow`、`.page-intro` 规则）
- Test: `tests/site/asset-index.test.tsx`（不改，作为契约）

- [ ] **Step 1: 确认契约测试基线**

Run: `pnpm test tests/site/asset-index.test.tsx`
Expected: PASS。

- [ ] **Step 2: 重写 asset-index.tsx**

完整替换为：

```tsx
import type { InternalRegistryItem } from "@/src/registry/types"
import { withBasePath } from "@/src/base-path"

type AssetIndexProps = {
  title: string
  description: string
  items: InternalRegistryItem[]
}

function AssetLink({ item, labelSuffix }: { item: InternalRegistryItem; labelSuffix?: string }) {
  return (
    <a className="group flex items-center justify-between gap-4 border-b py-4" href={withBasePath(`/items/${item.name}/`)} aria-label={`${item.title ?? item.name}${labelSuffix ?? ""}`}>
      <span>
        <strong className="block text-base font-semibold group-hover:underline">{item.title ?? item.name}</strong>
        <small className="mt-1 block text-sm text-muted-foreground">{item.description}</small>
      </span>
      <span aria-hidden="true">→</span>
    </a>
  )
}

export function AssetIndex({ title, description, items }: AssetIndexProps) {
  const recentlyAdded = [...items]
    .sort((left, right) => right.meta.addedAt.localeCompare(left.meta.addedAt))
    .slice(0, 6)
  const alphabetical = [...items].sort((left, right) => left.name.localeCompare(right.name))

  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">资产目录</p>
      <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      <section className="mt-12" aria-labelledby="recent-assets">
        <h2 id="recent-assets" className="text-xl font-semibold tracking-tight">最近新增</h2>
        <div className="border-t">{recentlyAdded.map((item) => <AssetLink key={item.name} item={item} labelSuffix="，最近新增" />)}</div>
      </section>
      <section className="mt-12" aria-labelledby="all-assets">
        <h2 id="all-assets" className="text-xl font-semibold tracking-tight">全部组件</h2>
        <div className="border-t">{alphabetical.map((item) => <AssetLink key={item.name} item={item} />)}</div>
      </section>
    </section>
  )
}
```

- [ ] **Step 3: 重写 grouped-asset-index.tsx（条目换 Card）**

完整替换为：

```tsx
import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { InternalRegistryItem } from "@/src/registry/types"

type GroupedAssetIndexProps = {
  title: string
  description: string
  items: InternalRegistryItem[]
}

export function GroupedAssetIndex({ title, description, items }: GroupedAssetIndexProps) {
  const groups = new Map<string, InternalRegistryItem[]>()
  for (const item of items) {
    const categories = item.categories?.length ? item.categories : ["未分类"]
    for (const category of categories) {
      groups.set(category, [...(groups.get(category) ?? []), item])
    }
  }

  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">资产目录</p>
      <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>
      {[...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, group]) => (
        <section key={category} className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">{category}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {group.map((item) => (
              <Link href={`/items/${item.name}/`} key={item.name} className="block">
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle>{item.title ?? item.name}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </section>
  )
}
```

- [ ] **Step 4: 重写 app/page.tsx**

完整替换为：

```tsx
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { loadCatalog } from "@/src/registry/catalog"

export default async function Home() {
  const items = await loadCatalog()
  const recent = [...items].sort((a, b) => b.meta.addedAt.localeCompare(a.meta.addedAt)).slice(0, 6)
  const featured = items.filter((item) => item.meta.featured)

  return (
    <div>
      <section className="border-b pb-16 pt-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">SHADCN REGISTRY</p>
        <h1 className="mt-2 text-5xl font-bold tracking-tight">团队可复用的 UI 资产</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">一个轻量、可审查、可被 shadcn CLI 直接消费的内部组件目录。</p>
        <div className="mt-7 flex gap-3">
          <Button asChild><Link href="/components/">浏览资产</Link></Button>
          <Button variant="outline" asChild><Link href="/docs/cli/">配置 CLI</Link></Button>
        </div>
      </section>
      <AssetSection title="最近新增" items={recent} />
      {featured.length ? <AssetSection title="精选资产" items={featured} /> : null}
    </div>
  )
}

function AssetSection({ title, items }: { title: string; items: Awaited<ReturnType<typeof loadCatalog>> }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="border-t">
        {items.map((item) => (
          <Link className="group flex items-center justify-between gap-4 border-b py-4" href={`/items/${item.name}/`} key={item.name}>
            <span>
              <strong className="block text-base font-semibold group-hover:underline">{item.title ?? item.name}</strong>
              <small className="mt-1 block text-sm text-muted-foreground">{item.description}</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 5: 删除对应 legacy CSS 并验证**

从 legacy 块删除 `.asset-index`、`.grouped-index`、`.asset-list`、`.asset-list--large`、`.asset-link`（含 `strong`/`small`/hover 子规则）、`.home-assets`、`.home-hero`、`.button-row`、`.eyebrow`、`.page-intro` 规则。

Run: `pnpm test tests/site/asset-index.test.tsx && pnpm build:site`

Expected: PASS（`最近新增`、`全部组件` 标题与 `/items/button/` 链接断言不变）；构建成功。

- [ ] **Step 6: 提交**

```bash
git add components/site/asset-index.tsx components/site/grouped-asset-index.tsx app/page.tsx app/globals.css
git commit -m "refactor: rebuild asset directories and home with shadcn card and button"
```

---

### Task 6: 壳层组件迁移（header/footer/docs-shell/frame/error-boundary）

**Files:**
- Modify: `components/site/site-header.tsx`
- Modify: `components/site/site-footer.tsx`
- Modify: `components/site/docs-shell.tsx`
- Modify: `components/site/site-frame.tsx`
- Modify: `components/site/preview-error-boundary.tsx`
- Modify: `app/globals.css`（删除 legacy 中 `.site-header*`、`.site-brand*`、`.site-nav`、`.site-actions`、`.icon-button`、`.site-footer`、`.docs-shell*`、`.site-main`、`.button`、`.button--primary`、`kbd` 规则，以及媒体查询中除 `.site-main`/`docs-shell` 外已删选择器的对应规则；`.site-header`、`.site-footer`、`.site-main` 类名保留在 JSX 中作为测试标记，无需样式）
- Test: `tests/site/search.test.tsx`、`tests/site/asset-index.test.tsx`（不改，作为契约）

- [ ] **Step 1: 重写 site-header.tsx**

完整替换为（主题切换逻辑保持 `data-theme` 旧实现，Task 7 再换成 next-themes）：

```tsx
"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { CommandMenu } from "./command-menu"

const navigation = [
  { href: "/docs/cli/", label: "Docs" },
  { href: "/components/", label: "Components" },
  { href: "/blocks/", label: "Blocks" },
  { href: "/templates/", label: "Templates" },
]

export function SiteHeader() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    return () => { delete document.documentElement.dataset.theme }
  }, [theme])

  return (
    <>
      <header className="site-header border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
          <Link className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold tracking-tight" href="/">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-xs text-primary-foreground" aria-hidden="true">S</span>
            Shaker UI
          </Link>
          <nav className="hidden gap-5 text-sm text-muted-foreground md:flex" aria-label="主导航">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="transition-colors hover:text-foreground">{item.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" aria-keyshortcuts="Control+K Meta+K" onClick={() => setIsSearchOpen(true)}>
              搜索资产… <kbd className="ml-1 text-xs text-muted-foreground">⌘K</kbd>
            </Button>
            <Button variant="outline" size="sm" aria-label="切换主题" aria-pressed={theme === "dark"} onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}>◐</Button>
          </div>
        </div>
      </header>
      <CommandMenu open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  )
}
```

- [ ] **Step 2: 重写 site-footer.tsx**

完整替换为：

```tsx
type SiteFooterProps = {
  buildRef?: string
}

export function SiteFooter({ buildRef = process.env.NEXT_PUBLIC_BUILD_REF ?? "dev" }: SiteFooterProps) {
  return (
    <footer className="site-footer mx-auto flex max-w-6xl flex-wrap justify-between gap-2 border-t px-5 py-6 text-xs text-muted-foreground">
      <p>Shaker UI · 内部组件资产中心</p>
      <p>构建版本：{buildRef}</p>
    </footer>
  )
}
```

- [ ] **Step 3: 重写 docs-shell.tsx**

完整替换为（结构、`details` 移动导航、`withBasePath` 均保留）：

```tsx
import type { ReactNode } from "react"
import { withBasePath } from "@/src/base-path"

export type DocsNavigationItem = {
  href: string
  label: string
}

export type DocsTocItem = {
  href: string
  label: string
}

type DocsShellProps = {
  navigation: DocsNavigationItem[]
  toc?: DocsTocItem[]
  children: ReactNode
}

export function DocsShell({ navigation, toc, children }: DocsShellProps) {
  return (
    <div className="grid gap-12 lg:grid-cols-[11rem_minmax(0,1fr)_10rem]">
      <details className="rounded-md border p-3 lg:hidden">
        <summary className="cursor-pointer text-sm font-semibold">文档导航</summary>
        <nav className="mt-3 grid gap-2 border-t pt-3 text-sm" aria-label="移动文档导航">
          {navigation.map((item) => <a key={item.href} href={withBasePath(item.href)} className="text-muted-foreground hover:text-foreground">{item.label}</a>)}
          {toc?.map((item) => <a key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">{item.label}</a>)}
        </nav>
      </details>
      <aside className="hidden text-sm lg:block" aria-label="文档导航">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">文档</p>
        <nav className="mt-3 grid gap-2">
          {navigation.map((item) => <a key={item.href} href={withBasePath(item.href)} className="text-muted-foreground hover:text-foreground">{item.label}</a>)}
        </nav>
      </aside>
      <article className="max-w-2xl">{children}</article>
      {toc?.length ? (
        <aside className="hidden text-sm lg:block" aria-label="本页目录">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">本页目录</p>
          <nav className="mt-3 grid gap-2">
            {toc.map((item) => <a key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">{item.label}</a>)}
          </nav>
        </aside>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: 重写 site-frame.tsx 与 preview-error-boundary.tsx**

`site-frame.tsx`：仅替换 `<main>` 的 className，结构不动：

```tsx
<main className="site-main mx-auto min-h-[calc(100vh-8.5rem)] max-w-[86rem] px-5 pb-20 pt-14">{children}</main>
```

`preview-error-boundary.tsx` 的 fallback 改用 Button（其余不动）：

```tsx
import { Button } from "@/components/ui/button"
// ...
return (
  <div className="p-8" role="alert">
    <p>预览加载失败</p>
    <Button className="mt-2" variant="outline" size="sm" onClick={() => window.location.reload()}>重新加载预览</Button>
  </div>
)
```

- [ ] **Step 5: 删除对应 legacy CSS 并验证**

从 legacy 块删除 `.site-header`、`.site-header__inner`、`.site-brand`、`.site-brand__mark`、`.site-nav`、`.site-actions`、`.icon-button`、`.site-footer`、`.site-main`、`.docs-shell`、`.docs-shell__*`、`.button`、`.button--primary`、`kbd` 相关规则；媒体查询中仅保留仍存在选择器引用的规则（本任务后媒体查询应只剩空壳，可整体删除，`.preview-route`/`.preview-host*`/`.preview-error`/`:root[data-theme]`/基础排版规则留给 Task 7）。

Run: `pnpm test && pnpm build:site`

Expected: 全部 PASS（search 测试中的 header 契约：aria-keyshortcuts、快捷键打开、主题按钮 aria-label 均不变；asset-index 测试中 docs-shell 的 `details` 与双份链接断言不变）。

- [ ] **Step 6: 提交**

```bash
git add components/site app/globals.css
git commit -m "refactor: rebuild site chrome with shadcn button"
```

---

### Task 7: next-themes 主题机制与样式收尾

**Files:**
- Create: `components/site/theme-provider.tsx`
- Modify: `app/layout.tsx`
- Modify: `components/site/site-header.tsx`（主题切换换 useTheme + lucide 图标）
- Modify: `components/site/preview-host.tsx`（移除手写主题 class，setTheme 同步 query）
- Modify: `app/preview/layout.tsx`（去掉 `.preview-route` 类）
- Modify: `tests/e2e/registry-site.spec.ts`（主题断言 1 行）
- Modify: `app/globals.css`（删除整个 legacy 块）

- [ ] **Step 1: 更新 E2E 主题断言（先失败）**

`tests/e2e/registry-site.spec.ts` 第 36 行：

```ts
// 旧
await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
// 新
await expect(page.locator("html")).toHaveClass(/dark/)
```

- [ ] **Step 2: 创建 theme-provider.tsx 并接入根布局**

`components/site/theme-provider.tsx`：

```tsx
"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ComponentProps, ReactNode } from "react"

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider> & { children: ReactNode }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

`app/layout.tsx` 完整替换为：

```tsx
import "./globals.css"
import type { Metadata } from "next"
import { SiteFrame } from "@/components/site/site-frame"
import { ThemeProvider } from "@/components/site/theme-provider"

export const metadata: Metadata = {
  title: "Shaker UI",
  description: "团队可复用的 UI 资产",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SiteFrame>{children}</SiteFrame>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: 主题切换换 useTheme**

`components/site/site-header.tsx` 中：

- import 增加 `import { useTheme } from "next-themes"` 与 `import { Moon, Sun } from "lucide-react"`；
- 删除 `const [theme, setTheme] = useState<"light" | "dark">("light")` 与写 `document.documentElement.dataset.theme` 的 effect；
- 替换为：

```tsx
const { resolvedTheme, setTheme } = useTheme()
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
```

- 主题按钮替换为：

```tsx
<Button variant="outline" size="icon" aria-label="切换主题" aria-pressed={mounted && resolvedTheme === "dark"} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
  {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
</Button>
```

- [ ] **Step 4: 预览页主题同步**

`components/site/preview-host.tsx` 完整替换为：

```tsx
"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { previewMap } from "@/generated/preview-map"
import { PreviewErrorBoundary } from "./preview-error-boundary"

export function PreviewHost({ name }: { name: string }) {
  const theme = useSearchParams().get("theme") === "dark" ? "dark" : "light"
  const { setTheme } = useTheme()
  const Preview = previewMap[name]

  useEffect(() => { setTheme(theme) }, [setTheme, theme])

  if (!Preview) return null

  return (
    <div className="preview-host min-h-screen bg-background p-8 text-foreground">
      <PreviewErrorBoundary><Preview /></PreviewErrorBoundary>
    </div>
  )
}
```

`app/preview/layout.tsx` 完整替换为：

```tsx
export default function PreviewLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <main>{children}</main>
}
```

- [ ] **Step 5: 删除整个 legacy 块**

从 `app/globals.css` 删除 `/* legacy ... */` 到 `/* legacy end */` 之间的全部内容（含注释行）。此时 `globals.css` 只剩 Task 1 的 token 模板。

- [ ] **Step 6: 完整验证**

Run: `pnpm verify`

Expected: 单测、构建、CLI 冒烟、E2E（含新主题断言与 axe）全部 PASS。

- [ ] **Step 7: 提交**

```bash
git add components/site/theme-provider.tsx components/site/site-header.tsx components/site/preview-host.tsx app/layout.tsx app/preview/layout.tsx app/globals.css tests/e2e/registry-site.spec.ts
git commit -m "feat: switch site theming to next-themes with shadcn tokens"
```

---

### Task 8: 全量验证与文档收尾

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: 全量验证**

Run: `pnpm verify`

Expected: 全部 PASS。

- [ ] **Step 2: 更新 AGENTS.md**

- 「仓库结构」一节补充：`components/ui/`（shadcn CLI 安装的站点私有 UI 组件，不进入 Registry 安装载荷）、`lib/utils.ts`（`cn()`）。
- 「代码风格与开发约定」一节补充：
  - 站点 UI 一律使用 `components/ui/` 中的 shadcn/ui 组件与 Tailwind token 类（如 `bg-muted`、`text-muted-foreground`），禁止新增手写按钮/下拉/对话框等价物。
  - 主题使用 `next-themes`（`.dark` class + CSS 变量）；新增站点 UI 组件用 `pnpm dlx shadcn@latest add <name>` 安装。
  - `globals.css` 只保留 shadcn token 模板，不添加自定义组件类。

- [ ] **Step 3: 提交**

```bash
git add AGENTS.md
git commit -m "docs: record shadcn ui site conventions"
```

---

## 完成条件

- `components/site/` 中不存在手写按钮、下拉、对话框、徽章、警告条等价物。
- `globals.css` 只剩 shadcn token 模板（无 legacy 自定义类）。
- 主站与预览 iframe 的主题均通过 `.dark` class + CSS 变量生效，`?theme=dark` 契约保留。
- `pnpm verify` 全绿；GitHub Pages 部署下 `/shaker` 前缀站内链接、搜索、预览、主题切换正常。
