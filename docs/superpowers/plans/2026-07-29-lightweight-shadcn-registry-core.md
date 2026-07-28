# 轻量 shadcn Registry 核心站点实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可静态部署、兼容官方 shadcn CLI、支持组件/业务区块/页面模板浏览与真实预览的内部 Registry 核心站点。

**Architecture:** 使用单个 Next.js 静态导出应用；`registry/` 是 CLI 与站点的唯一事实源。构建期加载并校验 Registry，生成 `/r/*.json`、预览映射和客户端搜索索引，随后用真实 shadcn CLI 对静态产物执行契约测试。

**Tech Stack:** Next.js、React、TypeScript、Tailwind CSS、shadcn、Zod、Vitest、Testing Library、Playwright、axe-core、pnpm。

## Global Constraints

- 只提供一个 `@internal` namespace。
- 基础组件使用 `registry:ui` 或 `registry:component`，业务区块使用 `registry:block`，页面模板使用 `registry:page`。
- Git 和 Pull Request 是唯一发布入口；站点只读。
- 最终产物必须是一个无需常驻 Node.js 服务的静态目录。
- 不引入数据库、认证、运行时 API、搜索服务、monorepo 或工作区编排。
- Registry catalog、站点文档、搜索数据和预览信息必须来自同一份 Registry 源。
- 所有预览使用 `/preview/{name}` 静态路由并通过 iframe 隔离。
- 生成物 `public/r/`、`generated/preview-map.ts`、`public/search-index.json` 不提交 Git。
- CLI 契约只使用 shadcn 官方公开能力，不依赖未公开内部实现。
- 每项任务按测试先行、最小实现、验证、提交的顺序执行。

---

## 文件与职责总览

```text
app/
  layout.tsx                         # 全局 HTML、主题和站点壳层
  page.tsx                           # 首页
  components/page.tsx                # 组件目录
  blocks/page.tsx                    # 业务区块目录
  templates/page.tsx                 # 页面模板目录
  docs/cli/page.tsx                  # CLI 配置文档
  items/[name]/page.tsx              # 通用资产详情页
  preview/[name]/page.tsx            # iframe 内的静态预览页
components/site/
  site-header.tsx                    # 顶栏、主导航和搜索入口
  site-footer.tsx                    # 当前 Git SHA/Tag
  docs-shell.tsx                     # 左侧导航、正文、本页目录
  asset-index.tsx                    # 最近新增和完整索引
  asset-detail.tsx                   # 详情页内容顺序
  preview-frame.tsx                  # Preview/Code、视口、刷新、新窗口
  preview-error-boundary.tsx         # 预览错误隔离
  preview-host.tsx                   # iframe 内主题与错误边界
  command-menu.tsx                   # Command/Ctrl+K 客户端搜索
registry/
  registry.json                      # 根 catalog
  ui/registry.json                   # 基础组件定义
  ui/button/button.tsx               # 首个可安装组件
  ui/button/preview.tsx              # Button 预览
  blocks/registry.json               # 业务区块定义
  blocks/approval-card/*             # 示例业务区块与预览
  templates/registry.json            # 页面模板定义
  templates/admin-dashboard/*        # 示例页面模板与预览
src/registry/
  types.ts                           # 内部 meta 与标准化 catalog 类型
  catalog.ts                         # 加载官方 Registry 与 include
  validate.ts                        # 内部一致性校验
  dependency-graph.ts                # 依赖解析与环检测
  search-index.ts                    # 静态搜索数据生成
  generate.ts                        # 生成预览映射与搜索索引
  source.ts                          # 安全读取 Registry 源码
scripts/
  validate-registry.mjs              # 命令行校验入口
  generate-preview-map.mjs           # 生成静态预览导入映射
  build-search-index.mjs              # 生成客户端搜索索引
  serve-static.mjs                   # 测试用静态服务器
  cli-smoke.mjs                      # 真实 shadcn CLI 契约测试
  package-release.mjs                # 生成按 Git ref 命名的静态发布目录
generated/preview-map.ts             # 构建生成
public/r/                            # shadcn build 生成
public/search-index.json             # 构建生成
tests/
  registry/*                         # Registry 单元与契约测试
  site/*                             # 展示组件测试
  e2e/registry-site.spec.ts          # 浏览器主流程
  fixtures/consumer/components.json  # CLI 一次性消费项目配置
```

---

