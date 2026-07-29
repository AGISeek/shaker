"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { previewMap } from "@/generated/preview-map"
import { PreviewErrorBoundary } from "./preview-error-boundary"

export function PreviewHost({ name }: { name: string }) {
  const theme = useSearchParams().get("theme") === "dark" ? "dark" : "light"
  const { setTheme } = useTheme()
  const Preview = previewMap[name]

  useEffect(() => { setTheme(theme) }, [setTheme, theme])

  if (!Preview) return null

  return (
    <div className="preview-host min-h-screen bg-background p-8 text-foreground">
      <PreviewErrorBoundary><Preview /></PreviewErrorBoundary>
    </div>
  )
}
