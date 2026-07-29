"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { SiteFooter } from "./site-footer"
import { SiteHeader } from "./site-header"

export function SiteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname.startsWith("/preview/")) return <>{children}</>

  return (
    <>
      <SiteHeader />
      <main className="site-main mx-auto min-h-[calc(100vh-8.5rem)] max-w-[86rem] px-5 pb-20 pt-14">{children}</main>
      <SiteFooter />
    </>
  )
}