### Task 1: 建立静态 Next.js 与测试基线

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `playwright.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `.gitignore`
- Test: `tests/project/config.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces: `pnpm test`、`pnpm test:e2e`、`pnpm build:site`；Next.js 静态输出目录固定为 `out/`。

- [ ] **Step 1: 创建最小包清单和测试运行器**

创建 `package.json`，脚本先只包含测试入口：

```json
{
  "name": "internal-shadcn-registry",
  "private": true,
  "packageManager": "pnpm@10",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest",
    "shadcn": "latest",
    "tailwindcss": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@playwright/test": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@vitejs/plugin-react": "latest",
    "@tailwindcss/postcss": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
```

执行 `pnpm install` 并提交生成的 `pnpm-lock.yaml`，之后所有安装都必须使用
`--frozen-lockfile`。

- [ ] **Step 2: 写一个失败的项目配置测试**

创建 `tests/project/config.test.ts`：

```ts
import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("project configuration", () => {
  it("exports a static Next.js site and exposes the required build script", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"))
    const config = await import("../../next.config")

    expect(config.default.output).toBe("export")
    expect(config.default.trailingSlash).toBe(true)
    expect(pkg.scripts["build:site"]).toBe("next build")
  })
})
```

- [ ] **Step 3: 运行测试并确认失败**

Run: `pnpm test tests/project/config.test.ts`

Expected: FAIL，原因是 `next.config.ts` 不存在或 `build:site` 尚未定义。

- [ ] **Step 4: 添加静态导出配置和最小页面**

创建 `next.config.ts`：

```ts
import type { NextConfig } from "next"

const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
}

export default config
```

