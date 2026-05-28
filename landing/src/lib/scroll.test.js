import { describe, it, expect } from "vitest";
import { navLinks } from "./scroll.js";

describe("navLinks", () => {
  it("has 4 links", () => {
    expect(navLinks).toHaveLength(4);
  });

  it("each link has label, href, sectionId", () => {
    for (const link of navLinks) {
      expect(link).toHaveProperty("label");
      expect(link).toHaveProperty("href");
      expect(link).toHaveProperty("sectionId");
    }
  });

  it("first 3 links have sectionId for in-page navigation", () => {
    expect(navLinks[0].sectionId).toBe("features");
    expect(navLinks[1].sectionId).toBe("how-it-works");
    expect(navLinks[2].sectionId).toBe("themes");
  });

  it("about link points to about.html (external page)", () => {
    const aboutLink = navLinks.find((l) => l.label === "关于");
    expect(aboutLink.href).toBe("/about.html");
    expect(aboutLink.sectionId).toBeNull();
  });
});
