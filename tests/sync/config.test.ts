import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it } from "vitest"
import { loadUpstreamConfig, resolveItemUrl } from "@/src/sync/config"
import type { UpstreamSource } from "@/src/sync/config"

let fixtureDir: string
let fixturePath: string

function source(overrides: Partial<UpstreamSource> = {}): UpstreamSource {
  return {
    id: "shadcn",
    catalog: "https://example.com/r/registry.json",
    itemTemplate: "https://example.com/r/{name}.json",
    items: ["button"],
    pin: { kind: "none" },
    allowDigestPin: true,
    recursiveDependencies: true,
    ...overrides,
  }
}

async function writeFixture(config: unknown): Promise<void> {
  await writeFile(fixturePath, `${JSON.stringify(config, null, 2)}\n`)
}

beforeEach(async () => {
  fixtureDir = await mkdtemp(join(tmpdir(), "upstream-config-"))
  fixturePath = join(fixtureDir, "upstreams.json")
})

describe("loadUpstreamConfig", () => {
  it("loads the repository upstreams.json by default", async () => {
    const config = await loadUpstreamConfig()

    expect(config.sources).toHaveLength(1)
    expect(config.sources[0]).toMatchObject({
      id: "shadcn",
      items: ["button"],
      namespace: "@shadcn",
    })
  })

  it("loads a valid config file", async () => {
    await writeFixture({ sources: [source()] })

    const config = await loadUpstreamConfig(fixturePath)

    expect(config.sources).toHaveLength(1)
    expect(config.sources[0].id).toBe("shadcn")
  })

  it("rejects an unpinned source that also disables digest pinning", async () => {
    await writeFixture({
      sources: [
        source({
          id: "bad",
          pin: { kind: "none" },
          allowDigestPin: false,
        }),
      ],
    })

    await expect(loadUpstreamConfig(fixturePath)).rejects.toThrow(
      "source bad must define a stable pin or allow digest pinning",
    )
  })

  it("rejects duplicate source ids", async () => {
    await writeFixture({ sources: [source(), source()] })

    await expect(loadUpstreamConfig(fixturePath)).rejects.toThrow(
      'duplicate source id "shadcn"',
    )
  })

  it("rejects duplicate items within a source", async () => {
    await writeFixture({ sources: [source({ items: ["button", "button"] })] })

    await expect(loadUpstreamConfig(fixturePath)).rejects.toThrow(
      'source shadcn lists item "button" more than once',
    )
  })

  it("rejects duplicate items across sources", async () => {
    await writeFixture({
      sources: [source(), source({ id: "other", items: ["button"] })],
    })

    await expect(loadUpstreamConfig(fixturePath)).rejects.toThrow(
      'item "button" is listed by multiple sources',
    )
  })

  it("rejects an itemTemplate without a {name} placeholder", async () => {
    await writeFixture({
      sources: [source({ itemTemplate: "https://example.com/r/item.json" })],
    })

    await expect(loadUpstreamConfig(fixturePath)).rejects.toThrow(
      "source shadcn itemTemplate must contain exactly one {name} placeholder",
    )
  })

  it("rejects an itemTemplate with multiple {name} placeholders", async () => {
    await writeFixture({
      sources: [
        source({ itemTemplate: "https://example.com/{name}/r/{name}.json" }),
      ],
    })

    await expect(loadUpstreamConfig(fixturePath)).rejects.toThrow(
      "source shadcn itemTemplate must contain exactly one {name} placeholder",
    )
  })

  it("rejects a non-HTTPS remote catalog URL", async () => {
    await writeFixture({
      sources: [source({ catalog: "http://example.com/r/registry.json" })],
    })

    await expect(loadUpstreamConfig(fixturePath)).rejects.toThrow(
      'source shadcn catalog must use HTTPS (http is only allowed for 127.0.0.1)',
    )
  })

  it("rejects a non-HTTPS remote itemTemplate URL", async () => {
    await writeFixture({
      sources: [source({ itemTemplate: "http://example.com/r/{name}.json" })],
    })

    await expect(loadUpstreamConfig(fixturePath)).rejects.toThrow(
      'source shadcn itemTemplate must use HTTPS (http is only allowed for 127.0.0.1)',
    )
  })

  it("allows http URLs on the 127.0.0.1 loopback for tests", async () => {
    await writeFixture({
      sources: [
        source({
          catalog: "http://127.0.0.1:4000/r/registry.json",
          itemTemplate: "http://127.0.0.1:4000/r/{name}.json",
        }),
      ],
    })

    await expect(loadUpstreamConfig(fixturePath)).resolves.toBeDefined()
  })

  it("rejects a source with an empty items list", async () => {
    await writeFixture({ sources: [source({ items: [] })] })

    await expect(loadUpstreamConfig(fixturePath)).rejects.toThrow(
      "source shadcn must list at least one item",
    )
  })

  it("rejects malformed JSON", async () => {
    await writeFile(fixturePath, "{ not json")

    await expect(loadUpstreamConfig(fixturePath)).rejects.toThrow()
  })

  it("rejects a config without sources", async () => {
    await writeFixture({})

    await expect(loadUpstreamConfig(fixturePath)).rejects.toThrow()
  })
})

describe("resolveItemUrl", () => {
  it("replaces the {name} placeholder", () => {
    expect(resolveItemUrl(source(), "button")).toBe(
      "https://example.com/r/button.json",
    )
  })

  it("encodes the item name to prevent path injection", () => {
    expect(resolveItemUrl(source(), "../evil")).toBe(
      "https://example.com/r/..%2Fevil.json",
    )
  })
})
