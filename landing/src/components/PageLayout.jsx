import Nav from "./Nav.jsx";
import Footer from "./Footer.jsx";

export default function PageLayout({ children }) {
  return (
    <div className="bg-[#0a0a0f] text-white min-h-screen">
      <Nav />
      <main className="pt-20 pb-12">{children}</main>
      <Footer />
    </div>
  );
}
