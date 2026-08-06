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
  // 2xs 从 0.625rem(10px) 提到 0.6875rem(11px)。
  //
  // 10px 是全稿说明文字的尺寸（04 一页就有 91 处），而它承担的是**教学**内容——
  // 「100% 就是现在运行时的系数」「太低会在长按时刷屏」「间隔 260ms 内算连击」
  // 这类必须读懂的话。最需要被读的字被排成了最小的字。
  //
  // 11px 是有依据的下限：macOS 的 NSFont.smallSystemFontSize 就是 11pt，
  // 系统自己的辅助文字不会更小。行高一并从 14px 提到 16px，
  // 否则 11px 挤在 14px 行里会比 10px 更难读。
  theme: { extend: { fontSize: { "2xs": ["0.6875rem", { lineHeight: "1rem" }] } } },
  plugins: [],
};