创建 `postcss.config.mjs`：

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
```

在 `package.json` 增加：

```json
"build:site": "next build"
```

`app/globals.css` 首行写入 `@import "tailwindcss";`。创建最小
`app/layout.tsx` 和 `app/page.tsx`，其中根布局只导入全局样式并渲染
`children`。配置 `tsconfig.json` 的 `@/*` 路径别名，配置 Vitest 的
`jsdom` 环境和 Testing Library setup。

- [ ] **Step 5: 运行基线验证**

Run: `pnpm test tests/project/config.test.ts && pnpm build:site`

Expected: 测试 PASS，`out/index.html` 存在。

- [ ] **Step 6: 提交**

```bash
git add package.json pnpm-lock.yaml next.config.ts postcss.config.mjs tsconfig.json vitest.config.ts vitest.setup.ts playwright.config.ts app .gitignore tests/project/config.test.ts
git commit -m "chore: bootstrap static registry site"
```

---

### Task 2: 建立 Registry 源和标准化 Catalog 加载器

**Files:**
- Create: `registry/registry.json`
- Create: `registry/ui/registry.json`
- Create: `registry/ui/button/button.tsx`
- Create: `registry/ui/button/preview.tsx`
- Create: `registry/blocks/registry.json`
- Create: `registry/templates/registry.json`
- Create: `src/registry/types.ts`
- Create: `src/registry/catalog.ts`
- Test: `tests/registry/catalog.test.ts`

**Interfaces:**
- Consumes: `loadRegistry` from `shadcn/registry`。
- Produces: `loadCatalog(cwd?: string): Promise<InternalRegistryItem[]>`；
  `InternalRegistryItem` 扩展官方条目并约束 `meta.status`、`meta.preview`。

- [ ] **Step 1: 写失败的 Catalog 测试**

```ts
import { describe, expect, it } from "vitest"
import { loadCatalog } from "@/src/registry/catalog"

describe("loadCatalog", () => {
  it("resolves includes and returns the button item", async () => {
    const items = await loadCatalog()
    expect(items.map((item) => item.name)).toContain("button")
    expect(items.find((item) => item.name === "button")?.meta).toMatchObject({
      status: "stable",
      preview: "registry/ui/button/preview.tsx",
      addedAt: "2026-07-29",
    })
  })
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/registry/catalog.test.ts`

Expected: FAIL，`loadCatalog` 不存在。

- [ ] **Step 3: 定义类型和 Catalog 加载器**

`src/registry/types.ts`：

```ts
import type { RegistryItem } from "shadcn/schema"

export type AssetStatus = "experimental" | "stable" | "deprecated"

export type InternalMeta = {
  status: AssetStatus
  preview: string
  addedAt: string
  featured?: boolean
  origin: "internal" | "upstream"
  sourceRef: string
  sourceDigest?: string
  replacedBy?: string
}

export type InternalRegistryItem = RegistryItem & { meta: InternalMeta }
```

`src/registry/catalog.ts`：

```ts
import { loadRegistry } from "shadcn/registry"
import type { InternalRegistryItem } from "./types"

export async function loadCatalog(cwd = process.cwd()): Promise<InternalRegistryItem[]> {
  const registry = await loadRegistry({ cwd, registryFile: "registry/registry.json" })
  return registry.items as InternalRegistryItem[]
}
```

- [ ] **Step 4: 添加根 Registry、Button 源码和预览**

根 `registry/registry.json` 使用：

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "internal",
  "homepage": "https://internal.example",
  "include": [
    "ui/registry.json",
    "blocks/registry.json",
    "templates/registry.json"
  ]
}
```

`registry/ui/registry.json` 定义 `button`，必须包含 `title`、`description`、
`categories`、`docs`、`files` 和完整 `meta`；初始 meta 固定为
`{"status":"stable","preview":"registry/ui/button/preview.tsx","addedAt":"2026-07-29","origin":"internal","sourceRef":"main"}`。
`button.tsx` 导出
`Button({ className, ...props }: React.ComponentProps<"button">)`；预览默认
导出渲染三个 variant 示例的 React 组件。

- [ ] **Step 5: 运行测试**

Run: `pnpm test tests/registry/catalog.test.ts`

Expected: PASS，Catalog 只包含 `button`。

- [ ] **Step 6: 提交**

```bash
git add registry src/registry/types.ts src/registry/catalog.ts tests/registry/catalog.test.ts
git commit -m "feat: add registry source catalog"
```

---

### Task 3: 实现内部一致性校验和依赖图

**Files:**
- Create: `src/registry/dependency-graph.ts`
- Create: `src/registry/validate.ts`
- Create: `scripts/validate-registry.mjs`
- Test: `tests/registry/validate.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `InternalRegistryItem[]` from `loadCatalog()`。
- Produces:
  - `validateCatalog(items, cwd): Promise<ValidationIssue[]>`
  - `assertValidCatalog(items, cwd): Promise<void>`
  - `findDependencyCycle(items): string[] | null`
  - `ValidationIssue = { item: string; field: string; message: string }`

- [ ] **Step 1: 写失败的校验测试**

测试必须覆盖重名、非法状态、缺失预览、`deprecated` 替代项不存在、内部依赖
成环和预览文件误入安装载荷：

```ts
it("reports a dependency cycle with the item path", async () => {
  const items = [
    item("a", { registryDependencies: ["@internal/b"] }),
    item("b", { registryDependencies: ["@internal/a"] }),
  ]
  const issues = await validateCatalog(items, fixtureRoot)
  expect(issues).toContainEqual({
    item: "a",
    field: "registryDependencies",
    message: "Dependency cycle: a -> b -> a",
  })
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/registry/validate.test.ts`

Expected: FAIL，校验接口不存在。

- [ ] **Step 3: 实现依赖图和校验器**

只把 `@internal/{name}` 解析为内部边。`validateCatalog` 按固定顺序检查：

1. 名称唯一。
2. `meta.status` 属于允许值。
3. `meta.addedAt` 是合法的 `YYYY-MM-DD` 日期。
4. `meta.preview` 指向存在的文件。
5. `files[].path` 存在且位于仓库内。
6. `meta.preview` 不在 `files` 中。
7. 内部 Registry 依赖存在。
8. 依赖图无环。
9. `deprecated` 的 `replacedBy` 存在且不等于自身。

`assertValidCatalog` 在存在问题时抛出 `RegistryValidationError`，错误文本逐行
采用 `"{item}.{field}: {message}"`。

- [ ] **Step 4: 添加 CLI 入口**

`scripts/validate-registry.mjs` 加载已编译的 TypeScript 入口，打印
`Validated {count} registry items.`；失败时打印问题并设置
`process.exitCode = 1`。在 `package.json` 添加：

```json
"registry:validate": "tsx scripts/validate-registry.mjs"
```

并安装 `tsx` 为开发依赖。

- [ ] **Step 5: 运行校验测试与真实 Catalog 校验**

Run: `pnpm test tests/registry/validate.test.ts && pnpm registry:validate`

Expected: 全部 PASS，命令输出 `Validated 1 registry items.`。

- [ ] **Step 6: 提交**

```bash
git add src/registry scripts/validate-registry.mjs tests/registry/validate.test.ts package.json pnpm-lock.yaml
git commit -m "feat: validate internal registry contracts"
```

---

### Task 4: 生成预览映射与搜索索引

**Files:**
- Create: `src/registry/search-index.ts`
- Create: `src/registry/generate.ts`
- Create: `scripts/generate-preview-map.mjs`
- Create: `scripts/build-search-index.mjs`
- Test: `tests/registry/generated-assets.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: 通过校验的 `InternalRegistryItem[]`。
- Produces:
  - `toSearchDocument(item): SearchDocument`
  - `SearchDocument = { name; title; description; type; categories; status; addedAt; href }`
  - `generateAssets(cwd?: string): Promise<void>`
  - `generated/preview-map.ts` 导出 `previewMap: Record<string, ComponentType>`
  - `public/search-index.json` 导出 `SearchDocument[]`

- [ ] **Step 1: 写失败的生成物测试**

```ts
it("creates deterministic preview and search manifests", async () => {
  await generateAssets()
  const preview = await readFile("generated/preview-map.ts", "utf8")
  const search = JSON.parse(await readFile("public/search-index.json", "utf8"))

  expect(preview).toContain(
    '"button": dynamic(() => import("../registry/ui/button/preview"), { ssr: false })',
  )
  expect(search[0]).toMatchObject({
    name: "button",
    status: "stable",
    href: "/items/button/",
  })
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/registry/generated-assets.test.ts`

Expected: FAIL，生成脚本和输出文件不存在。

- [ ] **Step 3: 实现确定性生成**

`src/registry/generate.ts` 导出 `generateAssets()`。它必须先调用
`assertValidCatalog`，再按 `name.localeCompare` 排序。预览映射文件首行固定为
`"use client"`，随后写入 `import dynamic from "next/dynamic"`；每项使用
`dynamic(() => import("..."), { ssr: false })` 的静态字符串 import，禁止
运行时拼接模块路径。搜索索引只输出公开展示字段，JSON 使用两个空格缩进并以
换行结束。

在 `package.json` 添加：

```json
"registry:generate": "tsx scripts/generate-preview-map.mjs && tsx scripts/build-search-index.mjs"
```

- [ ] **Step 4: 忽略生成物**

`.gitignore` 添加：

```gitignore
/generated/preview-map.ts
/public/r/
/public/search-index.json
/out/
/dist/
/.next/
```

测试通过后清理生成文件，确认 `git status --short` 不列出它们。

- [ ] **Step 5: 运行测试**

Run: `pnpm test tests/registry/generated-assets.test.ts && pnpm registry:generate`

Expected: PASS；两份输出内容稳定，重复运行无变化。

- [ ] **Step 6: 提交**

```bash
git add src/registry/search-index.ts src/registry/generate.ts scripts package.json .gitignore tests/registry/generated-assets.test.ts
git commit -m "feat: generate registry site manifests"
```

---

### Task 5: 实现 shadcn 风格站点壳层与资产目录

**Files:**
- Create: `components/site/site-header.tsx`
- Create: `components/site/site-footer.tsx`
- Create: `components/site/docs-shell.tsx`
- Create: `components/site/asset-index.tsx`
- Create: `app/components/page.tsx`
- Create: `app/blocks/page.tsx`
- Create: `app/templates/page.tsx`
- Create: `app/docs/cli/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/site/asset-index.test.tsx`

**Interfaces:**
- Consumes: `InternalRegistryItem[]` from `loadCatalog()`。
- Produces:
  - `AssetIndex({ title, description, items })`
  - `DocsShell({ navigation, toc, children })`
  - `SiteFooter({ buildRef })`
  - 目录路由 `/components/`、`/blocks/`、`/templates/`

- [ ] **Step 1: 写失败的 AssetIndex 测试**

```tsx
it("separates recently added assets from the alphabetical index", () => {
  render(<AssetIndex title="Components" description="Internal components" items={items} />)
  expect(screen.getByRole("heading", { name: "最近新增" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "全部组件" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Button" })).toHaveAttribute(
    "href",
    "/items/button/",
  )
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/site/asset-index.test.tsx`

Expected: FAIL，`AssetIndex` 不存在。

- [ ] **Step 3: 实现站点壳层**

`SiteHeader` 只包含品牌、Docs、Components、Blocks、Templates、搜索按钮和
主题按钮。`DocsShell` 在桌面渲染左导航和可选右侧本页目录，小屏折叠导航。
CSS 使用中性色、细边框和有限圆角，避免营销卡片视觉。

`SiteFooter` 显示 `NEXT_PUBLIC_BUILD_REF`，本地未设置时显示 `dev`。CI 构建
时该变量必须是完整 Git SHA 或 release tag。

- [ ] **Step 4: 实现首页与三类目录**

首页只提供“浏览资产”“配置 CLI”、最近新增和精选资产。最近新增按
`meta.addedAt` 倒序取前六项，精选资产来自 `meta.featured`。组件目录使用
“最近新增 + 字母索引”；Blocks 和 Templates 使用按 `categories` 分组的
大尺寸条目列表。页面都在构建期调用 `loadCatalog()` 并按 `type` 过滤。

- [ ] **Step 5: 运行站点单元测试和静态构建**

Run: `pnpm test tests/site/asset-index.test.tsx && pnpm registry:generate && pnpm build:site`

Expected: PASS，`out/components/index.html`、`out/blocks/index.html` 和
`out/templates/index.html` 存在。

- [ ] **Step 6: 提交**

```bash
git add app components/site tests/site/asset-index.test.tsx
git commit -m "feat: add shadcn-inspired asset directories"
```

---

### Task 6: 实现全局 Command/Ctrl+K 搜索

**Files:**
- Create: `components/site/command-menu.tsx`
- Create: `src/registry/search.ts`
- Modify: `components/site/site-header.tsx`
- Test: `tests/site/search.test.tsx`

**Interfaces:**
- Consumes: `/search-index.json` 的 `SearchDocument[]`。
- Produces:
  - `rankSearch(query: string, documents: SearchDocument[]): SearchDocument[]`
  - `CommandMenu` 负责加载索引、筛选类型/分类/状态并导航。

- [ ] **Step 1: 写失败的搜索排序测试**

测试精确名称优先于标题前缀、标题前缀优先于描述包含，并验证类型与状态筛选：

```ts
expect(rankSearch("button", docs).map((doc) => doc.name)).toEqual([
  "button",
  "button-group",
  "approval-card",
])
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/site/search.test.tsx`

Expected: FAIL，`rankSearch` 不存在。

- [ ] **Step 3: 实现纯函数搜索与命令菜单**

`rankSearch` 对 `name`、`title`、`description`、`categories` 做小写归一化，
空查询返回按名称排序的全部资产。`CommandMenu` 首次打开时 fetch
`/search-index.json`，支持 Escape 关闭、上下键选择、Enter 跳转。

- [ ] **Step 4: 接入全局快捷键**

`SiteHeader` 在客户端监听 `metaKey/ctrlKey + k`，按钮可见文本为
“搜索资产…”，并带 `aria-keyshortcuts="Control+K Meta+K"`。

- [ ] **Step 5: 运行测试**

Run: `pnpm test tests/site/search.test.tsx`

Expected: PASS，键盘打开、筛选和跳转均通过 Testing Library 测试。

- [ ] **Step 6: 提交**

```bash
git add components/site/command-menu.tsx components/site/site-header.tsx src/registry/search.ts tests/site/search.test.tsx
git commit -m "feat: add client-side asset search"
```

---

### Task 7: 实现详情页、源码读取与 iframe 预览

**Files:**
- Create: `src/registry/source.ts`
- Create: `components/site/asset-detail.tsx`
- Create: `components/site/preview-frame.tsx`
- Create: `components/site/preview-error-boundary.tsx`
- Create: `components/site/preview-host.tsx`
- Create: `app/items/[name]/page.tsx`
- Create: `app/preview/[name]/page.tsx`
- Test: `tests/registry/source.test.ts`
- Test: `tests/site/asset-detail.test.tsx`

**Interfaces:**
- Consumes: `loadCatalog()` 和 `previewMap`。
- Produces:
  - `readItemSources(item, cwd?): Promise<Array<{ path: string; content: string }>>`
  - `AssetDetail({ item, sources })`
  - `PreviewFrame({ name, title })`
  - `PreviewHost({ name })`
  - 静态路由 `/items/{name}/` 与 `/preview/{name}/`

- [ ] **Step 1: 写失败的安全源码读取测试**

```ts
it("rejects source paths that escape the repository", async () => {
  const unsafe = item("unsafe", {
    files: [{ path: "../secret.txt", type: "registry:file", target: "secret.txt" }],
  })
  await expect(readItemSources(unsafe, fixtureRoot)).rejects.toThrow(
    "Source path escapes registry root",
  )
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/registry/source.test.ts tests/site/asset-detail.test.tsx`

Expected: FAIL，源码读取器和详情组件不存在。

- [ ] **Step 3: 实现源码读取和详情内容顺序**

`readItemSources` 使用 `path.resolve` 后检查结果以 Registry 根路径开头，再读取
UTF-8。`AssetDetail` 严格按以下顺序输出：标题/状态/来源、Preview/Code、
Installation、Usage、Examples、Dependencies、Docs。
当状态为 `deprecated` 时，在标题后显示警告；存在 `meta.replacedBy` 时链接到
`/items/{replacedBy}/`，但仍保留安装命令。
缺少可选 `docs` 时显示“暂无补充文档”。复制安装命令成功后按钮文本切换为
“已复制”两秒；Clipboard API 失败时显示 `role="alert"` 的“复制失败，请手动
复制”。

安装命令固定为：

```text
pnpm dlx shadcn@latest add @internal/{name}
```

- [ ] **Step 4: 实现静态预览路由和错误边界**

两个动态路由都导出 `generateStaticParams()`，返回 Catalog 全部资产名。
`PreviewFrame` iframe 的 `src` 为 `/preview/${name}/`。预览页根据
`previewMap[name]` 渲染组件，未知名称调用 `notFound()`。

`PreviewHost` 是客户端组件，根据 URL 的 `theme=light|dark` 设置预览根元素
class，并在 `PreviewErrorBoundary` 内渲染 `previewMap[name]`。
`PreviewErrorBoundary` 捕获错误并显示“预览加载失败”“重新加载预览”按钮；
不得隐藏源码或安装区域。

- [ ] **Step 5: 实现工具栏**

工具栏提供 Preview/Code、Light/Dark、Desktop 1280、Tablet 768、Mobile
390、刷新、新标签页和复制命令。主题切换修改 iframe URL 的 `theme` 查询
参数；宽度改变只修改 iframe 容器，不修改浏览器 viewport。

- [ ] **Step 6: 运行测试和静态构建**

Run: `pnpm test tests/registry/source.test.ts tests/site/asset-detail.test.tsx && pnpm registry:generate && pnpm build:site`

Expected: PASS，`out/items/button/index.html` 和
`out/preview/button/index.html` 存在。

- [ ] **Step 7: 提交**

```bash
git add src/registry/source.ts components/site app/items app/preview tests/registry/source.test.ts tests/site/asset-detail.test.tsx
git commit -m "feat: add asset documentation and isolated previews"
```

---

### Task 8: 添加业务区块与页面模板示例

**Files:**
- Create: `registry/blocks/approval-card/approval-card.tsx`
- Create: `registry/blocks/approval-card/preview.tsx`
- Modify: `registry/blocks/registry.json`
- Create: `registry/templates/admin-dashboard/page.tsx`
- Create: `registry/templates/admin-dashboard/preview.tsx`
- Modify: `registry/templates/registry.json`
- Test: `tests/registry/example-assets.test.ts`

**Interfaces:**
- Consumes: `@internal/button`。
- Produces: `approval-card` 与 `admin-dashboard` 两个完整示例，用于验证多文件
  安装、内部依赖和页面预览。

- [ ] **Step 1: 写失败的示例资产测试**

```ts
it("contains one valid item for each supported asset class", async () => {
  const items = await loadCatalog()
  expect(items.map(({ name, type }) => [name, type])).toEqual(
    expect.arrayContaining([
      ["button", "registry:ui"],
      ["approval-card", "registry:block"],
      ["admin-dashboard", "registry:page"],
    ]),
  )
  await expect(assertValidCatalog(items)).resolves.toBeUndefined()
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/registry/example-assets.test.ts`

Expected: FAIL，两个示例尚不存在。

- [ ] **Step 3: 实现 ApprovalCard**

`ApprovalCard` 接收 `title`、`requester`、`amount`、`status` 和可选
`onApprove/onReject`，只依赖 `@internal/button`。Registry 定义必须包含：

```json
{
  "name": "approval-card",
  "type": "registry:block",
  "registryDependencies": ["@internal/button"],
  "categories": ["workflow", "forms"],
  "meta": {
    "status": "stable",
    "preview": "registry/blocks/approval-card/preview.tsx",
    "addedAt": "2026-07-29",
    "origin": "internal",
    "sourceRef": "main"
  }
}
```

- [ ] **Step 4: 实现 AdminDashboard**

页面模板包含标题栏、四个统计区域和审批列表，Registry 文件类型为
`registry:page`，每个文件都声明明确 `target`。预览使用固定演示数据，不访问
网络。

- [ ] **Step 5: 运行全部 Registry 测试和构建**

Run: `pnpm test tests/registry && pnpm registry:validate && pnpm registry:generate && pnpm build:site`

Expected: PASS，三个资产都有详情页和预览页。

- [ ] **Step 6: 提交**

```bash
git add registry tests/registry/example-assets.test.ts
git commit -m "feat: add block and page template examples"
```

---

### Task 9: 构建 Registry JSON 并执行真实 CLI 契约测试

**Files:**
- Create: `scripts/serve-static.mjs`
- Create: `scripts/cli-smoke.mjs`
- Create: `tests/fixtures/consumer/components.json`
- Create: `tests/fixtures/consumer/app/globals.css`
- Modify: `package.json`
- Test: `tests/registry/built-output.test.ts`

**Interfaces:**
- Consumes: `registry/registry.json`、静态站点 `out/`。
- Produces:
  - `pnpm registry:build`
  - `pnpm build`
  - `pnpm test:cli`
  - `startStaticServer({ root, port }): Promise<{ origin: string; close(): Promise<void> }>`
  - `/r/registry.json`、`/r/{name}.json`

- [ ] **Step 1: 写失败的构建产物测试**

```ts
it("builds a flat catalog and item payloads", async () => {
  const catalog = JSON.parse(await readFile("public/r/registry.json", "utf8"))
  const button = JSON.parse(await readFile("public/r/button.json", "utf8"))
  expect(catalog.include).toBeUndefined()
  expect(catalog.items.map((item: { name: string }) => item.name)).toContain("button")
  expect(button.files[0].content).toContain("export")
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/registry/built-output.test.ts`

Expected: FAIL，`public/r` 不存在。

- [ ] **Step 3: 添加构建脚本**

`package.json` 添加：

```json
{
  "registry:build": "shadcn build registry/registry.json --output public/r",
  "prebuild": "pnpm registry:validate && pnpm registry:generate && pnpm registry:build",
  "build": "next build",
  "test:cli": "node scripts/cli-smoke.mjs"
}
```

运行 `pnpm registry:build`，确认 catalog 已展开且 item 内嵌源码。

- [ ] **Step 4: 实现 CLI 冒烟脚本**

先在 `serve-static.mjs` 导出 `startStaticServer`。它使用 Node `http` 和
`fs`，只读取 `root` 内文件；请求目录时返回 `index.html`，路径逃逸返回 403，
不存在返回 404。直接执行脚本时接受 `root` 和 `--port` 参数。

`cli-smoke.mjs` 必须：

1. 调用 `startStaticServer({ root: "out", port: 0 })` 在随机端口启动。
2. 创建临时消费目录，不修改 `tests/fixtures/consumer`。
3. 将 namespace URL 写为
   `http://127.0.0.1:{port}/r/{name}.json`。
4. 顺序执行真实命令：

```text
pnpm exec shadcn list @internal
pnpm exec shadcn search @internal --query button
pnpm exec shadcn view @internal/button
pnpm exec shadcn add @internal/button --yes
```

5. 断言安装后的 `components/ui/button.tsx` 存在。
6. 在 `finally` 中调用 `close()` 并删除临时目录。

- [ ] **Step 5: 运行完整契约测试**

Run: `pnpm build && pnpm test tests/registry/built-output.test.ts && pnpm test:cli`

Expected: 全部 PASS；CLI 输出包含 `button`，临时项目成功安装文件。

- [ ] **Step 6: 提交**

```bash
git add scripts/serve-static.mjs scripts/cli-smoke.mjs tests/fixtures tests/registry/built-output.test.ts package.json
git commit -m "test: verify shadcn cli registry contract"
```

---

### Task 10: 添加 E2E、可访问性、贡献文档和 CI

**Files:**
- Create: `tests/e2e/registry-site.spec.ts`
- Create: `docs/contributing.md`
- Create: `docs/cli-setup.md`
- Create: `registry/_template/registry-item.json`
- Create: `registry/_template/component.tsx`
- Create: `registry/_template/preview.tsx`
- Create: `.github/workflows/ci.yml`
- Create: `scripts/package-release.mjs`
- Test: `tests/project/release-package.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: 完整静态构建和所有公开页面。
- Produces:
  - `pnpm verify` 作为本地与 CI 唯一验收入口。
  - `pnpm release:package --ref <git-sha-or-tag>` 生成 `dist/<ref>/`。

- [ ] **Step 1: 写失败的浏览器主流程**

`tests/e2e/registry-site.spec.ts` 必须验证：

```ts
test("searches, previews and copies an internal component", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "搜索资产…" }).click()
  await page.getByRole("textbox", { name: "搜索资产" }).fill("button")
  await page.getByRole("option", { name: "Button" }).click()
  await expect(page).toHaveURL(/\/items\/button\/$/)
  await expect(page.getByTitle("Button preview")).toBeVisible()
  await page.getByRole("button", { name: "Mobile" }).click()
  await expect(page.getByTestId("preview-viewport")).toHaveCSS("width", "390px")
})
```

再添加一个测试验证 Blocks/Template 新标签预览、Preview/Code、全站主题、
预览 Light/Dark 切换和 axe 关键违规为零。

- [ ] **Step 2: 运行 E2E 并确认失败**

Run: `pnpm build && pnpm test:e2e`

Expected: FAIL，尚未配置 webServer 或部分可访问名称不符合测试。

- [ ] **Step 3: 修正可访问性契约并配置 Playwright**

`playwright.config.ts` 的 `webServer.command` 使用
`pnpm serve:static out --port 4173`；
页面控件补齐测试中使用的可访问名称和 `data-testid="preview-viewport"`。
安装 `@axe-core/playwright` 并只排除第三方预览 iframe 内部内容。

- [ ] **Step 4: 编写贡献与 CLI 文档**

`docs/contributing.md` 必须给出：

- 三类资产目录位置
- 可复制的 `registry/_template`
- `meta` 必填字段
- 本地校验和构建命令
- PR 审核清单

`docs/cli-setup.md` 给出 `components.json` 的 `@internal` 配置及 list、search、
view、add 四条命令。

- [ ] **Step 5: 添加统一验证脚本和 CI**

`package.json` 添加：

```json
"verify": "pnpm test && pnpm build && pnpm test:cli && pnpm test:e2e",
"serve:static": "node scripts/serve-static.mjs",
"release:package": "node scripts/package-release.mjs"
```

`.github/workflows/ci.yml` 使用固定 Node LTS、Corepack、`pnpm install
--frozen-lockfile` 和 `pnpm verify`。CI 不上传部分 `out/`；只有 verify 成功
后，后续部署 job 才能消费完整静态目录。构建步骤设置
`NEXT_PUBLIC_BUILD_REF=${{ github.sha }}`。

- [ ] **Step 6: 实现可原子发布的版本目录**

`package-release.mjs` 要求 `--ref` 只包含 Git SHA 或合法 tag 字符，确认
`out/index.html`、`out/r/registry.json`、`out/r/button.json`、
`out/r/approval-card.json` 和 `out/r/admin-dashboard.json` 都存在后，把完整
`out/` 复制到新的 `dist/<ref>/`。目标已存在时直接失败，禁止覆盖。最后写入：

```json
{
  "ref": "<git-sha-or-tag>",
  "createdAt": "<ISO-8601>"
}
```

文件路径为 `dist/<ref>/release.json`。`release-package.test.ts` 验证缺少任意
必需文件时不会出现 `dist/<ref>`，完整产物只会一次性出现在版本目录。静态
托管平台只需切换当前版本指针即可原子发布和回滚。

- [ ] **Step 7: 运行最终验证**

Run: `pnpm verify && pnpm release:package --ref test-release`

Expected: 单元测试、Registry 构建、Next.js 静态构建、真实 CLI 冒烟、
Playwright 与 axe 全部 PASS，`dist/test-release/` 包含完整站点和
`release.json`。

- [ ] **Step 8: 提交**

```bash
git add tests/e2e tests/project/release-package.test.ts docs registry/_template scripts/package-release.mjs .github/workflows/ci.yml package.json pnpm-lock.yaml playwright.config.ts components app
git commit -m "docs: complete registry contribution and verification flow"
```

---

## 核心计划完成条件

- `pnpm verify` 全部通过。
- `out/` 可以直接由静态服务器托管。
- Components、Blocks、Templates 都能搜索、浏览、查看源码和 iframe 预览。
- `@internal` 的 list、search、view、add 都由真实 shadcn CLI 验证。
- 新维护者可以只阅读贡献文档添加第四个资产。
- 仓库中不存在数据库、运行时 API、认证或 monorepo 配置。
