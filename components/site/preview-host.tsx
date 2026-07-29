"use client"

import { useSearchParams } from "next/navigation"
import { previewMap } from "@/generated/preview-map"
import { PreviewErrorBoundary } from "./preview-error-boundary"

export function PreviewHost({ name }: { name: string }) {
  const theme = useSearchParams().get("theme") === "dark" ? "dark" : "light"
  const Preview = previewMap[name]

  if (!Preview) return null

  return (
    <div className={`preview-host min-h-screen bg-background p-8 text-foreground${theme === "dark" ? " dark" : ""}`}>
      <PreviewErrorBoundary><Preview /></PreviewErrorBoundary>
    </div>
  )
}
