# 站点 shadcn/ui 化改造设计规格

日期：2026-07-29

状态：设计已批准

## 1. 概述

Shaker UI 站点目前使用手写组件与自定义 CSS 类构建，未使用 shadcn/ui。本次改造将站点自身完整迁移到 shadcn/ui 组件体系：通过官方 `shadcn` CLI 初始化并安装组件，站点交互组件全部替换为 shadcn/ui 等价物，样式迁移到 shadcn CSS 变量 token 体系，主题切换改用 `next-themes`。

本改造只影响站点展示层（`app/`、`components/site/`、`app/globals.css`）。Registry 源数据（`registry/`）、构建产物（`/r/*.json`）、CLI 契约和上游同步计划均不受影响。

## 2. 目标

1. 站点交互组件全部使用 shadcn/ui 组件构建，删除手写等价物。
2. 样式统一到 shadcn CSS 变量 token 体系，删除 `globals.css` 中的自定义组件类。
3. 主题切换使用 `next-themes` 标准方案（`.dark` class），替换手写 `data-theme` 机制。
4. 现有交互契约（ARIA 名称、角色、`data-testid`、预览 iframe 协议）保持不变，单测与 E2E 尽量零改动。
5. 完整验证流水线 `pnpm verify` 保持通过。

## 3. 非目标

- 不改变路由、信息架构和中文文案。
- 不修改 `registry/` 资产源码与 Registry JSON 产物。
- 不引入 shadcn 官方站点的营销组件（Charts、Directory 等）。
- 不实现上游同步器（属另一份计划）。

## 4. 基础设施

### 4.1 shadcn 初始化

在仓库根执行 `shadcn init`（非交互参数），生成：

- `components.json`：style `new-york`、baseColor `neutral`、CSS 变量开启、别名复用现有 `@/*`（组件落 `components/ui/`，工具落 `lib/utils.ts`）。
- `lib/utils.ts`：`cn()`（`clsx` + `tailwind-merge`）。

新增依赖：

- `class-variance-authority`、`clsx`、`tailwind-merge`、`lucide-react`、`next-themes`、`tw-animate-css`
- 各组件带入的 radix 包（由 `shadcn add` 自动声明）

`components.json` 只服务于"往站点装组件"，与 `registry/` 的 `shadcn build` 产物互不干扰。

### 4.2 安装的组件

```text
button card dialog command select toggle-group badge alert
```

## 5. 组件映射

| 站点组件 | 改造方式 | shadcn/ui |
|---|---|---|
| `site-header` | 结构不变；搜索入口换 `Button`，主题切换换 icon `Button` + lucide `Sun`/`Moon` | `button` |
| `command-menu` | 重写为 `Dialog` + `Command`（cmdk 自带输入、键盘导航、`role="option"`）；三个筛选下拉换 `Select` | `dialog`、`command`、`select` |
| `asset-index` | 保持官方式行链接，自定义类换成 Tailwind 工具类 | — |
| `grouped-asset-index` | blocks/templates 分组条目换 `Card` | `card` |
| `asset-detail` | 状态/来源换 `Badge`；废弃警告换 `Alert`；安装命令复制换 `Button`；内容顺序不变 | `badge`、`alert`、`button` |
| `preview-frame` | 工具栏三组切换换 `ToggleGroup`；刷新/新标签页/复制换 `Button` + lucide 图标；viewport、iframe、`data-testid="preview-viewport"` 不变 | `toggle-group`、`button` |
| `docs-shell` | 布局 grid 保留，自定义类换成 Tailwind 工具类 | — |
| `site-footer` / `site-frame` | 仅换 Tailwind 工具类，结构不动 | — |

## 6. 主题机制

- `app/layout.tsx` 挂 `ThemeProvider`（`attribute="class"`、`defaultTheme="system"`、`enableSystem`），`<html>` 加 `suppressHydrationWarning`。
- 顶栏主题切换改用 `useTheme()`，删除 `site-header` 中的手写 `data-theme` 逻辑。
- 预览 iframe 的 `?theme=dark` 查询参数契约保留：`app/preview/layout.tsx` 同样挂 `ThemeProvider`，以 `forcedTheme`（由服务端从 searchParams 读取后传入）驱动预览页的 `.dark` class。
- `preview-host` 不再手写主题 class，改由 token 变量着色。

## 7. 样式（globals.css）

- 内容替换为 shadcn 标准结构：`@import "tailwindcss"`、`@import "tw-animate-css"`、`:root`/`.dark` 的 neutral token 组、`@theme inline` 映射。
- 现有自定义组件类（`.site-header`、`.asset-link`、`.command-menu`、`.preview-frame` 等）随组件重写删除，仅保留极少数无法工具化的基础规则。
- 例外：`.site-header`、`.site-footer` 类名保留在对应元素上——E2E `baseline.spec.ts` 用它们断言预览页"无站点外壳"。

## 8. 路径前缀

所有非 `next/link` 的站内路径（原生 `<a>`、`iframe src`、`fetch`）继续经 `src/base-path.ts` 的 `withBasePath()` 处理；`NEXT_PUBLIC_BASE_PATH` 机制不变。

## 9. 测试策略

### 9.1 保持不变的契约

- aria-label：`搜索资产…`、`切换主题`、`搜索资产`
- 搜索结果项 `role="option"`（cmdk 原生行为）
- `data-testid="preview-viewport"`、iframe `title="{title} preview"`
- 预览宽度断言 Mobile = 390px
- E2E 用 `.site-header` / `.site-footer` 断言预览页无外壳

### 9.2 需要更新的测试

- E2E 主题切换断言从 `html[data-theme="dark"]` 改为 `html` 的 `dark` class。
- `command-menu` 重写后，单测重点验证 cmdk 输入框仍匹配 `textbox` 角色、筛选与键盘跳转行为不变；如有选择器偏差，调整测试以匹配新实现但不断言实现细节。
- `preview-frame` 工具栏换 `ToggleGroup` 后，验证按钮的可访问名称不变。

### 9.3 验收

`pnpm verify`（单测 + 构建 + CLI 冒烟 + E2E）全部通过。

## 10. 风险与约束

- `shadcn init/add` 需要网络访问官方 Registry；离线环境无法执行。
- `components/ui/` 与 `lib/` 是站点私有代码，不进入 `registry/`，不影响 CLI 安装载荷。
- 改造期间预览 iframe 内外都走 `.dark` class，需确认 `preview-host--dark` 相关样式同步删除。
- 一次性全量迁移，diff 较大；按任务拆 commit，保持每个 commit 可构建。

## 11. 验收标准

1. `components/site/` 中不再存在手写按钮、下拉、对话框、徽章、警告条等价物，全部由 `components/ui/` 组件承担。
2. `globals.css` 中不再存在自定义组件类（除保留的 `.site-header`、`.site-footer` 标记类与基础规则）。
3. 明暗主题在主站与预览 iframe 内均通过 `.dark` class + CSS 变量生效。
4. `pnpm verify` 通过。
5. GitHub Pages 部署后站内链接、搜索、预览、主题切换在 `/shaker` 前缀下正常工作。
