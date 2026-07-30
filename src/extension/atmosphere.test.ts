import { describe, expect, it, vi } from "vitest";
import { createContentAtmosphere } from "./atmosphere";

type Listener = (event: Record<string, unknown>) => void;

class FakeEventHub {
  readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) || new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, detail: Record<string, unknown> = {}): void {
    for (const listener of this.listeners.get(type) || []) listener({ type, ...detail });
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size || 0;
  }
}

class FakeClassList {
  private readonly values = new Set<string>();

  add(value: string): void {
    this.values.add(value);
  }

  remove(value: string): void {
    this.values.delete(value);
  }

  contains(value: string): boolean {
    return this.values.has(value);
  }

  replace(values: string): void {
    this.values.clear();
    for (const value of values.split(/\s+/).filter(Boolean)) this.values.add(value);
  }
}

class FakeElement extends FakeEventHub {
  readonly children: FakeElement[] = [];
  readonly classList = new FakeClassList();
  readonly style: Record<string, string> = { cursor: "", position: "" };
  parentElement: FakeElement | null = null;
  private ownText = "";

  constructor(readonly tagName: string) {
    super();
  }

  get firstChild(): FakeElement | null {
    return this.children[0] || null;
  }

  get textContent(): string {
    return this.ownText + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.ownText = value;
  }

  set className(value: string) {
    this.classList.replace(value);
  }

  append(...nodes: FakeElement[]): void {
    for (const node of nodes) this.appendChild(node);
  }

  appendChild(node: FakeElement): FakeElement {
    node.remove();
    node.parentElement = this;
    this.children.push(node);
    return node;
  }

  insertBefore(node: FakeElement, reference: FakeElement | null): FakeElement {
    node.remove();
    const index = reference ? this.children.indexOf(reference) : -1;
    node.parentElement = this;
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
    return node;
  }

  remove(): void {
    if (!this.parentElement) return;
    const index = this.parentElement.children.indexOf(this);
    if (index >= 0) this.parentElement.children.splice(index, 1);
    this.parentElement = null;
  }

  contains(node: unknown): boolean {
    return node === this || this.children.some((child) => child.contains(node));
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const className = selector.startsWith(".") ? selector.slice(1) : "";
    const matches: FakeElement[] = [];
    for (const child of this.children) {
      if (className && child.classList.contains(className)) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }

  getBoundingClientRect(): DOMRect {
    return { left: 10, top: 20, width: 100, height: 40 } as DOMRect;
  }
}

class FakeDocument extends FakeEventHub {
  readonly documentElement = new FakeElement("HTML");
  readonly body = new FakeElement("BODY");
  hidden = false;
  createCount = 0;

  constructor() {
    super();
    this.documentElement.appendChild(this.body);
  }

  createElement(tagName: string): FakeElement {
    this.createCount += 1;
    return new FakeElement(tagName.toUpperCase());
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.body.querySelectorAll(selector);
  }
}

class FakeWindow extends FakeEventHub {
  readonly innerWidth = 1280;
  readonly innerHeight = 720;
  readonly frames = new Map<number, FrameRequestCallback>();
  readonly cancelAnimationFrame = vi.fn((id: number) => this.frames.delete(id));
  private nextFrameId = 1;

  requestAnimationFrame(callback: FrameRequestCallback): number {
    const id = this.nextFrameId++;
    this.frames.set(id, callback);
    return id;
  }

  setTimeout(callback: TimerHandler, delay?: number): number {
    return globalThis.setTimeout(callback, delay) as unknown as number;
  }

  clearTimeout(id: number): void {
    globalThis.clearTimeout(id);
  }

  getComputedStyle(element: FakeElement): CSSStyleDeclaration {
    return {
      position: element.style.position || "static",
      borderRadius: element.style.borderRadius || "0px",
      userSelect: element.style.userSelect || "auto",
      webkitUserSelect: element.style.webkitUserSelect || "auto",
      fontSize: element.style.fontSize || "16px",
      lineHeight: element.style.lineHeight || "normal",
    } as CSSStyleDeclaration;
  }
}

function createFixture() {
  const document = new FakeDocument();
  const window = new FakeWindow();
  const target = document.createElement("button");
  const child = document.createElement("span");
  child.textContent = "magnetic label";
  target.className = "g-animation";
  target.style.cursor = "pointer";
  target.appendChild(child);
  document.body.appendChild(target);
  const atmosphere = createContentAtmosphere({
    document: document as unknown as Document,
    window: window as unknown as Window,
  });
  return { atmosphere, child, document, target, window };
}

describe("extension atmosphere lifecycle", () => {
  it("creates the creative mouse surface and starts animation on demand", () => {
    const { atmosphere, document, target, window } = createFixture();
    expect(document.listenerCount("mousemove")).toBe(0);

    atmosphere.syncConfig({ mode: "creative-mouse" });

    expect(document.body.children).toHaveLength(3);
    expect(document.documentElement.classList.contains("cd-hide-native-cursor")).toBe(true);
    expect(target.querySelector(".cm-blend-content")).not.toBeNull();
    expect(target.querySelector(".cm-blend-layer")).not.toBeNull();
    expect(document.listenerCount("mousemove")).toBe(1);
    expect(window.listenerCount("resize")).toBe(1);
    expect(window.frames.size).toBe(1);
  });

  it("fully restores DOM, styles, listeners and animation in none mode", () => {
    const { atmosphere, child, document, target, window } = createFixture();
    atmosphere.syncConfig({ mode: "creative-mouse" });

    atmosphere.syncConfig({ mode: "none" });

    expect(document.body.children).toEqual([target]);
    expect(target.children).toEqual([child]);
    expect(target.style.cursor).toBe("pointer");
    expect(target.style.position).toBe("");
    expect(document.documentElement.classList.contains("cd-hide-native-cursor")).toBe(false);
    expect(document.listenerCount("mousemove")).toBe(0);
    expect(window.listenerCount("resize")).toBe(0);
    expect(window.frames.size).toBe(0);
  });

  it("keeps repeated creative-mouse sync idempotent", () => {
    const { atmosphere, document, target, window } = createFixture();
    atmosphere.syncConfig({ mode: "creative-mouse" });
    const wrapper = target.querySelector(".cm-blend-content");
    const createCount = document.createCount;

    atmosphere.syncConfig({ mode: "creative-mouse" });

    expect(document.createCount).toBe(createCount);
    expect(target.querySelector(".cm-blend-content")).toBe(wrapper);
    expect(document.listenerCount("mousemove")).toBe(1);
    expect(window.listenerCount("resize")).toBe(1);
    expect(window.frames.size).toBe(1);
  });

  it("pauses and resumes animation with page visibility", () => {
    const { atmosphere, document, window } = createFixture();
    atmosphere.syncConfig({ mode: "creative-mouse" });
    const activeFrame = [...window.frames.keys()][0];

    document.hidden = true;
    document.dispatch("visibilitychange");
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(activeFrame);
    expect(window.frames.size).toBe(0);

    document.hidden = false;
    document.dispatch("visibilitychange");
    expect(window.frames.size).toBe(1);
  });
});
