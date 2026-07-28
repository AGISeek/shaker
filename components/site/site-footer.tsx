type SiteFooterProps = {
  buildRef?: string
}

export function SiteFooter({ buildRef = process.env.NEXT_PUBLIC_BUILD_REF ?? "dev" }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <p>Shaker UI · 内部组件资产中心</p>
      <p>构建版本：{buildRef}</p>
    </footer>
  )
}
