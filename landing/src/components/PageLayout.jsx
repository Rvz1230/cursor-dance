import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "功能", href: "/#features" },
  { label: "上手", href: "/#how-it-works" },
  { label: "主题", href: "/#themes" },
  { label: "关于", href: "/about.html" },
];

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-blue-500 rounded-lg flex items-center justify-center text-sm font-bold shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow">
            CD
          </div>
          <span className="font-semibold text-lg text-white">CursorDance</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white/45 hover:text-white/80 transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#"
            className="bg-violet-500/15 border border-violet-500/25 text-violet-300 px-4 py-2 rounded-full text-sm font-semibold hover:bg-violet-500/25 transition-colors"
          >
            安装插件
          </a>
        </div>

        <button
          className="md:hidden p-2 text-white/60 hover:text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#"
            className="bg-violet-500/15 border border-violet-500/25 text-violet-300 px-4 py-2.5 rounded-full text-sm font-semibold text-center hover:bg-violet-500/25 transition-colors"
          >
            安装插件
          </a>
        </div>
      )}
    </header>
  );
}

function Footer() {
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
            <a href="/about.html" className="hover:text-white/50 transition-colors">
              关于
            </a>
            <a href="/privacy.html" className="hover:text-white/50 transition-colors">
              隐私政策
            </a>
            <a href="/support.html" className="hover:text-white/50 transition-colors">
              帮助支持
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

export default function PageLayout({ children }) {
  return (
    <div className="bg-[#0a0a0f] text-white min-h-screen">
      <Nav />
      <main className="pt-20 pb-12">{children}</main>
      <Footer />
    </div>
  );
}
