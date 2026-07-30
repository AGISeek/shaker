import { execFile } from "node:child_process"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)

const REPO_ROOT = join(import.meta.dirname, "../..")
const TSX_CLI = join(REPO_ROOT, "node_modules/tsx/dist/cli.mjs")
const SYNC_SCRIPT = join(REPO_ROOT, "scripts/sync-upstream.mjs")
const FIXTURE_DIR = join(REPO_ROOT, "tests/fixtures/upstream")
const REGISTRY_SCHEMA_URL = "https://ui.shadcn.com/schema/registry.json"
const CLI_TIMEOUT = 120_000

type CliResult = { exitCode: number; stdout: string; stderr: string }

/** Runs the sync CLI as a real subprocess via tsx, capturing exit code and output. */
async function runSyncCli(args: string[]): Promise<CliResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [TSX_CLI, SYNC_SCRIPT, ...args],
      { cwd: REPO_ROOT, maxBuffer: 16 * 1024 * 1024 },
    )
    return { exitCode: 0, stdout, stderr }
  } catch (error) {
    const failure = error as { code?: number | string; stdout?: string; stderr?: string }
    return {
      exitCode: typeof failure.code === "number" ? failure.code : 1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? String(error),
    }
  }
}

type FixtureServer = {
  url: string
  setBody: (name: string, body: string) => void
  close: () => Promise<void>
}

/** Serves tests/fixtures/upstream/*.json over real HTTP on 127.0.0.1. */
async function startFixtureServer(): Promise<FixtureServer> {
  const bodies = new Map<string, string>()
  for (const name of ["button", "approval-card"]) {
    bodies.set(name, await readFile(join(FIXTURE_DIR, `${name}.json`), "utf8"))
  }
  const server = createServer((request, response) => {
    const match = /^\/r\/([a-z0-9-]+)\.json$/.exec(request.url ?? "")
    const body = match ? bodies.get(match[1] as string) : undefined
    if (body === undefined) {
      response.writeHead(404)
      response.end()
      return
    }
    response.writeHead(200, { "content-type": "application/json" })
    response.end(body)
  })
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    setBody: (name, body) => {
      bodies.set(name, body)
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
      }),
  }
}

/** Creates a minimal but valid registry skeleton: root catalog + empty category catalogs. */
async function makeTempRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "shaker-sync-cli-"))
  await mkdir(join(root, "registry"), { recursive: true })
  await writeFile(
    join(root, "registry/registry.json"),
    `${JSON.stringify(
      {
        $schema: REGISTRY_SCHEMA_URL,
        name: "internal",
        homepage: "https://internal.example",
        include: ["ui/registry.json", "blocks/registry.json", "templates/registry.json"],
      },
      null,
      2,
    )}\n`,
  )
  for (const category of ["ui", "blocks", "templates"]) {
    await mkdir(join(root, "registry", category), { recursive: true })
    await writeFile(
      join(root, "registry", category, "registry.json"),
      `${JSON.stringify({ $schema: REGISTRY_SCHEMA_URL, name: `internal-${category}`, items: [] }, null, 2)}\n`,
    )
  }
  return root
}

