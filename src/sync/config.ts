import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { z } from "zod"

export type UpstreamPin =
  | { kind: "git"; ref: string }
  | { kind: "version"; version: string }
  | { kind: "none" }

export type UpstreamSource = {
  id: string
  catalog: string
  itemTemplate: string
  items: string[]
  pin: UpstreamPin
  allowDigestPin: boolean
  recursiveDependencies: boolean
  namespace?: string
}

export type UpstreamConfig = { sources: UpstreamSource[] }

const pinSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("git"), ref: z.string().min(1) }),
  z.object({ kind: z.literal("version"), version: z.string().min(1) }),
  z.object({ kind: z.literal("none") }),
])

const sourceSchema = z.object({
  id: z.string().min(1),
  catalog: z.string().min(1),
  itemTemplate: z.string().min(1),
  items: z.array(z.string().min(1)),
  pin: pinSchema,
  allowDigestPin: z.boolean(),
  recursiveDependencies: z.boolean(),
  namespace: z.string().min(1).optional(),
})

const configSchema = z.object({
  sources: z.array(sourceSchema),
})

function isAllowedRemoteUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol === "https:") return true
  return url.protocol === "http:" && url.hostname === "127.0.0.1"
}

function validateSources(sources: UpstreamSource[]): void {
  const issues: string[] = []
  const seenIds = new Set<string>()
  const itemOwners = new Map<string, string>()

  for (const source of sources) {
    if (seenIds.has(source.id)) {
      issues.push(`duplicate source id "${source.id}"`)
    }
    seenIds.add(source.id)

    if (source.items.length === 0) {
      issues.push(`source ${source.id} must list at least one item`)
    }

    const seenItems = new Set<string>()
    for (const item of source.items) {
      if (seenItems.has(item)) {
        issues.push(`source ${source.id} lists item "${item}" more than once`)
      }
      seenItems.add(item)

      const owner = itemOwners.get(item)
      if (owner !== undefined && owner !== source.id) {
        issues.push(`item "${item}" is listed by multiple sources (${owner}, ${source.id})`)
      }
      itemOwners.set(item, source.id)
    }

    const placeholderCount = source.itemTemplate.split("{name}").length - 1
    if (placeholderCount !== 1) {
      issues.push(`source ${source.id} itemTemplate must contain exactly one {name} placeholder`)
    }

    if (!isAllowedRemoteUrl(source.catalog)) {
      issues.push(`source ${source.id} catalog must use HTTPS (http is only allowed for 127.0.0.1)`)
    }
    if (!isAllowedRemoteUrl(source.itemTemplate.replace("{name}", "placeholder"))) {
      issues.push(`source ${source.id} itemTemplate must use HTTPS (http is only allowed for 127.0.0.1)`)
    }

    if (source.pin.kind === "none" && !source.allowDigestPin) {
      issues.push(`source ${source.id} must define a stable pin or allow digest pinning`)
    }
  }

  if (issues.length > 0) {
    throw new Error(`Invalid upstream config:\n${issues.join("\n")}`)
  }
}

export async function loadUpstreamConfig(path?: string): Promise<UpstreamConfig> {
  const configPath = path ?? resolve(process.cwd(), "upstreams.json")
  const raw = await readFile(configPath, "utf8")

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `Invalid upstream config at ${configPath}: not valid JSON (${(error as Error).message})`,
    )
  }

  const result = configSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`Invalid upstream config at ${configPath}:\n${result.error.message}`)
  }

  const config: UpstreamConfig = result.data
  validateSources(config.sources)
  return config
}

export function resolveItemUrl(source: UpstreamSource, name: string): string {
  return source.itemTemplate.replace("{name}", encodeURIComponent(name))
}
