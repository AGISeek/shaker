# Shaker UI — 内部 shadcn Registry

Shaker UI 是一个面向团队的轻量级内部 UI 资产库，同时生成一个可静态托管的资产浏览站点，并输出兼容官方 shadcn CLI 的 Registry JSON。Git 是资产的唯一事实来源，Pull Request 是唯一的发布入口，CI 负责校验、构建与部署。

## 项目目标

- 让内部开发者能够发现、评估并安装经过审核的 UI 资产。
- 直接兼容官方 `shadcn` CLI，不创建私有安装协议。
- 让新增资产成为体量小、可清晰评审的 Git 变更。
- 为组件、业务区块和页面模板提供真实交互预览。
- 生成可直接部署到内网 CDN、对象存储或静态服务器的产物。

首版不包含：登录/SSO、应用数据库、管理后台、收藏评分、浏览器内编辑、多 namespace、单个资产的在线历史版本，或运行时代理上游 Registry。

## 技术栈

- **框架**：Next.js（latest tag，静态导出）+ React（latest tag）
- **语言**：TypeScript（latest tag），启用严格模式
- **样式**：Tailwind CSS（latest tag）+ `@tailwindcss/postcss`
- **包管理器**：pnpm 10.13.1（通过 `packageManager` 字段锁定）
- **Registry 工具**：`shadcn` 官方 CLI（`shadcn build`）
- **单元/组件测试**：Vitest + jsdom + Testing Library React
- **端到端测试**：Playwright + `@axe-core/playwright`
- **脚本运行器**：`tsx`（用于直接执行 `.ts`/`.mjs` 脚本）

## 仓库结构

```text
app/                              # Next.js 应用路由（静态站点）
  page.tsx                        # 首页
  components/page.tsx             # 组件目录
  blocks/page.tsx                 # 区块目录
  templates/page.tsx              # 模板目录
  items/[name]/page.tsx           # 资产详情页
  preview/[name]/page.tsx         # 独立预览页（iframe 内嵌）
  docs/cli/page.tsx               # CLI 配置文档
components/site/                  # 站点自身使用的 React 组件
  site-frame.tsx                  # 全局布局壳（预览路由自动去除页眉页脚）
  site-header.tsx                 # 顶栏、搜索入口、主题切换
  command-menu.tsx                # Command/Ctrl+K 全局搜索
  asset-index.tsx                 # 资产列表（按最近新增 + 字母序）
  grouped-asset-index.tsx         # 按分类分组的资产列表
  asset-detail.tsx                # 资产详情（预览、源码、安装命令）
  preview-frame.tsx               # 预览工具栏 + iframe 视口
  preview-host.tsx                # 动态加载预览组件
  preview-error-boundary.tsx      # 预览局部错误边界
  docs-shell.tsx                  # 文档三栏布局
  site-footer.tsx                 # 全局页脚
  theme-provider.tsx              # next-themes 主题提供者（仅非预览路由）
components/ui/                  # shadcn CLI 安装的站点私有 UI 组件（不进入 Registry 安装载荷）
lib/utils.ts                    # cn() 工具
registry/                         # Registry 源数据，唯一事实来源
  registry.json                   # 根 catalog，使用 include 聚合子 catalog
  ui/registry.json                # 基础组件 catalog
  blocks/registry.json            # 业务区块 catalog
  templates/registry.json         # 页面模板 catalog
  _template/                      # 新增资产模板
  ui/button/                      # 示例组件：button
  blocks/approval-card/           # 示例区块：approval-card
  templates/admin-dashboard/      # 示例模板：admin-dashboard
src/registry/                     # Registry 核心逻辑
  catalog.ts                      # 加载并展开根 catalog
  types.ts                        # 内部 Registry 类型（meta 扩展）
  validate.ts                     # 内部一致性校验
  dependency-graph.ts             # 内部依赖解析与成环检测
  source.ts                       # 读取资产源码文件
  generate.ts                     # 生成预览映射与搜索索引
  search.ts                       # 客户端搜索排序
  search-index.ts                 # 搜索文档类型与转换
scripts/                          # 构建与校验脚本
  validate-registry.mjs           # 校验 Registry
  generate-preview-map.mjs        # 生成 generated/preview-map.ts
  build-search-index.mjs          # 生成 public/search-index.json
  cli-smoke.mjs                   # 对静态产物执行真实 shadcn CLI 冒烟测试
  serve-static.mjs                # 轻量级静态文件服务器
  package-release.mjs             # 将 out 打包到 dist/<ref>
tests/
  registry/                       # Registry 逻辑单元测试
  site/                           # 站点组件单元测试
  project/                        # 项目配置与发布脚本测试
  e2e/                            # Playwright 端到端测试
  fixtures/consumer/              # CLI 冒烟测试用的消费项目骨架
docs/                             # 面向贡献者的文档
  contributing.md                 # 贡献指南
  cli-setup.md                    # 消费项目 CLI 配置说明
  superpowers/                    # 设计规格与计划（只读参考）
```

## 构建与测试命令

