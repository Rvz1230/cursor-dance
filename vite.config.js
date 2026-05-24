import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: './',
  appType: 'mpa',
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "public/**/*.test.js", "scripts/**/*.test.js", "server/**/*.test.js"],
    deps: {
      inline: ["**/public/config-runtime/*.js"],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        options: path.resolve(__dirname, 'index.html'),
        popup: path.resolve(__dirname, 'popup.html'),
      },
    },
  },
})
