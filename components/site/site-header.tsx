import Link from "next/link"

const navigation = [
  { href: "/docs/cli/", label: "Docs" },
  { href: "/components/", label: "Components" },
  { href: "/blocks/", label: "Blocks" },
  { href: "/templates/", label: "Templates" },
]

export function SiteHeader() {
  return (
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
          <button type="button" className="icon-button" aria-label="搜索">⌘K</button>
          <button type="button" className="icon-button" aria-label="切换主题">◐</button>
        </div>
      </div>
    </header>
  )
}