```bash
# 安装依赖
pnpm install

# 校验 Registry 元数据与内部规则
pnpm registry:validate

# 生成预览映射和搜索索引（会再次执行校验）
pnpm registry:generate

# 构建 shadcn Registry JSON（输出到 public/r）
pnpm registry:build

# 完整构建（校验 + 生成 + registry:build + next build）
pnpm build

# 仅构建 Next.js 站点（假设生成产物已就绪）
pnpm build:site

# 单元/组件测试
pnpm test
pnpm test:watch

# 端到端测试（需要先完成静态构建）
pnpm test:e2e

# shadcn CLI 冒烟测试（对 out 目录启动静态服务器并执行 list/search/view/add）
pnpm test:cli

# 本地静态预览
pnpm serve:static out --port 3000

# 完整验证流水线（test + build + cli smoke + e2e）
pnpm verify

# 将 out 打包为发布目录 dist/<ref>
node scripts/package-release.mjs --ref <git-sha-or-tag>
```

`pnpm verify` 是 CI 的核心命令，合并前必须本地通过。

## Registry 结构与约定

### 资产分类

| 类型 | 用途 | 目录 | 示例 |
|------|------|------|------|
| `registry:ui` / `registry:component` | 基础可复用组件 | `registry/ui/` | `button` |
| `registry:block` | 由多个组件组成的业务区块 | `registry/blocks/` | `approval-card` |
| `registry:page` | 完整页面模板 | `registry/templates/` | `admin-dashboard` |

### 新增资产的步骤

1. 从 `registry/_template/` 复制模板到对应分类目录的新文件夹。
2. 编写可安装源码（如 `button.tsx`）和独立预览入口（`preview.tsx`，`export default`）。
3. 在该分类的 `registry.json` 的 `items` 数组中添加一条定义。
4. 运行 `pnpm registry:validate` 和 `pnpm verify`。
5. 提交 Pull Request。

不要新建未被根 `registry/registry.json` 的 `include` 引用的清单文件。

### Registry Item 必填字段

```json
{
  "name": "button",
  "type": "registry:ui",
  "title": "Button",
  "description": "A simple button component for internal interfaces.",
  "categories": ["ui", "form"],
  "files": [
    {
      "path": "button/button.tsx",
      "type": "registry:ui",
      "target": "components/ui/button.tsx"
    }
  ],
  "meta": {
    "status": "stable",
    "preview": "registry/ui/button/preview.tsx",
    "addedAt": "2026-07-29",
    "origin": "internal",
    "sourceRef": "main"
  }
}
```

`meta` 中的必填字段：

- `status`：`experimental`、`stable`、`deprecated` 之一。
- `preview`：可独立渲染的 React 组件路径，必须位于仓库内。
- `addedAt`：`YYYY-MM-DD` 格式合法日期。
- `origin`：`internal` 或 `upstream`。
- `sourceRef`：来源引用，如分支名、commit、tag。

可选字段：

- `featured`：是否在首页精选展示。
- `sourceDigest`：内容摘要（同步上游时填写）。
- `replacedBy`：废弃资产的替代项名称（必须指向存在的资产，且不能指向自身）。

### 依赖约定

- 内部依赖使用 `@internal/{name}` 格式声明在 `registryDependencies` 中。
- 内部依赖图不允许成环。
- 上游 npm 依赖使用官方 `dependencies` / `devDependencies` 字段。
- 预览文件只用于站点展示，不得放入 `files` 数组，避免被 CLI 安装到消费项目。

## 代码风格与开发约定

- 所有源码为 ESM，使用 `.ts` / `.tsx` / `.mjs`。
- React 组件优先使用函数组件；需要错误边界时使用类组件。
- 客户端组件文件顶部必须标注 `"use client"`。
- 使用 `@/*` 路径别名指向仓库根目录（见 `tsconfig.json` 与 `vitest.config.ts`）。
- 站点文案使用简体中文；代码标识符、文件路径、技术术语保持英文。
- 站点 UI 一律使用 `components/ui/` 中的 shadcn/ui 组件与 Tailwind token 类（如 `bg-muted`、`text-muted-foreground`），禁止新增手写按钮/下拉/对话框/徽章/警告条等价物。
- 站点代码引用 shadcn 组件必须使用 `@/ui/*` 别名；`@/components/ui/button` 被 tsconfig 精确映射保留给 registry 示例资产（消费方写法），站点代码不得使用。
- 新增站点 UI 组件用 `pnpm dlx shadcn@3 add <name>` 安装（注意：项目固定使用 shadcn CLI v3 的 init/add 语义；v4 的 `-b` 参数含义不同）。
- 主题使用 `next-themes`（`.dark` class + CSS 变量），ThemeProvider 仅挂在非预览路由（`site-frame.tsx`）；预览页通过预览容器的 `dark` class 隔离主题，不得在预览页使用 `useTheme`/`setTheme`（会污染主站主题偏好）。
- 当前版本的 Radix ToggleGroup `type="single"` 会把条目渲染为 `role="radio"`；需要 button 语义的单选组使用 `type="multiple"` 模拟单选（参考 `preview-frame.tsx`）。
- `app/globals.css` 只保留 shadcn token 模板（`:root`/`.dark` 变量、`@theme inline`、`@layer base`），不添加自定义组件类；`.site-header`/`.site-footer`/`.site-main`/`.preview-host` 是测试标记类，保留在 JSX 中但无样式。
- 自动生成文件：`generated/preview-map.ts`、`public/search-index.json`、`public/r/`，已加入 `.gitignore`，禁止手工维护。

