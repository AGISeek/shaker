# 上游 shadcn Registry 白名单同步实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在核心 Registry 可独立运行后，增加一个失败时不破坏现有源码、能递归镜像依赖并生成可审核 Git diff 的上游白名单同步器。

**Architecture:** `upstreams.json` 声明允许的来源、固定引用、条目和递归策略。同步器先在内存中抓取、校验、计算摘要、解析依赖和生成完整写入计划；只有所有检查通过后才原子应用计划，且永不直接发布。

**Tech Stack:** TypeScript、shadcn 官方 Schema、Zod、Node.js Fetch/Crypto/Filesystem、Vitest、pnpm。

## Global Constraints

- 本计划依赖核心计划已经完成，并复用 `InternalRegistryItem`、`loadCatalog()` 和 `assertValidCatalog()`。
- 只同步 `upstreams.json` 明确列出的来源和条目。
- 官方 shadcn 条目默认递归同步 Registry 依赖闭包。
- 已镜像的依赖必须改写为 `@internal/{name}`。
- 遇到未列入白名单的外部 Registry 依赖时，整个同步失败且不写入任何文件。
- 上游没有稳定版本引用时，用 SHA-256 内容摘要固定结果。
- 网络失败、Schema 失败、依赖异常和未明确接受的摘要变化不得破坏当前可用
  版本；已有条目的新摘要必须通过精确 `--accept-digest name=sha256:...` 接受。
- 同步只生成源码级 Git 变更，不提交、不合并、不部署。
- 每项任务按测试先行、最小实现、验证、提交的顺序执行。

---

## 文件与职责总览

```text
upstreams.json                         # 唯一上游白名单
src/sync/
  config.ts                            # 配置 Schema、加载和 URL 解析
  fetch-item.ts                        # 网络拉取、官方 Schema 校验、摘要
  dependency-closure.ts                # 依赖闭包和 namespace 改写
  normalize.ts                         # 内嵌 content 拆分为本地源码
  sync-plan.ts                         # 纯数据写入计划
  apply-plan.ts                        # 临时目录、原子落盘、删除保护
  report.ts                            # 人类可读变更和风险报告
scripts/
  sync-upstream.mjs                    # CLI 编排入口
tests/sync/
  config.test.ts
  fetch-item.test.ts
  dependency-closure.test.ts
  normalize.test.ts
  apply-plan.test.ts
  sync-cli.test.ts
tests/fixtures/upstream/
  registry.json
  button.json
  approval-card.json
  external-dependency.json
docs/upstream-sync.md
```

---

### Task 1: 定义并校验上游白名单配置

**Files:**
- Create: `upstreams.json`
- Create: `src/sync/config.ts`
- Create: `tests/sync/config.test.ts`

**Interfaces:**
- Consumes: JSON 文件。
- Produces:
  - `UpstreamConfig`
  - `UpstreamSource`
  - `loadUpstreamConfig(path?: string): Promise<UpstreamConfig>`
  - `resolveItemUrl(source, name): string`

- [ ] **Step 1: 写失败的配置测试**

```ts
it("rejects an unpinned source that also disables digest pinning", async () => {
  await writeFixture({
    sources: [{
      id: "bad",
      catalog: "https://example.com/r/registry.json",
      itemTemplate: "https://example.com/r/{name}.json",
      items: ["button"],
      pin: { kind: "none" },
      allowDigestPin: false,
    }],
  })
  await expect(loadUpstreamConfig(fixturePath)).rejects.toThrow(
    "source bad must define a stable pin or allow digest pinning",
  )
})
```

同时测试重复 source id、重复 item、缺少 `{name}`、非 HTTPS 远程 URL 和空
items 均被拒绝。

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/sync/config.test.ts`

Expected: FAIL，`loadUpstreamConfig` 不存在。

- [ ] **Step 3: 实现配置 Schema**

`UpstreamSource` 精确结构：

```ts
export type UpstreamSource = {
  id: string
  catalog: string
  itemTemplate: string
  items: string[]
  pin:
    | { kind: "git"; ref: string }
    | { kind: "version"; version: string }
    | { kind: "none" }
  allowDigestPin: boolean
  recursiveDependencies: boolean
  namespace?: string
}

