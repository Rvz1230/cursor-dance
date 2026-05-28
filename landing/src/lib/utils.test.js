import { describe, it, expect } from "vitest";
import { cn } from "./utils.js";

describe("cn", () => {
  it("merges tailwind classes", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("resolves conflicting tailwind classes (last wins)", () => {
    expect(cn("px-4", "px-2")).toBe("px-2");
  });

  it("filters falsy values", () => {
    expect(cn("px-4", false, undefined, null, "py-2")).toBe("px-4 py-2");
  });

  it("works with conditional expressions", () => {
    expect(cn("base", true && "active", false && "hidden")).toBe("base active");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles string arrays via spread", () => {
    expect(cn(...["a", "b"])).toBe("a b");
  });
});
