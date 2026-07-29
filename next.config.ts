import type { NextConfig } from "next"

const basePath = process.env.DEPLOY_BASE_PATH || ""

const config: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: { useTypeScriptCli: true },
}

export default config
