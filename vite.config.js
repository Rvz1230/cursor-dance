import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function removeTestFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeTestFiles(full);
    } else if (entry.name.includes(".test.") || entry.name.includes(".spec.")) {
      fs.rmSync(full);
    }
  }
}

function excludeTestFilesPlugin() {
  return {
    name: "exclude-test-files",
    closeBundle() {
      const distDir = path.resolve(projectRoot, "dist");
      removeTestFiles(distDir);
      fs.rmSync(path.join(distDir, "content-runtime"), { recursive: true, force: true });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    base: "./",
    appType: "mpa",
    publicDir: path.resolve(projectRoot, "extension"),
    plugins: [react(), excludeTestFilesPlugin()],
    define: {
      "globalThis.VITE_CURSORDANCE_AI_API_ENDPOINT": JSON.stringify(
        env.VITE_CURSORDANCE_AI_API_ENDPOINT || ""
      ),
      "globalThis.VITE_CURSORDANCE_AI_API_STREAM_ENDPOINT": JSON.stringify(
        env.VITE_CURSORDANCE_AI_API_STREAM_ENDPOINT || ""
      ),
      "globalThis.VITE_CURSORDANCE_AI_AGENT_ENDPOINT": JSON.stringify(
        env.VITE_CURSORDANCE_AI_AGENT_ENDPOINT || ""
      ),
      "globalThis.VITE_CURSORDANCE_AI_API_ACCESS_TOKEN": JSON.stringify(
        env.VITE_CURSORDANCE_AI_API_ACCESS_TOKEN || ""
      ),
      "globalThis.VITE_CURSORDANCE_AI_TIMEOUT_MS": JSON.stringify(
        env.VITE_CURSORDANCE_AI_TIMEOUT_MS || ""
      ),
    },
    test: {
      environment: "node",
      include: [
        "src/**/*.test.{js,ts,tsx}",
        "extension/**/*.test.js",
        "scripts/**/*.test.js",
        "server/**/*.test.js",
        "landing/src/**/*.test.js",
      ],
    },
    resolve: {
      alias: {
        "@": path.resolve(projectRoot, "src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8787",
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          options: path.resolve(projectRoot, "index.html"),
          popup: path.resolve(projectRoot, "popup.html"),
          runtimePreview: path.resolve(projectRoot, "runtime-preview.html"),
        },
      },
    },
  };
});
