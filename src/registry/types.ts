import type { RegistryItem } from "shadcn/schema"

export type AssetStatus = "experimental" | "stable" | "deprecated"

export type InternalMeta = {
  status: AssetStatus
  preview: string
  addedAt: string
  featured?: boolean
  origin: "internal" | "upstream"
  sourceRef: string
  sourceDigest?: string
  /** Upstream source id that manages this asset; set only for origin "upstream". */
  sourceId?: string
  replacedBy?: string
}

export type InternalRegistryItem = RegistryItem & { meta: InternalMeta }
