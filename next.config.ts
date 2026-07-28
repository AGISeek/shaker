import type { NextConfig } from "next"

const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: { useTypeScriptCli: true },
}

export default config
