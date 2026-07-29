import path from "node:path"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
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
