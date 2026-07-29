# 贡献内部资产

资产以 Registry 文件为唯一事实来源：基础组件在 `registry/ui/`，业务区块在 `registry/blocks/`，页面模板在 `registry/templates/`。每类目录中由 `registry.json` 声明资产；可从 `registry/_template/` 复制开始。

每个资产的 `meta` 必填字段为 `status`、`preview`、`addedAt`、`origin` 和 `sourceRef`。预览必须是可独立渲染的 React 组件；文件路径必须保持在所属 Registry 目录内。

本地提交前运行：

```bash
pnpm registry:validate
pnpm verify
```

PR 审核清单：确认元数据和文件路径有效、预览可用、源码可通过 `@internal` CLI 安装、搜索索引包含资产、没有引入运行时 API/认证/数据库，以及所有验证通过。
