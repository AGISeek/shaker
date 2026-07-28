# 轻量级内部 shadcn Registry 设计规格

日期：2026-07-29

状态：设计已批准

## 1. 概述

建设一个轻量、由 Git 管理、兼容官方 shadcn CLI 的组织内部 UI 资产库。
首版分发三类资产：

- 基础 UI 组件
- 业务模块与区块
- 页面模板

同一仓库还会生成一个参考 shadcn 官方风格的资产站点，用于搜索、浏览、
阅读文档、查看源码和运行真实交互预览。

首版采用纯静态架构。Git 是唯一事实源，Pull Request 是唯一发布入口，CI
负责校验和构建。站点与 Registry JSON 合并为一个静态发布物。系统不包含
数据库、写入 API、应用层认证或运行时上游代理。

## 2. 目标

1. 让内部开发者能够发现、评估并安装经过审核的 UI 资产。
2. 直接兼容官方 shadcn CLI，不创建私有安装协议。
3. 让新增资产成为体量小、可清晰评审的 Git 变更。
4. 为组件、业务区块和页面模板提供真实交互预览。
5. 通过可审计的 Pull Request 流程，选择性同步官方或第三方 Registry。
6. 让不了解 shadcn 官方 monorepo 的维护者也能理解和维护本项目。
7. 生成可直接部署到内网 CDN、对象存储或静态服务器的产物。

## 3. 非目标

首版不包含：

- 登录、SSO、应用数据库或管理后台
- 收藏、评分、评论、分析或使用数据统计
- 浏览器内编辑源码或直接发布
- 多 namespace、多团队空间或多个品牌 Registry
- 单个资产的在线历史版本
- 运行时代理上游 Registry
- 通用项目脚手架、MCP 服务或 AI 生成组件
- 完整复制 shadcn 官方文档与生态目录
- 官方仓库的大型 monorepo 和工作区编排

访问权限由公司内网或 VPN 提供。npm 依赖镜像不属于本项目范围，继续使用
组织现有的包管理配置。

## 4. 核心决策

### 4.1 发布模式

Git 和 Pull Request 是唯一的创作、审核与发布流程。资产站点只读。

### 4.2 部署模式

每次构建生成一个静态发布物。站点页面与 `/r/*.json` 必须原子发布。

### 4.3 应用技术栈

使用单个 Next.js 应用并执行静态导出。Next.js 仅作为静态站点生成器和
React 预览宿主，不使用运行时 Route Handler 或其他依赖常驻服务的能力。

### 4.4 Registry 范围

首版只提供一个统一设计体系和一个 `@internal` namespace：

- 可复用基础组件使用 `registry:ui` 或 `registry:component`
- 业务区块使用 `registry:block`
- 完整页面模板使用 `registry:page`

顶层资产可以附带必要的 hooks、工具函数、样式、npm 依赖和 Registry 依赖。

### 4.5 版本策略

Registry 跟随仓库整体发布。站点显示当前部署的 Git commit 或 tag。审计和
回滚依赖 Git 历史与原子发布。首版不同时在线提供单个资产的多个历史版本。

## 5. 系统架构

系统分为四个边界清晰的单元。

### 5.1 Registry 源

负责 Registry 元数据、可安装源码、文档和预览入口。CLI 产物与站点内容均
从这里生成，不维护第二套资产数据。

### 5.2 构建与校验工具

负责展开 Registry include、执行官方与内部规则校验、生成预览和搜索数据、
构建 shadcn JSON、执行 CLI 契约测试并构建静态站点。

### 5.3 资产发现站点

读取通过校验的 Registry catalog，提供搜索、导航、文档、源码和真实预览。
站点不拥有独立的 CMS 数据。

### 5.4 上游同步器

只拉取配置白名单内的上游条目，将其校验并规范化为本地源码，记录来源，
最后形成普通 Git 变更供评审。网站和 CLI 请求不会在运行时调用同步器。

发布数据流如下：

