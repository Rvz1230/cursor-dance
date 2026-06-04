const STORE_URL =
  "https://chromewebstore.google.com/detail/nckepaijkfcnnmmdllggalogfegpiepi?utm_source=landing";

export default function InstallButton({ className = "", variant = "primary" }) {
  const base =
    variant === "primary"
      ? "bg-white text-gray-900 hover:bg-gray-100 shadow-lg shadow-violet-500/20"
      : "bg-violet-500/15 border border-violet-500/25 text-violet-300 hover:bg-violet-500/25";

  return (
    <a
      href={STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer ${base} ${className}`}
    >
      安装插件
    </a>
  );
}
