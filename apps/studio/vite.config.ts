import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * KawnGraph Universe frontend build.
 *
 * In production the built assets in `dist/` are served by @kawngraph/studio-server
 * (the `kawn studio` command). Because the server mounts them at `/`, we build
 * with relative asset URLs (`base: "./"`).
 *
 * In dev, `vite` serves the app and proxies `/api` to a locally-running
 * `kawn studio --no-open` (default port 4173). Override with KAWN_STUDIO_API.
 */
const API_TARGET = process.env.KAWN_STUDIO_API ?? "http://127.0.0.1:4173";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
