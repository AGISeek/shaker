import { afterEach, describe, expect, it, vi } from "vitest"

async function loadWithBasePath(value?: string) {
  vi.resetModules()
  if (value === undefined) {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "")
  } else {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", value)
  }
  return import("@/src/base-path")
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("withBasePath", () => {
  it("leaves paths unchanged when no base path is configured", async () => {
    const { withBasePath } = await loadWithBasePath()
    expect(withBasePath("/items/button/")).toBe("/items/button/")
  })

  it("prefixes root-relative paths with the configured base path", async () => {
    const { withBasePath } = await loadWithBasePath("/shaker")
    expect(withBasePath("/items/button/")).toBe("/shaker/items/button/")
    expect(withBasePath("/search-index.json")).toBe("/shaker/search-index.json")
  })

  it("does not touch anchors or external URLs", async () => {
    const { withBasePath } = await loadWithBasePath("/shaker")
    expect(withBasePath("#install")).toBe("#install")
    expect(withBasePath("https://example.com/docs")).toBe("https://example.com/docs")
  })
})