async function writeFixtureConfig(
  root: string,
  serverUrl: string,
  items: string[] = ["button", "approval-card"],
): Promise<string> {
  const configPath = join(root, "upstreams.json")
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        sources: [
          {
            id: "fixture",
            catalog: `${serverUrl}/r/registry.json`,
            itemTemplate: `${serverUrl}/r/{name}.json`,
            items,
            pin: { kind: "none" },
            allowDigestPin: true,
            recursiveDependencies: true,
          },
        ],
      },
      null,
      2,
    )}\n`,
  )
  return configPath
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await readFile(path)
    return true
  } catch {
    return false
  }
}

let server: FixtureServer
let tempRepo: string
let fixtureConfig: string

beforeEach(async () => {
  server = await startFixtureServer()
  tempRepo = await makeTempRepo()
  fixtureConfig = await writeFixtureConfig(tempRepo, server.url)
})

afterEach(async () => {
  await server.close()
  await rm(tempRepo, { recursive: true, force: true })
})

describe("sync-upstream CLI", () => {
  it(
    "syncs an allowlisted item and prints a review report",
    { timeout: CLI_TIMEOUT },
    async () => {
      const result = await runSyncCli([
        "--config",
        fixtureConfig,
        "--source",
        "fixture",
        "--root",
        tempRepo,
      ])

      expect(result.exitCode, result.stderr).toBe(0)
      expect(result.stdout).toContain("Registry dependency changes:")
      expect(result.stdout).toContain("- approval-card: none -> @internal/button")
      expect(await readFile(join(tempRepo, "registry/ui/button/button.tsx"), "utf8")).toContain(
        "export",
      )
      expect(
        await readFile(join(tempRepo, "registry/blocks/approval-card/approval-card.tsx"), "utf8"),
      ).toContain("ApprovalCard")
      // Provenance marker and generated preview land next to the sources.
      expect(await readFile(join(tempRepo, "registry/ui/button/.upstream-source"), "utf8")).toBe(
        "fixture\n",
      )
      expect(await pathExists(join(tempRepo, "registry/ui/button/preview.tsx"))).toBe(true)
      // Category catalogs reference the synced items.
      const uiCatalog = JSON.parse(
        await readFile(join(tempRepo, "registry/ui/registry.json"), "utf8"),
      ) as { items: { name: string }[] }
      expect(uiCatalog.items.map((item) => item.name)).toEqual(["button"])
      const blocksCatalog = JSON.parse(
        await readFile(join(tempRepo, "registry/blocks/registry.json"), "utf8"),
      ) as { items: { name: string }[] }
      expect(blocksCatalog.items.map((item) => item.name)).toEqual(["approval-card"])
    },
  )

  it(
    "exits 1 in --check mode when upstream changes exist, without writing files",
    { timeout: CLI_TIMEOUT },
    async () => {
      const result = await runSyncCli([
        "--config",
        fixtureConfig,
        "--source",
        "fixture",
        "--root",
        tempRepo,
        "--check",
      ])

      expect(result.exitCode, result.stderr).toBe(1)
      expect(result.stdout).toContain("Registry dependency changes:")
      expect(await pathExists(join(tempRepo, "registry/ui/button/button.tsx"))).toBe(false)
      const uiCatalog = JSON.parse(
        await readFile(join(tempRepo, "registry/ui/registry.json"), "utf8"),
      ) as { items: unknown[] }
      expect(uiCatalog.items).toEqual([])
    },
  )

  it(
    "exits 0 in --check mode once the registry is up to date",
    { timeout: CLI_TIMEOUT },
    async () => {
      const apply = await runSyncCli([
        "--config",
        fixtureConfig,
        "--source",
        "fixture",
        "--root",
        tempRepo,
      ])
      expect(apply.exitCode, apply.stderr).toBe(0)

      const check = await runSyncCli([
        "--config",
        fixtureConfig,
        "--source",
        "fixture",
        "--root",
        tempRepo,
        "--check",
      ])

      expect(check.exitCode, check.stderr).toBe(0)
      expect(check.stdout).toContain("Added files: 0")
      expect(check.stdout).toContain("Changed files: 0")
    },
  )

  it(
    "requires an exact --accept-digest approval before applying a digest change",
    { timeout: CLI_TIMEOUT },
    async () => {
      const apply = await runSyncCli([
        "--config",
        fixtureConfig,
        "--source",
        "fixture",
        "--root",
        tempRepo,
      ])
      expect(apply.exitCode, apply.stderr).toBe(0)
      const buttonPath = join(tempRepo, "registry/ui/button/button.tsx")
      const originalSource = await readFile(buttonPath, "utf8")

      // Upstream publishes a new version of button.
      const updated = JSON.parse(await readFile(join(FIXTURE_DIR, "button.json"), "utf8")) as {
        description: string
        files: { content: string }[]
      }
      updated.description = "Updated upstream button."
      updated.files[0]!.content = `${updated.files[0]!.content}// upstream v2\n`
      server.setBody("button", JSON.stringify(updated))

      // Digest changed without approval: exit 1, nothing written.
      const rejected = await runSyncCli([
        "--config",
        fixtureConfig,
        "--source",
        "fixture",
        "--root",
        tempRepo,
      ])
      expect(rejected.exitCode).toBe(1)
      expect(rejected.stderr).toContain("fixture")
      expect(rejected.stderr).toContain("digest changed")
      expect(rejected.stderr).toContain("--accept-digest")
      expect(await readFile(buttonPath, "utf8")).toBe(originalSource)

      // Exact name and digest are both required: a wrong digest or a wrong
      // item name must not approve the update.
      const digestMatch = /--accept-digest button=(sha256:[a-f0-9]{64})/.exec(rejected.stderr)
      expect(digestMatch, rejected.stderr).not.toBeNull()
      const newDigest = digestMatch![1]!

      const wrongApprovals = await runSyncCli([
        "--config",
        fixtureConfig,
        "--source",
        "fixture",
        "--root",
        tempRepo,
        "--accept-digest",
        `button=sha256:${"0".repeat(64)}`,
        "--accept-digest",
        `dialog=${newDigest}`,
      ])
      expect(wrongApprovals.exitCode).toBe(1)
      expect(await readFile(buttonPath, "utf8")).toBe(originalSource)

      // Exact approval: the update is applied.
      const approved = await runSyncCli([
        "--config",
        fixtureConfig,
        "--source",
        "fixture",
        "--root",
        tempRepo,
        "--accept-digest",
        `button=${newDigest}`,
      ])
      expect(approved.exitCode, approved.stderr).toBe(0)
      expect(await readFile(buttonPath, "utf8")).toContain("upstream v2")
    },
  )

  it(
    "reports the source id and stage when the source is unknown",
    { timeout: CLI_TIMEOUT },
    async () => {
      const result = await runSyncCli([
        "--config",
        fixtureConfig,
        "--source",
        "ghost",
        "--root",
        tempRepo,
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("ghost")
      expect(result.stderr).toContain("load config")
    },
  )

  it(
    "reports the source id and stage when fetching fails",
    { timeout: CLI_TIMEOUT },
    async () => {
      const config = await writeFixtureConfig(tempRepo, server.url, ["missing-item"])

      const result = await runSyncCli([
        "--config",
        config,
        "--source",
        "fixture",
        "--root",
        tempRepo,
      ])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("fixture")
      expect(result.stderr).toContain("resolve dependency closure")
      expect(result.stderr).toContain("missing-item")
    },
  )

  it(
    "rejects malformed arguments with a usage error",
    { timeout: CLI_TIMEOUT },
    async () => {
      const missingSource = await runSyncCli(["--config", fixtureConfig, "--root", tempRepo])
      expect(missingSource.exitCode).toBe(1)
      expect(missingSource.stderr).toContain("--source")

      const malformedDigest = await runSyncCli([
        "--config",
        fixtureConfig,
        "--source",
        "fixture",
        "--root",
        tempRepo,
        "--accept-digest",
        "not-a-digest",
      ])
      expect(malformedDigest.exitCode).toBe(1)
      expect(malformedDigest.stderr).toContain("--accept-digest")
    },
  )
})
