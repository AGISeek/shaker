# 配置 shadcn CLI

在消费项目的 `components.json` 中配置内部 Registry：

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
