import "./globals.css"
import { SiteFrame } from "@/components/site/site-frame"

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteFrame>{children}</SiteFrame>
      </body>
    </html>
  )
}