export type UpstreamConfig = { sources: UpstreamSource[] }
```

`resolveItemUrl` 只替换一个 `{name}`，并用 `encodeURIComponent(name)` 防止路径
注入。允许测试使用 `http://127.0.0.1`，其他远程来源必须是 HTTPS。

- [ ] **Step 4: 添加初始白名单**

`upstreams.json` 只配置官方来源和一个 `button` 条目：

```json
{
  "sources": [
    {
      "id": "shadcn",
      "catalog": "https://ui.shadcn.com/r/registry.json",
      "itemTemplate": "https://ui.shadcn.com/r/{name}.json",
      "items": ["button"],
      "pin": { "kind": "none" },
      "allowDigestPin": true,
      "recursiveDependencies": true,
      "namespace": "@shadcn"
    }
  ]
}
```

- [ ] **Step 5: 运行测试**

Run: `pnpm test tests/sync/config.test.ts`

Expected: PASS，真实 `upstreams.json` 也能成功加载。

- [ ] **Step 6: 提交**

```bash
git add upstreams.json src/sync/config.ts tests/sync/config.test.ts
git commit -m "feat: define upstream registry allowlist"
```

---

### Task 2: 拉取并校验上游 Item，计算稳定摘要

**Files:**
- Create: `src/sync/fetch-item.ts`
- Create: `tests/sync/fetch-item.test.ts`
- Create: `tests/fixtures/upstream/button.json`

**Interfaces:**
- Consumes: `UpstreamSource`、item name、注入的 `fetch`。
- Produces:
  - `fetchRegistryItem(source, name, fetcher?): Promise<FetchedItem>`
  - `FetchedItem = { sourceId; sourceUrl; sourceRef; digest; item }`
  - `canonicalizeJson(value): string`

- [ ] **Step 1: 写失败的抓取测试**

```ts
it("validates the item and hashes canonical JSON", async () => {
  const result = await fetchRegistryItem(source, "button", fixtureFetch)
  expect(result.sourceUrl).toBe("https://example.com/r/button.json")
  expect(result.digest).toMatch(/^sha256:[a-f0-9]{64}$/)
  expect(result.item.name).toBe("button")
})
```

另写测试验证 404、非 JSON、Schema 不合法、响应 name 与请求 name 不一致都会
抛出包含 source id 和 URL 的错误。

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/sync/fetch-item.test.ts`

Expected: FAIL，抓取接口不存在。

- [ ] **Step 3: 实现规范化摘要**

`canonicalizeJson` 递归排序对象 key，保持数组顺序，输出无空白 JSON。
`digest` 使用：

```ts
const digest = `sha256:${createHash("sha256")
  .update(canonicalizeJson(item))
  .digest("hex")}`
```

用 `registryItemSchema.safeParse` 校验响应。`sourceRef` 优先使用 git ref 或
version；没有稳定引用时使用计算出的 digest。

- [ ] **Step 4: 实现网络错误边界**

默认 fetch 设置 `Accept: application/json`。非 2xx 响应抛出
`UpstreamFetchError`，字段包含 `sourceId`、`url`、`status`。解析和 Schema
错误不得返回部分 `FetchedItem`。

- [ ] **Step 5: 运行测试**

Run: `pnpm test tests/sync/fetch-item.test.ts`

Expected: PASS；相同 JSON 即使对象 key 顺序不同也产生相同摘要。

- [ ] **Step 6: 提交**

```bash
git add src/sync/fetch-item.ts tests/sync/fetch-item.test.ts tests/fixtures/upstream/button.json
git commit -m "feat: fetch and verify upstream registry items"
```

---

### Task 3: 解析递归依赖闭包并改写内部 namespace

**Files:**
- Create: `src/sync/dependency-closure.ts`
- Create: `tests/sync/dependency-closure.test.ts`
- Create: `tests/fixtures/upstream/approval-card.json`
- Create: `tests/fixtures/upstream/external-dependency.json`

**Interfaces:**
- Consumes: 初始 item 名、`UpstreamSource`、`fetchRegistryItem`。
- Produces:
  - `resolveDependencyClosure(request): Promise<FetchedItem[]>`
  - `rewriteMirroredDependencies(item, mirroredNames): RegistryItem`
  - `DependencyRequest = { source; roots; allowedItems; fetchItem }`

- [ ] **Step 1: 写失败的依赖闭包测试**

```ts
it("mirrors recursive dependencies and rewrites them to @internal", async () => {
  const items = await resolveDependencyClosure({
    source,
    roots: ["approval-card"],
    allowedItems: new Set(["approval-card", "button"]),
    fetchItem: fixtureFetcher,
  })
  const approval = items.find(({ item }) => item.name === "approval-card")!.item
  expect(approval.registryDependencies).toEqual(["@internal/button"])
})
```

另写测试验证依赖环不会无限循环、重复依赖只抓取一次、未白名单 URL 或其他
namespace 依赖会让整个操作失败。

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/sync/dependency-closure.test.ts`

