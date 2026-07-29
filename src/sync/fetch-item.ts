import { createHash } from "node:crypto"
import { registryItemSchema } from "shadcn/schema"
import type { RegistryItem } from "shadcn/schema"
import { z } from "zod"
import { resolveItemUrl } from "./config"
import type { UpstreamSource } from "./config"

export type FetchedItem = {
  sourceId: string
  sourceUrl: string
  sourceRef: string
  digest: string
  item: RegistryItem
}

export class UpstreamFetchError extends Error {
  constructor(
    readonly sourceId: string,
    readonly url: string,
    readonly status: number,
  ) {
    super(`Upstream source "${sourceId}" request to ${url} failed with status ${status}`)
    this.name = "UpstreamFetchError"
  }
}

export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeJson).join(",")}]`
  }
  const record = value as Record<string, unknown>
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(record[key])}`)
  return `{${entries.join(",")}}`
}

function resolveSourceRef(source: UpstreamSource, digest: string): string {
  if (source.pin.kind === "git") return source.pin.ref
  if (source.pin.kind === "version") return source.pin.version
  return digest
}

export async function fetchRegistryItem(
  source: UpstreamSource,
  name: string,
  fetcher: typeof fetch = fetch,
): Promise<FetchedItem> {
  const url = resolveItemUrl(source, name)

  let response: Response
  try {
    response = await fetcher(url, { headers: { Accept: "application/json" } })
  } catch (error) {
    const wrapped = new Error(
      `Upstream source "${source.id}" request to ${url} failed (${(error as Error).message})`,
    )
    ;(wrapped as Error & { cause?: unknown }).cause = error
    throw wrapped
  }
  if (!response.ok) {
    throw new UpstreamFetchError(source.id, url, response.status)
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throw new Error(
      `Upstream source "${source.id}" returned invalid JSON from ${url} (${(error as Error).message})`,
    )
  }

  const parsed = registryItemSchema.safeParse(payload)
  if (!parsed.success) {
    throw new Error(
      `Upstream source "${source.id}" returned an invalid registry item from ${url}:\n${z.prettifyError(parsed.error)}`,
    )
  }

  if (parsed.data.name !== name) {
    throw new Error(
      `Upstream source "${source.id}" returned item "${parsed.data.name}" from ${url}, expected "${name}"`,
    )
  }

  const digest = `sha256:${createHash("sha256")
    .update(canonicalizeJson(parsed.data))
    .digest("hex")}`

  return {
    sourceId: source.id,
    sourceUrl: url,
    sourceRef: resolveSourceRef(source, digest),
    digest,
    item: parsed.data,
  }
}
