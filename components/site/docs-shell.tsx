import type { ReactNode } from "react"

export type DocsNavigationItem = {
  href: string
  label: string
}

export type DocsTocItem = {
  href: string
  label: string
}

type DocsShellProps = {
  navigation: DocsNavigationItem[]
  toc?: DocsTocItem[]
  children: ReactNode
}

export function DocsShell({ navigation, toc, children }: DocsShellProps) {
  return (
    <div className="docs-shell">
      <aside className="docs-shell__nav" aria-label="文档导航">
        <p className="eyebrow">文档</p>
        <nav>
          {navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
        </nav>
      </aside>
      <article className="docs-shell__content">{children}</article>
      {toc?.length ? (
        <aside className="docs-shell__toc" aria-label="本页目录">
          <p className="eyebrow">本页目录</p>
          <nav>{toc.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
        </aside>
      ) : null}
    </div>
  )
}
