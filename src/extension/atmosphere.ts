export type AtmosphereMode = "none" | "creative-mouse";

export interface AtmosphereConfig {
  mode?: string;
}

interface AtmosphereDiagnostics {
  log(event: string, detail: Record<string, unknown>): void;
}

export interface ContentAtmosphereRuntime {
  window: Window;
  document: Document;
  diagnostics?: AtmosphereDiagnostics;
}

export interface ContentAtmosphere {
  syncConfig(config?: AtmosphereConfig | null): void;
  destroy(): void;
}

interface MagnetTargetState {
  element: HTMLElement;
  layer: HTMLElement;
  wrapper: HTMLElement;
  cursor: string;
  position: string;
}

const INNER_SIZE = 12;
const INNER_COLOR = "#4caf50";
const OUTER_SIZE = 42;
const OUTER_COLOR = "#ffffff";
const FOLLOW_SPEED = 0.22;
const HOVER_EXPAND = 20;
const MIN_DISTANCE = 0.1;
const BLEND_MODE = "exclusion";
const TARGET_BLEND_MODE = "difference";
const MAGNET_SELECTOR = ".g-animation";
const TEXT_SELECT_WIDTH = 2;
const TEXT_SELECT_COLOR = "#333333";
const HIDE_NATIVE_CURSOR_CLASS = "cd-hide-native-cursor";

const HALF_INNER = INNER_SIZE / 2;
const HALF_OUTER = OUTER_SIZE / 2;