## 测试策略

### 单元测试（Vitest）

- `tests/registry/validate.test.ts`：校验规则、路径安全、依赖成环、废弃替代项。
- `tests/registry/source.test.ts`：源码文件读取与路径逃逸防护。
- `tests/registry/catalog.test.ts`：catalog 展开与官方 `loadRegistryItem` 加载。
- `tests/registry/generated-assets.test.ts`：预览映射和搜索索引的确定性生成。
- `tests/registry/example-assets.test.ts`：示例资产完整性与可安装性。
- `tests/registry/built-output.test.ts`：执行 `shadcn build` 并验证产物结构。
- `tests/site/`：站点组件行为、搜索排序、预览框架、资产详情。
- `tests/project/`：项目配置与发布脚本行为。

### 端到端测试（Playwright）

- `tests/e2e/registry-site.spec.ts`：搜索、详情页、预览模式切换、主题切换、新标签页预览、可访问性（axe）。
- `tests/e2e/baseline.spec.ts`：静态预览无站点外壳、Code 模式展示源码。

### CLI 契约测试

`scripts/cli-smoke.mjs` 会：

1. 启动本地静态服务器，托管 `out/r/*.json`。
2. 创建临时消费项目。
3. 执行 `shadcn list @internal`、`shadcn search @internal --query button`、`shadcn view @internal/button`、`shadcn add @internal/button --yes`。
4. 验证文件被正确安装到消费项目。

## 部署流程

项目通过 GitHub Actions 自动化部署：

1. **CI 验证**（`.github/workflows/ci.yml`）：每次 push 和 PR 执行 `pnpm verify`。
2. **Pages 部署**（`.github/workflows/pages.yml`）：main 分支合并后执行 `pnpm build`，将 `out` 目录上传到 GitHub Pages。

`next.config.ts` 配置为静态导出：

- `output: "export"`
- `trailingSlash: true`
- `images: { unoptimized: true }`
- `basePath` 由 `NEXT_PUBLIC_BASE_PATH` 环境变量控制，仅在 Pages 部署 workflow 中设为 `/shaker`，本地与 CI 校验为空；非 `next/link` 的站内路径（原生 `<a>`、`iframe src`、`fetch`）必须经 `src/base-path.ts` 的 `withBasePath()` 处理。

构建产物说明：

- `out/`：完整静态站点，包含 HTML、`_next` 静态资源、`r/*.json` Registry、`search-index.json`。
- `public/r/`：在 `prebuild` 阶段由 `shadcn build` 生成。
- `dist/<ref>/`：通过 `package-release.mjs` 从 `out/` 打包的发布目录，附带 `release.json`。

## 安全与约束

- 所有 Registry 源码和预览文件必须位于 `registry/` 目录内；校验器会拒绝路径逃逸和恶意符号链接。
- `files[].target` 必须是相对路径，不得逃逸消费项目安装根目录。
- 预览路由 `/preview/{name}` 不加载站点外壳，仅渲染隔离预览，减少资产样式/脚本影响主站。
- 预览组件通过 `PreviewErrorBoundary` 捕获错误，避免单个预览损坏整页。
- 静态服务器 `scripts/serve-static.mjs` 对请求路径做目录遍历防护。
- 不引入运行时 API、认证、数据库，访问控制由部署环境（内网/VPN）负责。

## 消费项目使用方式

在消费项目的 `components.json` 中配置：

```json
{
  "registries": {
    "@internal": "https://registry.example.com/r/{name}.json"
  }
}
```

常用命令：

```bash
pnpm dlx shadcn@latest list @internal
pnpm dlx shadcn@latest search @internal --query button
pnpm dlx shadcn@latest view @internal/button
pnpm dlx shadcn@latest add @internal/button
```

## 常见排查

- **`pnpm build` 失败**：先检查 `pnpm registry:validate` 是否通过，确认新增资产的 `files` 和 `meta.preview` 路径存在。
- **预览路由 404**：确认 `pnpm registry:generate` 已执行，`generated/preview-map.ts` 包含对应资产。
- **CLI 冒烟测试失败**：通常因为 `out/r/{name}.json` 缺失或静态服务器未正确启动；先完整运行 `pnpm build`。
- **E2E 失败**：E2E 依赖 `out/` 目录，确保 `pnpm build` 成功后再运行 `pnpm test:e2e`。

## 扩展阅读

- `docs/contributing.md`：详细的资产贡献流程与 PR 审核清单。
- `docs/cli-setup.md`：消费项目如何配置 shadcn CLI。
- `docs/superpowers/specs/`：原始设计规格与架构决策记录。
- 官方 Registry 文档：https://ui.shadcn.com/docs/registry
