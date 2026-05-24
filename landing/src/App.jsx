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
        <Nav />
        <main>
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