```text
Git 源码
  -> Schema 与内部规则校验
  -> 生成预览映射和搜索索引
  -> 构建 shadcn Registry
  -> Next.js 静态导出
  -> 使用静态产物执行 CLI 冒烟测试
  -> 原子部署到内网
```

## 6. 仓库结构

```text
app/                              # 静态站点路由
components/
  site/                           # Registry 站点自身使用的 UI
registry/
  registry.json                   # 使用 include 的根 catalog
  ui/
    registry.json
    button/
      button.tsx                  # 可安装源码
      preview.tsx                 # 仅用于站点预览
  blocks/
    registry.json
  templates/
    registry.json
scripts/
  validate-registry.mjs
  sync-upstream.mjs
  generate-preview-map.mjs
upstreams.json                    # 上游白名单和固定版本
generated/
  preview-map.ts                  # 自动生成的预览导入映射
public/
  r/                              # 自动生成的 Registry JSON
  search-index.json               # 自动生成的客户端搜索数据
docs/
  contributing.md
```

`public/r`、`generated/preview-map.ts` 和 `public/search-index.json` 都是构建
产物，必须加入 Git ignore，禁止手工维护。

仓库保持为单一应用，不建立 monorepo。Registry 定义使用 shadcn 官方的
`include` 能力，使分类定义靠近源码，又不引入 package 边界。

## 7. Registry 数据模型

外部契约直接采用当前官方 Registry 和 Registry Item Schema：

