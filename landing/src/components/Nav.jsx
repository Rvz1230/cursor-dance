import { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import InstallButton from "./InstallButton.jsx";
import { navLinks } from "../lib/scroll.js";

const isHome =
  window.location.pathname === "/" ||
  window.location.pathname === "/index.html" ||
  window.location.pathname === "";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const headerRef = useRef(null);

  const resolveHref = (href) =>
    href.startsWith("#") && !isHome ? `/${href}` : href;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // IntersectionObserver for active section highlighting
  useEffect(() => {
    const sections = navLinks
      .map((l) => l.sectionId && document.getElementById(l.sectionId))
      .filter(Boolean);
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [mobileOpen]);

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 border-b ${
        scrolled
          ? "bg-[#0a0a0f]/80 backdrop-blur-xl border-white/5"
          : "bg-transparent border-transparent"
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
              href={resolveHref(link.href)}
              className={`text-sm font-medium transition-colors ${
                activeSection === link.sectionId
                  ? "text-white/80"
                  : "text-white/45 hover:text-white/80"
              }`}
            >
              {link.label}
            </a>
          ))}
          <InstallButton />
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
              href={resolveHref(link.href)}
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              {link.label}
            </a>
          ))}
          <InstallButton variant="secondary" className="px-4 py-2.5 w-full text-center" />
        </div>
      )}
    </header>
  );
}
