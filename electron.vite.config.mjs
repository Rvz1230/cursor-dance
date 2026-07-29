import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, "src");

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/desktop/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, "src/desktop/preload/index.ts"),
        output: {
          format: "cjs",
          entryFileNames: "index.js",
          inlineDynamicImports: true,
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/desktop/renderer"),
    resolve: {
      alias: {
        "@": srcDir,
      },
      extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
    },
    plugins: [react()],
    css: {
      postcss: resolve(__dirname, "postcss.config.js"),
    },
    build: {
      rollupOptions: {
        input: {
          workbench: resolve(__dirname, "src/desktop/renderer/workbench/index.html"),
          overlay: resolve(__dirname, "src/desktop/renderer/overlay/index.html"),
        },
      },
    },
  },
});
