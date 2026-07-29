import "./globals.css"
import type { Metadata } from "next"
import { SiteFrame } from "@/components/site/site-frame"
import { ThemeProvider } from "@/components/site/theme-provider"

export const metadata: Metadata = {
  title: "Shaker UI",
  description: "团队可复用的 UI 资产",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SiteFrame>{children}</SiteFrame>
        </ThemeProvider>
      </body>
    </html>
  )
}
