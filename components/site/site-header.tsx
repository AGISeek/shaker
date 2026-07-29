"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/ui/button"
import { CommandMenu } from "./command-menu"

const navigation = [
  { href: "/docs/cli/", label: "Docs" },
  { href: "/components/", label: "Components" },
  { href: "/blocks/", label: "Blocks" },
  { href: "/templates/", label: "Templates" },
]

export function SiteHeader() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <>
      <header className="site-header border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
          <Link className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold tracking-tight" href="/">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-xs text-primary-foreground" aria-hidden="true">S</span>
            Shaker UI
          </Link>
          <nav className="hidden gap-5 text-sm text-muted-foreground md:flex" aria-label="主导航">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className="transition-colors hover:text-foreground">{item.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" aria-keyshortcuts="Control+K Meta+K" onClick={() => setIsSearchOpen(true)}>
              搜索资产… <kbd className="ml-1 text-xs text-muted-foreground">⌘K</kbd>
            </Button>
            <Button variant="outline" size="icon" aria-label="切换主题" aria-pressed={mounted && resolvedTheme === "dark"} onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
      </header>
      <CommandMenu open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  )
}
