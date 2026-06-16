/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./popup.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/desktop/renderer/**/*.{html,js,ts,jsx,tsx}",
    "./*.jsx",
  ],
  theme: {
    extend: {
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }], // 10px / 14px
      },
    },
  },
  plugins: [],
}