- [Registry 文档](https://ui.shadcn.com/docs/registry)
- [Registry 入门](https://ui.shadcn.com/docs/registry/getting-started)
- [Registry Item Schema](https://ui.shadcn.com/schema/registry-item.json)

CLI 和站点共同使用以下官方字段：

- `name`
- `type`
- `title`
- `description`
- `author`
- `files`
- `dependencies`
- `devDependencies`
- `registryDependencies`
- `docs`
- `categories`

站点展示和来源追踪信息放入 Schema 官方支持的 `meta` 对象：

```json
{
  "meta": {
    "status": "stable",
    "preview": "registry/ui/button/preview.tsx",
    "featured": false,
    "origin": "internal",
    "sourceRef": "main",
    "sourceDigest": "sha256:..."
  }
}
```

资产状态只允许：

- `experimental`
- `stable`
- `deprecated`

被废弃的资产仍然可以安装，以避免已有说明失效。页面和搜索结果必须展示
废弃状态；如果存在替代项，则通过 `meta.replacedBy` 指向替代资产。

预览文件与资产源码可以放在同一目录，但只有 `files` 数组声明的文件才属于
CLI 安装载荷。预览文件不得因为目录相邻而被安装。

## 8. 站点信息架构

站点的视觉和交互参考 shadcn 官方站点，但不复制其面向公众的营销和生态范围。

主要参考：

- [shadcn 首页](https://ui.shadcn.com/)
- [Components 目录](https://ui.shadcn.com/docs/components)
- [Button 详情文档](https://ui.shadcn.com/docs/components/button)
- [Blocks 页面](https://ui.shadcn.com/blocks)

### 8.1 全局框架

顶栏保持克制，只包含：

- 内部 Registry 标识
- Docs
- Components
- Blocks
- Templates
- 带有 `Command/Ctrl+K` 提示的全局搜索入口
- 主题切换

文档型页面采用 shadcn 的三栏结构：

- 左侧导航
- 中间正文
- 长文档右侧显示“本页目录”

不包含 GitHub star、产品公告、Create、Charts、Directory、广告或生态推广。

### 8.2 首页

首页说明内部设计基础，并提供两个首要操作：

- 浏览资产
- 配置 CLI

首页可以展示少量真实资产，但定位是实用入口，不做大型营销展示。最近新增和
精选资产直接来自 Registry 元数据。

### 8.3 资产目录

Components 参考官方文档目录：

- 最近新增
- 完整字母索引
- 左侧快速导航

Blocks 和 Templates 使用分类导航与大尺寸预览，不压缩成小型“资产商城”
卡片。全局搜索支持模糊查询，并按类型、分类和生命周期状态筛选。

搜索索引在构建时生成，浏览器端完成查询，不建立搜索服务。

### 8.4 组件详情页

内容顺序参考官方组件文档：

1. 标题、描述、状态和来源
2. Preview 与 Code
3. Installation
4. Usage
5. Examples
6. 依赖和相关资产
7. 补充文档

### 8.5 Blocks 与 Templates 详情页

采用类似官方 Blocks 页的大画布预览。预览工具栏提供：

- Preview/Code 切换
- Desktop、Tablet、Mobile 宽度切换
- 刷新
- 新标签页打开
- 复制安装命令

完整页面模板可以打开专用的静态全屏预览路由。

### 8.6 预览隔离

所有预览都通过专用静态路由 `/preview/{name}` 渲染，并嵌入 iframe，防止
资产布局和样式影响宿主文档页。

统一的预览壳层负责主题、视口宽度、刷新和错误展示。每个预览拥有独立错误
边界；预览异常只显示局部错误面板，不影响文档、源码和安装说明。

## 9. CLI 契约

消费项目在 `components.json` 中配置 Registry：

```json
{
  "registries": {
    "@internal": "https://internal.example/r/{name}.json"
  }
}
```

需要支持：

```bash
pnpm dlx shadcn@latest list @internal
pnpm dlx shadcn@latest search @internal --query button
pnpm dlx shadcn@latest view @internal/button
pnpm dlx shadcn@latest add @internal/button
```

静态部署必须提供：

```text
/r/registry.json
/r/{name}.json
```

Catalog 用于 list 和 search，单条 Item JSON 用于 view 和 add。项目不得依赖
未公开的 shadcn CLI 内部实现。

## 10. 资产贡献流程

内部贡献者执行：

1. 在对应 Registry 分类下创建资产目录。
2. 添加可安装源码。
3. 添加预览入口。
4. 添加一条包含文档和分类信息的 Registry 定义。
5. 运行本地校验和构建命令。
6. 创建 Pull Request。

CI 错误必须明确指出资产名、定义位置和源码路径。Pull Request 合并后，完整
Registry 被重新构建并部署。

仓库必须提供一个精简资产模板和贡献指南，使维护者无需阅读站点内部实现即可
新增资产。

## 11. 上游同步

### 11.1 配置

`upstreams.json` 只声明允许同步的来源和条目，每个来源记录：

- Registry catalog 或 item URL
- 需要同步的条目名
- 上游支持时，固定到 tag、commit、release 或其他可复现引用
- 是否递归同步 Registry 依赖

如果上游无法提供稳定版本引用，同步器必须用内容摘要固定本次结果，并记录来源
URL。

### 11.2 同步行为

同步器依次执行：

1. 拉取配置的 catalog 和 item。
2. 使用官方 Schema 校验响应。
3. 计算内容摘要。
4. 将 Item 中内嵌的源码拆分为本地、可评审的文件。
5. 写入来源元数据。
6. 配置允许时递归同步 Registry 依赖闭包。
7. 将已镜像依赖改写为 `@internal/{name}`。
8. 如果依赖闭包包含未进入白名单的外部 Registry 条目，则直接失败且不写入
   任何变更。
9. 生成普通 Git diff，不直接发布。

同步官方 shadcn Registry 时，默认递归镜像依赖。这样安装内部镜像资产时，
不会静默地再次从公开 Registry 拉取其他 UI 资产。

网络或校验失败时，同步器不得删除或覆盖当前可用版本。命令以失败状态退出，
本地已有源码保持不变。

### 11.3 审核信息

同步 Pull Request 必须清楚展示：

- 新增、修改和删除的文件
- npm 依赖变化
- Registry 依赖变化
- 来源或内容摘要变化
- 新的生命周期或兼容性风险

## 12. 构建与发布流水线

Pull Request 和主分支运行同一套校验：

1. 加载根 Registry 并展开 include。
2. 使用官方 shadcn Schema 校验每个资产。
3. 执行内部一致性校验。
4. 生成预览映射和搜索索引。
5. 执行 `shadcn build`，输出到 `public/r`。
6. 构建并静态导出 Next.js 站点。
7. 临时启动静态服务器。
8. 对该服务器执行真实 shadcn CLI 的 list、search、view 和 add 测试。
9. 执行站点端到端与可访问性检查。

内部一致性校验包括：

- 资产名唯一
- 源码和预览文件存在
- 文件目标路径合法
- Registry 依赖可解析
- 内部依赖图无环
- 生命周期和替代项元数据合法
- 除非明确声明，否则预览文件不进入安装载荷

最终静态目录是唯一可部署产物。发布必须原子完成。构建或上传失败时，继续保留
上一份完整发布，不产生半更新状态。

## 13. 错误处理

### 13.1 构建期错误

Schema 不匹配、名称重复、文件缺失、路径非法、依赖成环、编译失败或 CLI
契约测试失败都必须阻止发布。

错误信息应包含资产名、定义文件、问题字段或路径，并在可以判断时提供修正建议。

### 13.2 站点运行期错误

- 预览错误被限制在当前预览区域。
- 缺少可选文档时显示简洁空状态。
- 必需生成文件缺失属于构建错误，不允许以部分损坏页面发布。
- 复制命令必须展示成功或失败反馈。

### 13.3 上游错误

网络失败、Schema 非法、依赖范围异常和内容摘要变化都必须让同步命令失败，且
不得修改或删除当前已发布资产。

## 14. 测试策略

### 14.1 单元测试

覆盖：

- Registry include 展开
- 内部路径规则
- 依赖图构建和循环检测
- 生命周期元数据校验
- 上游数据规范化
- 依赖闭包和 namespace 改写

### 14.2 Schema 与契约测试

- 使用当前官方 shadcn Schema 校验 catalog 和 item。
- 运行官方构建命令。
- 启动临时静态服务器和一次性消费项目，使用真实 shadcn CLI 执行 list、
  search、view 和 add。

### 14.3 编译与预览测试

- 编译每个可安装源码文件。
- 编译每个预览入口。
- 渲染代表性的组件、业务区块和页面模板。
- 验证预览错误不会影响宿主页面。

### 14.4 站点端到端测试

覆盖：

- 全局搜索与键盘操作
- 目录导航
- 详情页锚点
- Preview/Code 切换
- 主题切换
- 响应式预览控制
- 新标签页预览路由
- 安装命令复制

### 14.5 可访问性与视觉测试

对全局框架、资产目录、详情页和预览工具栏运行自动化可访问性检查。视觉回归
只覆盖少量关键结构，不维护庞大且脆弱的像素截图测试。

## 15. 验收标准

首版满足以下条件即可验收：

1. 新增一个资产只需要源码、预览和一条 Registry 定义。
2. 文档约定的一条构建命令能生成可直接静态托管的完整目录。
3. `shadcn list @internal`、`search @internal`、`view @internal/button` 和
   `add @internal/button` 均能针对该产物成功执行。
4. 组件、业务区块和页面模板都能被搜索、浏览、交互预览并查看源码。
5. 白名单上游同步能生成清晰的源码级 Git diff，失败时保持当前版本不变。
6. 非法 Registry 内容会在部署前被拒绝。
7. 新维护者只阅读贡献指南即可添加资产，无需阅读站点内部实现。
8. 仓库保持单一静态应用，不包含数据库、常驻服务或不必要的工作区编排。

## 16. 后续扩展点

未来可以在不改变首版契约的前提下增加：

- CLI Token 认证
- 站点 SSO
- 多 Registry 或多品牌
- 单资产版本历史
- 使用情况统计
- 通过可视化表单创建 Pull Request 的贡献流程

这些只是扩展点，不属于当前实施范围。