Expected: FAIL，闭包解析器不存在。

- [ ] **Step 3: 实现依赖分类**

按以下规则处理 `registryDependencies`：

- 裸名称 `button`：视为当前上游来源中的条目。
- 当前来源 namespace 的 `@shadcn/button`：视为当前来源条目。
- `@internal/button`：已经是内部依赖，不抓取。
- HTTP(S) URL 或其他 namespace：只有配置明确把该地址映射到另一个白名单来源
  时才允许；首版同步器没有跨来源映射，因此直接失败。

- [ ] **Step 4: 实现闭包与改写**

使用 queue 和 `visited` Set，抓取顺序按名称排序保证输出稳定。任何失败都抛出
错误，不返回部分数组。所有被镜像的当前来源依赖统一改写为
`@internal/{name}`。

- [ ] **Step 5: 运行测试**

Run: `pnpm test tests/sync/dependency-closure.test.ts`

Expected: PASS；输出按 item name 排序且每项仅出现一次。

- [ ] **Step 6: 提交**

```bash
git add src/sync/dependency-closure.ts tests/sync/dependency-closure.test.ts tests/fixtures/upstream
git commit -m "feat: resolve allowlisted registry dependency closure"
```

---

### Task 4: 将上游 Item 规范化为本地源码和 Registry 定义

**Files:**
- Create: `src/sync/normalize.ts`
- Create: `src/sync/sync-plan.ts`
- Create: `tests/sync/normalize.test.ts`

**Interfaces:**
- Consumes: `FetchedItem[]`。
- Produces:
  - `createSyncPlan(items, options): SyncPlan`
  - `SyncPlan = { sourceId; registryItems: RegistryItem[]; writes: PlannedWrite[]; deletes: string[]; summary }`
  - `PlannedWrite = { path: string; content: string }`
  - `SyncSummary = { added; changed; removed; npmDependencies; registryDependencies }`
  - `CreateSyncPlanOptions = { registryRoot: string; existingFiles: Map<string, string>; existingItems: InternalRegistryItem[]; acceptedDigests: Map<string, string>; syncDate: string }`

- [ ] **Step 1: 写失败的规范化测试**

```ts
it("splits embedded contents and records provenance", () => {
  const plan = createSyncPlan([fetchedButton], {
    registryRoot: "registry",
    existingFiles: new Map(),
    existingItems: [],
    acceptedDigests: new Map(),
    syncDate: "2026-07-29",
  })
  expect(plan.writes).toEqual(expect.arrayContaining([
    expect.objectContaining({
      path: "registry/ui/button/button.tsx",
      content: expect.stringContaining("export"),
    }),
  ]))
  expect(plan.registryItems[0].meta).toMatchObject({
    origin: "upstream",
    sourceRef: fetchedButton.sourceRef,
    sourceDigest: fetchedButton.digest,
  })
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/sync/normalize.test.ts`

Expected: FAIL，`createSyncPlan` 不存在。

- [ ] **Step 3: 实现安全路径规范化**

对每个 `files[]`：

1. 要求存在 `content`。
2. 将上游路径转换为目标 item 目录下的相对路径。
3. 拒绝绝对路径、`..`、空路径和 item 目录外路径。
4. 生成本地 `files[]` 时删除 `content`，保留 `type` 和必要 `target`。
5. 预览文件不从上游自动推断；同步条目的 `meta.preview` 指向自动生成的
   `preview.tsx`，该文件渲染“该上游资产尚未配置内部预览”的受控空状态。
