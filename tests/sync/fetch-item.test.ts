import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { canonicalizeJson, fetchRegistryItem, UpstreamFetchError } from "@/src/sync/fetch-item"
import type { FetchedItem } from "@/src/sync/fetch-item"
import type { UpstreamSource } from "@/src/sync/config"

const fixturePath = join(import.meta.dirname, "../fixtures/upstream/button.json")

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

async function loadFixture(): Promise<string> {
  return readFile(fixturePath, "utf8")
}

function jsonFetcher(body: string, init: { status?: number; contentType?: string } = {}) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetcher = async (url: string | URL | Request, requestInit?: RequestInit) => {
    calls.push({ url: String(url), init: requestInit })
    return new Response(body, {
      status: init.status ?? 200,
      headers: { "Content-Type": init.contentType ?? "application/json" },
    })
  }
  return { fetcher: fetcher as typeof fetch, calls }
}

describe("fetchRegistryItem", () => {
  it("validates the item and hashes canonical JSON", async () => {
    const { fetcher } = jsonFetcher(await loadFixture())

    const result = await fetchRegistryItem(source(), "button", fetcher)

    expect(result.sourceUrl).toBe("https://example.com/r/button.json")
    expect(result.digest).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(result.item.name).toBe("button")
    expect(result.sourceId).toBe("shadcn")
  })

  it("sends an Accept: application/json header", async () => {
    const { fetcher, calls } = jsonFetcher(await loadFixture())

    await fetchRegistryItem(source(), "button", fetcher)

    expect(calls).toHaveLength(1)
    expect(new Headers(calls[0].init?.headers).get("Accept")).toBe("application/json")
  })

  it("produces the same digest regardless of object key order", async () => {
    const original = JSON.parse(await loadFixture()) as Record<string, unknown>
    const reordered = Object.fromEntries(Object.entries(original).reverse())

    const first = await fetchRegistryItem(
      source(),
      "button",
      jsonFetcher(JSON.stringify(original)).fetcher,
    )
    const second = await fetchRegistryItem(
      source(),
      "button",
      jsonFetcher(JSON.stringify(reordered)).fetcher,
    )

    expect(second.digest).toBe(first.digest)
  })

  it("pins the fixture digest to a golden value", async () => {
    const { fetcher } = jsonFetcher(await loadFixture())

    const result = await fetchRegistryItem(source(), "button", fetcher)

    expect(result.digest).toBe(
      "sha256:938ae16d6935249df469244a05f7fca31782c214e5bfbce0b11c8a65d0a5ade5",
    )
  })

  it("uses the git ref as sourceRef when pinned to git", async () => {
    const { fetcher } = jsonFetcher(await loadFixture())

    const result = await fetchRegistryItem(
      source({ pin: { kind: "git", ref: "v2.0.0" }, allowDigestPin: false }),
      "button",
      fetcher,
    )

    expect(result.sourceRef).toBe("v2.0.0")
  })

  it("uses the version as sourceRef when pinned to a version", async () => {
    const { fetcher } = jsonFetcher(await loadFixture())

    const result = await fetchRegistryItem(
      source({ pin: { kind: "version", version: "1.2.3" }, allowDigestPin: false }),
      "button",
      fetcher,
    )

    expect(result.sourceRef).toBe("1.2.3")
  })

  it("falls back to the digest as sourceRef without a stable pin", async () => {
    const { fetcher } = jsonFetcher(await loadFixture())

    const result = await fetchRegistryItem(source(), "button", fetcher)

    expect(result.sourceRef).toBe(result.digest)
  })

  it("throws UpstreamFetchError with source id, url and status on non-2xx", async () => {
    const { fetcher } = jsonFetcher("not found", { status: 404 })

    const error = await fetchRegistryItem(source(), "button", fetcher).catch((e) => e)

    expect(error).toBeInstanceOf(UpstreamFetchError)
    expect(error.sourceId).toBe("shadcn")
    expect(error.url).toBe("https://example.com/r/button.json")
    expect(error.status).toBe(404)
    expect(error.message).toContain("shadcn")
    expect(error.message).toContain("https://example.com/r/button.json")
  })

  it("wraps fetcher rejections with source id and url context", async () => {
    const cause = new Error("connection refused")
    const fetcher = (async () => {
      throw cause
    }) as typeof fetch

    const error = await fetchRegistryItem(source(), "button", fetcher).catch((e) => e)

    expect(error.message).toContain("shadcn")
    expect(error.message).toContain("https://example.com/r/button.json")
    expect(error.message).toContain("connection refused")
    expect(error.cause).toBe(cause)
  })

  it("throws an error naming the source and url on non-JSON responses", async () => {
    const { fetcher } = jsonFetcher("<html>oops</html>", { contentType: "text/html" })

    await expect(fetchRegistryItem(source(), "button", fetcher)).rejects.toThrow(
      /shadcn[\s\S]*https:\/\/example\.com\/r\/button\.json/,
    )
  })

  it("throws an error naming the source and url on schema-invalid payloads", async () => {
    const { fetcher } = jsonFetcher(
      JSON.stringify({ name: "button", type: "registry:bogus" }),
    )

    await expect(fetchRegistryItem(source(), "button", fetcher)).rejects.toThrow(
      /shadcn[\s\S]*https:\/\/example\.com\/r\/button\.json/,
    )
  })

  it("throws an error naming the source and url when the item name mismatches", async () => {
    const payload = JSON.parse(await loadFixture())
    payload.name = "dialog"
    const { fetcher } = jsonFetcher(JSON.stringify(payload))

    await expect(fetchRegistryItem(source(), "button", fetcher)).rejects.toThrow(
      /shadcn[\s\S]*https:\/\/example\.com\/r\/button\.json/,
    )
  })
})

describe("canonicalizeJson", () => {
  it("sorts object keys recursively without whitespace", () => {
    expect(canonicalizeJson({ b: { d: 1, c: 2 }, a: true })).toBe(
      '{"a":true,"b":{"c":2,"d":1}}',
    )
  })

  it("preserves array order", () => {
    expect(canonicalizeJson({ list: [3, 1, 2] })).toBe('{"list":[3,1,2]}')
  })

  it("sorts keys of objects nested inside arrays", () => {
    expect(canonicalizeJson({ list: [{ b: 1, a: 2 }] })).toBe('{"list":[{"a":2,"b":1}]}')
  })

  it("handles primitives and null", () => {
    expect(canonicalizeJson(null)).toBe("null")
    expect(canonicalizeJson("x")).toBe('"x"')
    expect(canonicalizeJson(1.5)).toBe("1.5")
  })
})

// Type-level smoke check: FetchedItem shape stays stable for downstream tasks.
const _typeCheck: FetchedItem | null = null
void _typeCheck