export function createContentAtmosphere(runtime: ContentAtmosphereRuntime): ContentAtmosphere {
  const { window, document, diagnostics } = runtime;
  const magnetTargets = new Map<HTMLElement, MagnetTargetState>();

  let mode: AtmosphereMode = "none";
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let outerX = mouseX;
  let outerY = mouseY;
  let rafId: number | null = null;
  let appearanceTimerId: number | null = null;
  let innerEl: HTMLElement | null = null;
  let outerEl: HTMLElement | null = null;
  let eventsBound = false;
  let destroyed = false;

  let isHovering = false;
  let currentTarget: HTMLElement | null = null;
  let isSelectingText = false;
  let lastTextTarget: HTMLElement | null = null;
  let textCaretHeight = 18;
  let textBaselineOffset = 2;

  function createElements(): void {
    if (innerEl && outerEl) return;

    const nextInner = document.createElement("div");
    nextInner.style.cssText = [
      "position:fixed;top:0;left:0",
      `width:${INNER_SIZE}px;height:${INNER_SIZE}px`,
      "border-radius:50%",
      `background:${INNER_COLOR}`,
      `mix-blend-mode:${BLEND_MODE}`,
      "pointer-events:none;z-index:2147483647",
      "will-change:transform,width,height",
      "backface-visibility:hidden",
      "opacity:0",
      "transition:opacity 0.2s ease,width 0.1s ease-out,height 0.1s ease-out,border-radius 0.1s ease-out,background-color 0.1s ease-out",
    ].join(";");

    const nextOuter = document.createElement("div");
    nextOuter.style.cssText = [
      "position:fixed;top:0;left:0",
      `width:${OUTER_SIZE}px;height:${OUTER_SIZE}px`,
      "border-radius:50%",
      `background:${OUTER_COLOR}`,
      `mix-blend-mode:${BLEND_MODE}`,
      "pointer-events:none;z-index:2147483647",
      "will-change:transform,width,height,border-radius",
      "backface-visibility:hidden",
      "opacity:0",
      "transition:width 0.12s cubic-bezier(0.25,0.1,0.25,1),height 0.12s cubic-bezier(0.25,0.1,0.25,1),border-radius 0.12s cubic-bezier(0.25,0.1,0.25,1),transform 0.08s linear,opacity 0.2s ease",
    ].join(";");

    document.body.append(nextInner, nextOuter);
    innerEl = nextInner;
    outerEl = nextOuter;
    document.documentElement.classList.add(HIDE_NATIVE_CURSOR_CLASS);

    appearanceTimerId = window.setTimeout(() => {
      appearanceTimerId = null;
      if (innerEl === nextInner) nextInner.style.opacity = "1";
      if (outerEl === nextOuter) nextOuter.style.opacity = "1";
    }, 100);
  }

  function removeElements(): void {
    if (appearanceTimerId !== null) {
      window.clearTimeout(appearanceTimerId);
      appearanceTimerId = null;
    }
    document.documentElement.classList.remove(HIDE_NATIVE_CURSOR_CLASS);
    innerEl?.remove();
    outerEl?.remove();
    innerEl = null;
    outerEl = null;
  }

  function attachMagnetTarget(element: HTMLElement): void {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-blend-content";
    wrapper.style.cssText = "position:relative;z-index:2";
    while (element.firstChild) wrapper.appendChild(element.firstChild);

    const layer = document.createElement("div");
    layer.className = "cm-blend-layer";
    layer.style.cssText = [
      "position:absolute",
      "inset:-10px",
      "background:#fff",
      "z-index:1",
      `mix-blend-mode:${TARGET_BLEND_MODE}`,
      "pointer-events:none",
      "border-radius:inherit",
    ].join(";");

    const state: MagnetTargetState = {
      element,
      layer,
      wrapper,
      cursor: element.style.cursor,
      position: element.style.position,
    };
    element.addEventListener("mouseover", onMagnetOver);
    element.addEventListener("mouseout", onMagnetOut);
    element.style.cursor = "none";
    if (window.getComputedStyle(element).position === "static") {
      element.style.position = "relative";
    }
    element.append(wrapper, layer);
    magnetTargets.set(element, state);
  }

  function detachMagnetTarget(state: MagnetTargetState): void {
    const { element, layer, wrapper } = state;
    element.removeEventListener("mouseover", onMagnetOver);
    element.removeEventListener("mouseout", onMagnetOut);
    element.style.cursor = state.cursor;
    element.style.position = state.position;
    layer.remove();
    while (wrapper.firstChild) {
      element.insertBefore(wrapper.firstChild, wrapper.parentElement === element ? wrapper : null);
    }
    wrapper.remove();
    magnetTargets.delete(element);
    if (currentTarget === element) {
      currentTarget = null;
      isHovering = false;
    }
  }

  function reconcileMagnetTargets(): void {
    const nextTargets = new Set(document.querySelectorAll<HTMLElement>(MAGNET_SELECTOR));
    for (const state of [...magnetTargets.values()]) {
      if (!nextTargets.has(state.element)) detachMagnetTarget(state);
    }
    for (const element of nextTargets) {
      if (!magnetTargets.has(element)) attachMagnetTarget(element);
    }
  }

  function cleanupMagnetTargets(): void {
    for (const state of [...magnetTargets.values()]) detachMagnetTarget(state);
    isHovering = false;
    currentTarget = null;
  }

  function onMagnetOver(event: MouseEvent): void {
    if (isHovering) return;
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;
    isHovering = true;
    currentTarget = target;
    if (isSelectingText) revertTextSelection();
    if (outerEl) outerEl.style.borderRadius = window.getComputedStyle(target).borderRadius;
  }

  function onMagnetOut(event: MouseEvent): void {
    const related = event.relatedTarget as Node | null;
    if (related === currentTarget || currentTarget?.contains(related)) return;
    isHovering = false;
    window.setTimeout(() => {
      if (isHovering) return;
      currentTarget = null;
      if (outerEl) {
        outerEl.style.width = `${OUTER_SIZE}px`;
        outerEl.style.height = `${OUTER_SIZE}px`;
        outerEl.style.borderRadius = "50%";
      }
    }, 50);
  }

  function isElementTextSelectable(element: HTMLElement): boolean {
    if (["INPUT", "TEXTAREA", "BUTTON", "SELECT", "IMG", "VIDEO", "AUDIO"].includes(element.tagName)) {
      return false;
    }
    if (!element.textContent?.trim()) return false;
    const style = window.getComputedStyle(element);
    if ((style.userSelect || style.webkitUserSelect) === "none") return false;
    for (const target of magnetTargets.keys()) {
      if (target === element || target.contains(element)) return false;
    }
    return true;
  }

  function findTextElement(target: EventTarget | null): HTMLElement | null {
    let element = target && "tagName" in target ? target as HTMLElement : null;
    while (element && element !== document.body) {
      if (isElementTextSelectable(element)) return element;
      element = element.parentElement;
    }
    return null;
  }

  function calculateTextMetrics(element: HTMLElement): void {
    const style = window.getComputedStyle(element);
    const fontSize = Number.parseFloat(style.fontSize) || 16;
    const lineHeight = style.lineHeight === "normal"
      ? fontSize * 1.4
      : Number.parseFloat(style.lineHeight) || fontSize * 1.4;
    textCaretHeight = fontSize * 0.9;
    textBaselineOffset = (lineHeight - textCaretHeight) / 2;
  }

  function updateTextSelection(): void {
    if (!innerEl) return;
    innerEl.style.width = `${TEXT_SELECT_WIDTH}px`;
    innerEl.style.height = `${textCaretHeight}px`;
    innerEl.style.borderRadius = "0";
    innerEl.style.backgroundColor = TEXT_SELECT_COLOR;
    innerEl.style.transform = `translate(${mouseX - TEXT_SELECT_WIDTH / 2}px, ${mouseY - textBaselineOffset}px)`;
    if (outerEl) outerEl.style.opacity = "0";
  }

  function revertTextSelection(): void {
    if (!innerEl) return;
    innerEl.style.width = `${INNER_SIZE}px`;
    innerEl.style.height = `${INNER_SIZE}px`;
    innerEl.style.borderRadius = "50%";
    innerEl.style.backgroundColor = INNER_COLOR;
    innerEl.style.transform = `translate(${mouseX - HALF_INNER}px, ${mouseY - HALF_INNER}px)`;
    if (outerEl) outerEl.style.opacity = "1";
  }

  function updateFollow(): void {
    if (!innerEl || !outerEl) return;
    innerEl.style.transform = `translate(${mouseX - HALF_INNER}px, ${mouseY - HALF_INNER}px)`;
    const targetX = mouseX - HALF_OUTER;
    const targetY = mouseY - HALF_OUTER;
    const dx = targetX - outerX;
    const dy = targetY - outerY;
    if (Math.abs(dx) <= MIN_DISTANCE && Math.abs(dy) <= MIN_DISTANCE) return;
    outerX += dx * FOLLOW_SPEED;
    outerY += dy * FOLLOW_SPEED;
    outerEl.style.transform = `translate(${outerX}px, ${outerY}px)`;
  }

  function updateHover(): void {
    if (!innerEl || !outerEl || !currentTarget) return;
    const rect = currentTarget.getBoundingClientRect();
    outerEl.style.width = `${rect.width + HOVER_EXPAND}px`;
    outerEl.style.height = `${rect.height + HOVER_EXPAND}px`;
    outerEl.style.transform = `translate(${rect.left - HOVER_EXPAND / 2}px, ${rect.top - HOVER_EXPAND / 2}px)`;
    innerEl.style.transform = `translate(${mouseX - HALF_INNER}px, ${mouseY - HALF_INNER}px)`;
  }

  function animate(): void {
    rafId = null;
    if (mode !== "creative-mouse" || document.hidden) return;
    if (isSelectingText && lastTextTarget && !isHovering) {
      updateTextSelection();
    } else if (isHovering && currentTarget) {
      if (isSelectingText) revertTextSelection();
      updateHover();
    } else {
      if (isSelectingText) revertTextSelection();
      updateFollow();
    }
    rafId = window.requestAnimationFrame(animate);
  }

  function startAnimation(): void {
    if (rafId === null && !document.hidden) rafId = window.requestAnimationFrame(animate);
  }

  function stopAnimation(): void {
    if (rafId === null) return;
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  function onMouseMove(event: MouseEvent): void {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (isHovering) return;
    const textElement = findTextElement(event.target);
    if (textElement && textElement !== lastTextTarget) {
      calculateTextMetrics(textElement);
      lastTextTarget = textElement;
    }
    isSelectingText = Boolean(textElement && (event.buttons & 1));
    if (!textElement) lastTextTarget = null;
  }

  function onMouseLeave(): void {
    isSelectingText = false;
    lastTextTarget = null;
    if (innerEl) innerEl.style.opacity = "0";
    if (outerEl) outerEl.style.opacity = "0";
  }

  function onMouseEnter(): void {
    if (innerEl) innerEl.style.opacity = "1";
    if (outerEl) outerEl.style.opacity = "1";
  }

  function onVisibilityChange(): void {
    if (document.hidden) stopAnimation();
    else if (mode === "creative-mouse") startAnimation();
  }

  function onResize(): void {
    if (isHovering) return;
    outerX = mouseX - HALF_OUTER;
    outerY = mouseY - HALF_OUTER;
  }

  function bindEvents(): void {
    if (eventsBound) return;
    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", onResize, { passive: true });
    eventsBound = true;
  }

  function unbindEvents(): void {
    if (!eventsBound) return;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseleave", onMouseLeave);
    document.removeEventListener("mouseenter", onMouseEnter);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("resize", onResize);
    eventsBound = false;
  }

  function activate(): void {
    createElements();
    reconcileMagnetTargets();
    outerX = mouseX - HALF_OUTER;
    outerY = mouseY - HALF_OUTER;
    bindEvents();
    startAnimation();
  }

  function deactivate(): void {
    stopAnimation();
    unbindEvents();
    removeElements();
    cleanupMagnetTargets();
    isSelectingText = false;
    lastTextTarget = null;
  }

  function syncConfig(config?: AtmosphereConfig | null): void {
    if (destroyed) return;
    mode = config?.mode === "creative-mouse" ? "creative-mouse" : "none";
    if (mode === "creative-mouse") activate();
    else deactivate();
    diagnostics?.log("atmosphere.sync", { mode });
  }

  function destroy(): void {
    if (destroyed) return;
    mode = "none";
    deactivate();
    destroyed = true;
  }

  return { syncConfig, destroy };
}

const runtimeGlobal = globalThis as typeof globalThis & {
  CursorDanceContentModules?: Record<string, unknown>;
};
runtimeGlobal.CursorDanceContentModules ||= {};
runtimeGlobal.CursorDanceContentModules.createAtmosphere = createContentAtmosphere;
