import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { loadCatalog } from "../src/registry/catalog.ts"
import { readItemSources } from "../src/registry/source.ts"
import { applySyncPlan } from "../src/sync/apply-plan.ts"
import { loadUpstreamConfig } from "../src/sync/config.ts"
import { resolveDependencyClosure } from "../src/sync/dependency-closure.ts"
import { UPSTREAM_SOURCE_MARKER } from "../src/sync/normalize.ts"
import { formatSyncReport } from "../src/sync/report.ts"
import { createSyncPlan } from "../src/sync/sync-plan.ts"

const USAGE = `Usage: tsx scripts/sync-upstream.mjs --source <id> [options]

Options:
  --config <path>                    upstream allowlist config (default: upstreams.json)
  --source <id>                      allowlisted source to sync (required)
  --root <path>                      repository root to sync into (default: cwd)
  --check                            only detect changes; exits 1 when the registry is outdated
  --accept-digest <name=sha256:...>  approve a digest change for an existing item (repeatable)
`

const REGISTRY_ROOT = "registry"
const CATEGORIES = ["ui", "blocks", "templates"]

class UsageError extends Error {}

function takeValue(argv, index, flag) {
  const value = argv[index + 1]
  if (value === undefined || value.startsWith("--")) {
    throw new UsageError(`${flag} requires a value\n\n${USAGE}`)
  }
  return value
}

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/

function parseArgs(argv) {
  const args = {
    config: "upstreams.json",
    source: undefined,
    root: process.cwd(),
    check: false,
    acceptedDigests: new Map(),
  }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    switch (flag) {
      case "--config":
        args.config = takeValue(argv, index, flag)
        index += 1
        break
      case "--source":
        args.source = takeValue(argv, index, flag)
        index += 1
        break
      case "--root":
        args.root = takeValue(argv, index, flag)
        index += 1
        break
      case "--check":
        args.check = true
        break
      case "--accept-digest": {
        const value = takeValue(argv, index, flag)
        index += 1
        const separator = value.indexOf("=")
        const name = separator === -1 ? "" : value.slice(0, separator)
        const digest = separator === -1 ? "" : value.slice(separator + 1)
        if (!/^[a-z0-9][a-z0-9-]*$/.test(name) || !DIGEST_PATTERN.test(digest)) {
          throw new UsageError(
            `--accept-digest expects <name=sha256:...>, got "${value}"\n\n${USAGE}`,
          )
        }
        if (args.acceptedDigests.has(name)) {
          throw new UsageError(`--accept-digest given twice for "${name}"\n\n${USAGE}`)
        }
        args.acceptedDigests.set(name, digest)
        break
      }
      default:
        throw new UsageError(`Unknown argument "${flag}"\n\n${USAGE}`)
    }
  }
  if (args.source === undefined) {
    throw new UsageError(`Missing required --source <id>\n\n${USAGE}`)
  }
  return args
}

/** Adds the source id and stage name to any error without leaking response bodies. */
async function runStage(stage, sourceId, fn) {
  try {
    return await fn()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const wrapped = new Error(`sync failed for source "${sourceId}" during ${stage}: ${message}`)
    wrapped.cause = error
    throw wrapped
  }
}

function categoryForType(type) {
  if (type === "registry:block") return "blocks"
  if (type === "registry:page") return "templates"
  return "ui"
}

async function readIfExists(path) {
  try {
    return await readFile(path, "utf8")
  } catch {
    return undefined
  }
}

/**
 * Builds the plan's view of the current registry: category catalogs, every
 * item's source files, previews and upstream source markers. Keys are paths
 * relative to the repository root ("registry/<category>/<name>/<file>").
 */
async function collectExistingFiles(root, items) {
  const files = new Map()
  for (const category of CATEGORIES) {
    const path = `${REGISTRY_ROOT}/${category}/registry.json`
    const content = await readIfExists(join(root, path))
    if (content !== undefined) files.set(path, content)
  }
  for (const item of items) {
    try {
      for (const source of await readItemSources(item, root)) {
        files.set(`${REGISTRY_ROOT}/${source.path}`, source.content)
      }
    } catch {
      // A catalog entry with missing sources is a validation problem, not a
      // sync input: leave it out so the plan rewrites the files.
    }
    const preview = item.meta?.preview
    if (typeof preview === "string") {
      const content = await readIfExists(join(root, preview))
      if (content !== undefined) files.set(preview, content)
    }
    if (item.meta?.origin === "upstream") {
      const markerPath = `${REGISTRY_ROOT}/${categoryForType(item.type)}/${item.name}/${UPSTREAM_SOURCE_MARKER}`
      const content = await readIfExists(join(root, markerPath))
      if (content !== undefined) files.set(markerPath, content)
    }
  }
  return files
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const root = resolve(args.root)

  const config = await runStage("load config", args.source, () => loadUpstreamConfig(args.config))
  const source = config.sources.find((candidate) => candidate.id === args.source)
  if (source === undefined) {
    throw new Error(
      `sync failed for source "${args.source}" during load config: ` +
        `no source with id "${args.source}" in ${args.config}`,
    )
  }

  const fetched = await runStage("resolve dependency closure", source.id, () =>
    resolveDependencyClosure({ source, roots: source.items, allowedItems: new Set(source.items) }),
  )

  const plan = await runStage("create sync plan", source.id, async () => {
    // A missing or unreadable catalog means this is the first sync into the
    // root: plan against an empty registry.
    const existingItems = await loadCatalog(root).catch(() => [])
    const existingFiles = await collectExistingFiles(root, existingItems)
    return createSyncPlan(fetched, {
      registryRoot: REGISTRY_ROOT,
      existingFiles,
      existingItems,
      acceptedDigests: args.acceptedDigests,
      syncDate: new Date().toISOString().slice(0, 10),
    })
  })

  console.log(formatSyncReport(plan))

  if (args.check) {
    const hasChanges = plan.writes.length > 0 || plan.deletes.length > 0
    console.log(
      hasChanges
        ? "Check mode: upstream changes detected; re-run without --check to apply."
        : "Check mode: registry is up to date.",
    )
    process.exitCode = hasChanges ? 1 : 0
    return
  }

  await runStage("apply sync plan", source.id, () => applySyncPlan(plan, root))
  console.log(`Applied sync plan for source "${source.id}".`)
}

try {
  await main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(error instanceof UsageError ? message : `error: ${message}`)
  process.exitCode = 1
}
