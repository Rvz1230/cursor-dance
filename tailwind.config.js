/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./popup.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/renderer/**/*.{html,js,ts,jsx,tsx}",
    "./*.jsx",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
