import Nav from "./Nav.jsx";
import Footer from "./Footer.jsx";

export default function PageLayout({ children }) {
  return (
    <div className="bg-[#0a0a0f] text-white min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-violet-500 focus:text-white focus:rounded-lg focus:outline-none"
      >
        跳转到主内容
      </a>
      <Nav />
      <main id="main-content" className="pt-20 pb-12">{children}</main>
      <Footer />
    </div>
  );
}
