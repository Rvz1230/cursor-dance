/** @type {import('tailwindcss').Config} */
module.exports = {
  // 只扫描本目录：稿子与 src/ 的编译产物互不干扰
  content: [
    "./docs/ui-spec/*.html",
    "./docs/ui-spec/surfaces/*.html",
    "./docs/ui-spec/library/*.html",
    "./docs/ui-spec/archive/*.html",
    "./docs/ui-spec/shell.js",
    "./docs/ui-spec/controls.js",
  ],
  darkMode: "class",
  theme: { extend: { fontSize: { "2xs": ["0.625rem", { lineHeight: "0.875rem" }] } } },
  plugins: [],
};
