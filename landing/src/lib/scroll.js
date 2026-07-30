export const navLinks = [
  { label: "功能", href: "#features", sectionId: "features" },
  { label: "上手", href: "#how-it-works", sectionId: "how-it-works" },
  { label: "主题", href: "#themes", sectionId: "themes" },
  { label: "关于", href: "/about.html", sectionId: null },
];

function scrollToDemo() {
  const el = document.querySelector(".cursor-crosshair");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}
