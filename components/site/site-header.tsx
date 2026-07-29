"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { CommandMenu } from "./command-menu"

const navigation = [
  { href: "/docs/cli/", label: "Docs" },
  { href: "/components/", label: "Components" },
  { href: "/blocks/", label: "Blocks" },
  { href: "/templates/", label: "Templates" },
]

export function SiteHeader() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")

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

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    return () => { delete document.documentElement.dataset.theme }
  }, [theme])

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <Link className="site-brand" href="/">
            <span className="site-brand__mark" aria-hidden="true">S</span>
            Shaker UI
          </Link>
          <nav className="site-nav" aria-label="主导航">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href}>{item.label}</Link>
            ))}
          </nav>
          <div className="site-actions">
            <button type="button" className="icon-button" aria-keyshortcuts="Control+K Meta+K" onClick={() => setIsSearchOpen(true)}>搜索资产… <kbd>⌘K</kbd></button>
            <button type="button" className="icon-button" aria-label="切换主题" aria-pressed={theme === "dark"} onClick={() => setTheme((current) => current === "light" ? "dark" : "light")}>◐</button>
          </div>
        </div>
      </header>
      <CommandMenu open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </>
  )
}
