import { useToast } from "./Toast.jsx";
import { scrollToDemo } from "../lib/scroll.js";

export default function InstallButton({ className = "", variant = "primary" }) {
  const showToast = useToast();

  const base =
    variant === "primary"
      ? "bg-white text-gray-900 hover:bg-gray-100 shadow-lg shadow-violet-500/20"
      : "bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/25";

  return (
    <button
      type="button"
      onClick={() => {
        showToast("即将上架 Chrome Web Store，敬请期待");
        scrollToDemo();
      }}
      className={`inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer ${base} ${className}`}
    >
      安装插件
    </button>
  );
}
