export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-blue-500 rounded-lg flex items-center justify-center text-xs font-bold">
              CD
            </div>
            <span className="text-sm font-medium text-white/40">CursorDance</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-white/25">
            <a href="/privacy.html" className="hover:text-white/50 transition-colors">
              隐私政策
            </a>
            <a href="/support.html" className="hover:text-white/50 transition-colors">
              帮助支持
            </a>
            <a href="/about.html" className="hover:text-white/50 transition-colors">
              关于
            </a>
            <a href="mailto:rvz1230@163.com" className="hover:text-white/50 transition-colors">
              联系开发者
            </a>
            <a href="https://github.com/Rvz1230/cursor-dance" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">
              GitHub
            </a>
          </div>

          <p className="text-xs text-white/15">
            &copy; {new Date().getFullYear()} CursorDance. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
