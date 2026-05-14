import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "public/**/*.test.js"],
    deps: {
      inline: ["**/public/config-runtime/*.js"],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
