import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
  root: fileURLToPath(new URL("./src/web", import.meta.url)),
  base: "./",
  esbuild: { jsx: "automatic" },
  build: {
    outDir: fileURLToPath(new URL("./dist/web", import.meta.url)),
    emptyOutDir: true,
    license: { fileName: "THIRD_PARTY_LICENSES.md" },
  },
})
