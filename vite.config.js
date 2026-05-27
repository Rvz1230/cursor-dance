import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    base: "./",
    appType: "mpa",
    plugins: [react()],
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
        "src/**/*.test.js",
        "public/**/*.test.js",
        "scripts/**/*.test.js",
        "server/**/*.test.js",
      ],
      deps: {
        inline: ["**/public/config-runtime/*.js"],
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
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
          options: path.resolve(__dirname, "index.html"),
          popup: path.resolve(__dirname, "popup.html"),
        },
      },
    },
  };
});
