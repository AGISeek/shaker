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
  replacedBy?: string
}

export type InternalRegistryItem = RegistryItem & { meta: InternalMeta }
