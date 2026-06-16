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
        input: {
          index: resolve(__dirname, "src/desktop/preload/index.ts"),
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
    define: {
      "globalThis.VITE_CURSORDANCE_AI_API_ENDPOINT": JSON.stringify(process.env.VITE_CURSORDANCE_AI_API_ENDPOINT || ""),
      "globalThis.VITE_CURSORDANCE_AI_API_STREAM_ENDPOINT": JSON.stringify(process.env.VITE_CURSORDANCE_AI_API_STREAM_ENDPOINT || ""),
      "globalThis.VITE_CURSORDANCE_AI_AGENT_ENDPOINT": JSON.stringify(process.env.VITE_CURSORDANCE_AI_AGENT_ENDPOINT || ""),
      "globalThis.VITE_CURSORDANCE_AI_API_ACCESS_TOKEN": JSON.stringify(process.env.VITE_CURSORDANCE_AI_API_ACCESS_TOKEN || ""),
      "globalThis.VITE_CURSORDANCE_AI_TIMEOUT_MS": JSON.stringify(process.env.VITE_CURSORDANCE_AI_TIMEOUT_MS || ""),
    },
    build: {
      rollupOptions: {
        input: {
          workbench: resolve(__dirname, "src/desktop/renderer/workbench/index.html"),
          overlay: resolve(__dirname, "src/desktop/renderer/overlay/index.html"),
          popup: resolve(__dirname, "src/desktop/renderer/popup/index.html"),
        },
      },
    },
  },
});
