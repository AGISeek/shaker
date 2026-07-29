import type { ReactNode } from "react"
import { withBasePath } from "@/src/base-path"

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
    <div className="grid gap-12 lg:grid-cols-[11rem_minmax(0,1fr)_10rem]">
      <details className="rounded-md border p-3 lg:hidden">
        <summary className="cursor-pointer text-sm font-semibold">文档导航</summary>
        <nav className="mt-3 grid gap-2 border-t pt-3 text-sm" aria-label="移动文档导航">
          {navigation.map((item) => <a key={item.href} href={withBasePath(item.href)} className="text-muted-foreground hover:text-foreground">{item.label}</a>)}
          {toc?.map((item) => <a key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">{item.label}</a>)}
        </nav>
      </details>
      <aside className="hidden text-sm lg:block" aria-label="文档导航">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">文档</p>
        <nav className="mt-3 grid gap-2">
          {navigation.map((item) => <a key={item.href} href={withBasePath(item.href)} className="text-muted-foreground hover:text-foreground">{item.label}</a>)}
        </nav>
      </aside>
      <article className="max-w-2xl">{children}</article>
      {toc?.length ? (
        <aside className="hidden text-sm lg:block" aria-label="本页目录">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">本页目录</p>
          <nav className="mt-3 grid gap-2">
            {toc.map((item) => <a key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">{item.label}</a>)}
          </nav>
        </aside>
      ) : null}
    </div>
  )
}
