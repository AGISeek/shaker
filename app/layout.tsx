import "./globals.css"
import type { Metadata } from "next"
import { SiteFrame } from "@/components/site/site-frame"

export const metadata: Metadata = {
  title: "Shaker UI",
  description: "团队可复用的 UI 资产",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <SiteFrame>{children}</SiteFrame>
      </body>
    </html>
  )
}
