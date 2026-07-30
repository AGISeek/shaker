# 同步上游 Registry 资产

Shaker UI 可以把白名单内的上游 shadcn Registry 资产同步进 `registry/`，同步结果是一组普通的 Git 变更，经过人工审核后通过 Pull Request 合入。同步命令**只修改工作区文件**：它不会 commit、不会 push，也不会触发任何部署。

## 配置文件

同步白名单存放在仓库根的 `upstreams.json`（可用 `--config` 指定其他路径）。每个来源的字段：

| 字段 | 说明 |
|------|------|
| `id` | 来源唯一标识，同步命令按 id 选择来源；也会写入资产的 `meta.sourceId`。 |
| `catalog` | 上游 catalog URL，仅允许 HTTPS（`http://127.0.0.1` 例外，供本地测试）。 |
| `itemTemplate` | 条目 URL 模板，必须恰好包含一个 `{name}` 占位符。 |
| `items` | 允许同步的条目白名单；同一个条目只能归属于一个来源。 |
| `pin` | 固定版本策略，见下节。 |
| `allowDigestPin` | 没有稳定 pin 时，是否允许用内容摘要作为来源引用。 |
| `recursiveDependencies` | 声明该来源的依赖递归策略；当前版本始终递归镜像依赖闭包（见下节）。 |
| `namespace` | 可选；上游的 namespace（如 `@acme`），用于识别同属该来源的依赖。 |

示例：

```json
{
  "sources": [
    {
      "id": "shadcn",
      "catalog": "https://ui.shadcn.com/r/index.json",
      "itemTemplate": "https://ui.shadcn.com/r/styles/new-york-v4/{name}.json",
      "items": ["button"],
      "pin": { "kind": "git", "ref": "v2.0.0" },
      "allowDigestPin": false,
      "recursiveDependencies": true
    }
  ]
}
```

## 固定版本策略

`pin` 有三种形式：

- `{ "kind": "git", "ref": "v2.0.0" }`：固定到 git 引用（分支、tag、commit）。
- `{ "kind": "version", "version": "1.2.3" }`：固定到发布版本号。
- `{ "kind": "none" }`：无稳定 pin，此时必须把 `allowDigestPin` 设为 `true`，同步会用条目规范化 JSON 的 `sha256:` 摘要作为 `meta.sourceRef` 与 `meta.sourceDigest`。

配置校验会拒绝既没有稳定 pin 又不允许摘要 pin 的来源，保证每个同步资产都有可审计的来源引用。

## 递归依赖

条目 `registryDependencies` 中指向同一上游的依赖（裸名称或来源自身 namespace，如 `@acme/utils`）会被递归镜像进本地 Registry，并改写为内部引用 `@internal/{name}`。指向外部 URL 或其他 namespace 的依赖无法映射到白名单来源，同步会整体失败，不会生成半成品。

## 同步命令

```bash
# 完整同步：抓取 → 生成计划 → 打印审核报告 → 原子应用
pnpm registry:sync --source shadcn

# 只检测变化：有变化时退出码为 1 且不写任何文件，无变化时退出码为 0
pnpm registry:sync --source shadcn --check

# 审批已有条目的摘要变化（可重复，名称和摘要必须与报错中给出的完全一致）
pnpm registry:sync --source shadcn --accept-digest button=sha256:<digest>
```

可选参数：`--config <path>`（默认 `upstreams.json`）、`--root <path>`（默认当前目录）。每次运行只同步一个来源。

命令输出一份固定的审核报告：新增/变更/删除文件数、npm 依赖变化、Registry 依赖变化和摘要变化，可直接粘贴进 PR 描述。出错时错误信息包含来源 id 和失败阶段（load config / resolve dependency closure / create sync plan / apply sync plan），不会打印上游响应正文。

## 安全失败语义

- **摘要审批**：已在库的上游条目内容摘要发生变化时，同步拒绝继续，必须用 `--accept-digest <name=sha256:...>` 精确审批后才生成变更。
- **所有权保护**：与内部资产或其他来源管理的资产同名的上游条目会被拒绝；删除只针对带有当前来源标记文件的条目目录，内部资产永远不会被同步删除。
- **先校验后落盘**：计划阶段完成全部校验（路径逃逸、条目名合法性、重复文件、摘要审批）后才写入；应用阶段先在临时目录暂存完整 Registry 树、通过核心 catalog 校验，再用两次 rename 原子交换，任一步失败都会回滚，原目录保持不变。
- **预览保护**：已存在的 `preview.tsx` 不会被覆盖，维护者可以把生成的占位预览替换为真实预览。

## Pull Request 审核清单

审核同步 PR 时确认：

- 变更只来自 `pnpm registry:sync --source <id>`，且报告中新增/变更/删除与 diff 一致。
- 每条摘要变化都有对应的 `--accept-digest` 审批记录，新的 `meta.sourceDigest` 与上游内容一致。
- `meta.sourceRef` 指向固定的上游版本（git ref、版本号或摘要）。
- 新增/变更的依赖（npm 与 `@internal/*`）在报告中列出且符合预期。
- 同步后 `pnpm verify` 通过。