6. 如果同名现有条目的 `meta.sourceDigest` 与新摘要不同，只有
   `acceptedDigests.get(name)` 精确等于新摘要时才生成计划，否则抛出
   `DigestApprovalRequiredError` 且返回前不产生任何 writes。

目标分类由 item type 固定映射：`registry:ui` 和 `registry:component` 写入
`ui/`，`registry:block` 写入 `blocks/`，`registry:page` 写入 `templates/`；
其他顶层类型在首版同步器中直接失败。

- [ ] **Step 4: 生成来源元数据和变更摘要**

每个条目写入：

```json
{
  "status": "experimental",
  "origin": "upstream",
  "addedAt": "2026-07-29",
  "sourceRef": "<pin-or-digest>",
  "sourceDigest": "sha256:<digest>",
  "preview": "registry/<category>/<name>/preview.tsx"
}
```

新条目使用 `syncDate` 作为 `addedAt`；更新现有条目时保留原来的 `addedAt`，
防止每次同步都被误判为“最近新增”。

比较 `existingFiles` 后把同内容文件排除出 writes。deletes 只允许位于同一个
`sourceId` 曾管理的 item 目录，禁止删除内部 origin 的资产。
计划还必须重写目标分类的 `registry.json`：保留所有 `origin: "internal"`
条目和其他 source id 的条目，只用本次完整 `registryItems` 替换当前 source id
管理的条目，并按 name 排序。

- [ ] **Step 5: 运行测试**

Run: `pnpm test tests/sync/normalize.test.ts`

Expected: PASS，计划顺序稳定，路径逃逸测试失败且计划为空。

- [ ] **Step 6: 提交**

```bash
git add src/sync/normalize.ts src/sync/sync-plan.ts tests/sync/normalize.test.ts
git commit -m "feat: normalize upstream items into reviewable source"
```

---

### Task 5: 原子应用同步计划并生成审核报告

**Files:**
- Create: `src/sync/apply-plan.ts`
- Create: `src/sync/report.ts`
- Create: `tests/sync/apply-plan.test.ts`

**Interfaces:**
- Consumes: 完整 `SyncPlan`。
- Produces:
  - `applySyncPlan(plan, root): Promise<void>`
  - `formatSyncReport(plan): string`

- [ ] **Step 1: 写失败的原子性测试**

```ts
it("leaves the existing tree unchanged when a staged write fails", async () => {
  const before = await snapshotTree(root)
  await expect(applySyncPlan(invalidPlan, root)).rejects.toThrow()
  expect(await snapshotTree(root)).toEqual(before)
})
```

