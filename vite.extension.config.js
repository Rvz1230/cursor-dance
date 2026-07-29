import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
    },
  },
  build: {
    outDir: path.resolve(projectRoot, "dist"),
    emptyOutDir: false,
    lib: {
      entry: path.resolve(projectRoot, "src/extension/content-entry.ts"),
      name: "CursorDanceContentBundle",
      formats: ["iife"],
      fileName: () => "content-runtime/content.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
