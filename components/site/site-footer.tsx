type SiteFooterProps = {
  buildRef?: string
}

export function SiteFooter({ buildRef = process.env.NEXT_PUBLIC_BUILD_REF ?? "dev" }: SiteFooterProps) {
  return (
    <footer className="site-footer mx-auto flex max-w-6xl flex-wrap justify-between gap-2 border-t px-5 py-6 text-xs text-muted-foreground">
      <p>Shaker UI · 内部组件资产中心</p>
      <p>构建版本：{buildRef}</p>
    </footer>
  )
}