另写测试验证删除范围保护、相同内容不重写、报告包含新增/修改/删除、npm 依赖和
Registry 依赖变化。

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/sync/apply-plan.test.ts`

Expected: FAIL，应用器不存在。

- [ ] **Step 3: 实现暂存与原子替换**

`applySyncPlan`：

1. 在目标 Registry 同级创建 `mkdtemp` 临时目录和唯一 backup 路径。
2. 复制完整 `registry/` 到临时目录。
3. 在临时目录应用所有 writes 和 deletes。
4. 调用核心 `loadCatalog` 与 `assertValidCatalog` 校验临时树。
5. 校验通过后，将当前 `registry/` rename 到 backup，再将临时目录 rename
   为 `registry/`。
6. 第二次 rename 失败时立即把 backup rename 回 `registry/`。
7. 成功后仅删除经过路径校验、名称匹配本次唯一 token 的 backup。
8. 任何异常都清理本次临时目录并恢复原目录。

禁止对仓库根目录、`registry/` 根目录或未包含 source id 标记的目录执行递归
删除。

- [ ] **Step 4: 实现审核报告**

`formatSyncReport` 固定输出以下章节，即使数量为零也输出：

```text
Source: shadcn
Added files: 1
Changed files: 0
Removed files: 0
NPM dependency changes:
- none
Registry dependency changes:
- approval-card: button -> @internal/button
Digest changes:
- button: new -> sha256:...
```

- [ ] **Step 5: 运行测试**

Run: `pnpm test tests/sync/apply-plan.test.ts`

Expected: PASS；故障注入后原目录内容逐字节不变。

- [ ] **Step 6: 提交**

```bash
git add src/sync/apply-plan.ts src/sync/report.ts tests/sync/apply-plan.test.ts
git commit -m "feat: apply upstream sync plans atomically"
```

---

### Task 6: 连接同步 CLI、文档和 CI 验证

**Files:**
- Create: `scripts/sync-upstream.mjs`
- Create: `tests/sync/sync-cli.test.ts`
- Create: `docs/upstream-sync.md`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: 前五项任务的配置、抓取、闭包、规范化、应用和报告接口。
- Produces:
  - `pnpm registry:sync --source <id> [--check] [--accept-digest <name=sha256:...>]`
  - `pnpm test:sync`

- [ ] **Step 1: 写失败的 CLI 集成测试**

测试启动本地 fixture HTTP 服务器：

```ts
it("syncs an allowlisted item and prints a review report", async () => {
  const result = await runSyncCli([
    "--config", fixtureConfig,
    "--source", "fixture",
    "--root", tempRepo,
  ])
  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain("Registry dependency changes:")
  expect(await readFile(
    join(tempRepo, "registry/ui/button/button.tsx"),
    "utf8",
  )).toContain("export")
})
```

再添加 `--check` 测试：发现上游变化时退出码为 1，但不写文件；无变化时退出码
为 0。添加摘要审批测试：已有条目摘要变化且没有 `--accept-digest` 时退出码为
1；参数中的名称和摘要精确匹配后才生成变更。

- [ ] **Step 2: 运行测试并确认失败**

Run: `pnpm test tests/sync/sync-cli.test.ts`

Expected: FAIL，CLI 入口不存在。

- [ ] **Step 3: 实现 CLI 编排**

参数固定为：

```text
--config <path>      默认 upstreams.json
--source <id>        必填，只运行一个白名单来源
--root <path>        默认当前工作目录
--check              只检测变化，不写文件
--accept-digest <name=sha256:...>
                     可重复；精确接受已有条目的一个新摘要
```

执行顺序固定为 load config → resolve closure → create plan → print report →
check mode exit 或 apply plan。错误输出包含 source id 和阶段名，不打印完整响应
正文。

- [ ] **Step 4: 添加 package 脚本和文档**

`package.json` 添加：

```json
{
  "registry:sync": "tsx scripts/sync-upstream.mjs",
  "test:sync": "vitest run tests/sync"
}
```

`docs/upstream-sync.md` 说明白名单字段、固定版本策略、递归依赖、安全失败语义、
同步命令和 Pull Request 审核清单。明确同步命令不会 commit 或部署。

- [ ] **Step 5: 将同步测试加入 CI**

在 `.github/workflows/ci.yml` 的 verify job 中，在主 `pnpm verify` 前运行
`pnpm test:sync`。不在普通 CI 中访问真实外网，所有网络测试使用本地 fixture
服务器；真实同步由人工或单独受控任务触发。

- [ ] **Step 6: 运行完整验证**

Run: `pnpm test:sync && pnpm verify`

Expected: 同步单元/集成测试和核心站点全部 PASS；`git status --short` 只显示
预期测试临时文件已被清理。

- [ ] **Step 7: 提交**

```bash
git add scripts/sync-upstream.mjs tests/sync docs/upstream-sync.md package.json pnpm-lock.yaml .github/workflows/ci.yml
git commit -m "feat: add reviewed upstream registry sync workflow"
```

---

## 同步计划完成条件

- 只有白名单来源和条目能够进入本地 Registry。
- 官方依赖闭包被递归镜像并改写为 `@internal/*`。
- 未批准的外部 Registry 依赖会让同步失败且不写文件。
- 所有上游源码都以普通文件形式进入 Git diff，并带来源和 SHA-256 摘要。
- 任一阶段失败后，当前已发布源码保持逐字节不变。
- CLI 只生成变更和报告，不执行 commit、merge 或部署。
