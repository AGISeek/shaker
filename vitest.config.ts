import path from "node:path"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@/components/ui/button": path.resolve(__dirname, "registry/ui/button/button.tsx"),
      "@/components/approval-card": path.resolve(__dirname, "registry/blocks/approval-card/approval-card.tsx"),
      "@/ui": path.resolve(__dirname, "components/ui"),
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
})
