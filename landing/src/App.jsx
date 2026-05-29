import { useState } from "react";
import { ToastProvider } from "./components/Toast.jsx";
import Nav from "./components/Nav.jsx";
import Hero from "./components/Hero.jsx";
import Features from "./components/Features.jsx";
import HowItWorks from "./components/HowItWorks.jsx";
import ThemeShowcase from "./components/ThemeShowcase.jsx";
import CTA from "./components/CTA.jsx";
import Footer from "./components/Footer.jsx";
import BackToTop from "./components/BackToTop.jsx";

export default function App() {
  const [activePresetId, setActivePresetId] = useState("aurora");

  return (
    <ToastProvider>
      <div className="bg-[#0a0a0f] text-white min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-violet-500 focus:text-white focus:rounded-lg focus:outline-none"
        >
          跳转到主内容
        </a>
        <Nav />
        <main id="main-content">
          <Hero activePresetId={activePresetId} onPresetChange={setActivePresetId} />
          <Features />
          <HowItWorks />
          <ThemeShowcase onSelectPreset={setActivePresetId} />
          <CTA />
        </main>
        <Footer />
        <BackToTop />
      </div>
    </ToastProvider>
  );
}
