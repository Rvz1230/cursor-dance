// CursorDance 桌面端「氛围光标」（双圆点跟随）
//
// 从 extension/content-runtime/atmosphere.js 迁移而来（任务 2.5）。桌面裁剪：
//   - **删除元素磁吸**：scanMagnetTargets / cleanupMagnetTargets / onMagnetOver / onMagnetOut
//     与 MAGNET_SELECTOR 全部移除——overlay 跑在桌面层之上，没有 DOM 元素可吸附。
//   - **删除文本选择态**：updateTextSelection / revertTextSelection / findTextElement /
//     isElementTextSelectable / calculateTextMetrics 全部移除——overlay 也无法识别下层
//     原生应用里的文本节点。
//   - 仅保留 updateFollow + rAF 主循环；状态优先级压缩为「普通跟随」一档。
//   - mix-blend-mode 在透明 overlay 上意义有限，但代价为零，保留以与扩展端视觉对齐。
//   - 输入事件：扩展端听 document.mousemove；桌面端 overlay 同样有 DOM 鼠标事件
//     （overlay 收到 setIgnoreMouseEvents(forward=true) 之后会继续派发 mousemove）。
//     如果未来切换到「IPC 推坐标」，把 init/destroy 里的事件绑定换掉即可，主循环不动。
//
// 参考保留：syncConfig 仍按 atmosphere.mode === "creative-mouse" 启停，与扩展端
// workbenchDraft.atmosphere.mode 字段对齐，便于一份配置驱动两端。

import type { DiagnosticsModule } from "./types";

export interface AtmosphereDeps {
  window: Window;
  document: Document;
  diagnostics?: Pick<DiagnosticsModule, "log">;
}

export interface AtmosphereConfig {
  mode?: string;
}

export interface AtmosphereModule {
  syncConfig(atmosConfig: AtmosphereConfig | null | undefined): void;
  destroy(): void;
}

export function createAtmosphere(deps: AtmosphereDeps): AtmosphereModule {
  const { window, document, diagnostics } = deps;

  const INNER_SIZE = 12;
  const INNER_COLOR = "#4caf50";
  const OUTER_SIZE = 42;
  const OUTER_COLOR = "#ffffff";
  const FOLLOW_SPEED = 0.22;
  const MIN_DISTANCE = 0.1;
  const BLEND_MODE = "exclusion";

  const HALF_INNER = INNER_SIZE / 2;
  const HALF_OUTER = OUTER_SIZE / 2;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let outerX = window.innerWidth / 2;
  let outerY = window.innerHeight / 2;

  let rafId: number | null = null;
  let innerEl: HTMLDivElement | null = null;
  let outerEl: HTMLDivElement | null = null;
  let isActive = false;

  const config: AtmosphereConfig = { mode: "none" };

  function createElements(): void {
    if (innerEl && outerEl) return;

    innerEl = document.createElement("div");
    innerEl.style.cssText = [
      "position:fixed;top:0;left:0",
      "width:" + INNER_SIZE + "px;height:" + INNER_SIZE + "px",
      "border-radius:50%",
      "background:" + INNER_COLOR,
      "mix-blend-mode:" + BLEND_MODE,
      "pointer-events:none;z-index:2147483647",
      "will-change:transform,width,height",
      "backface-visibility:hidden",
      "opacity:0",
      "transition:opacity 0.2s ease,width 0.1s ease-out,height 0.1s ease-out,border-radius 0.1s ease-out,background-color 0.1s ease-out",
    ].join(";");
    document.body.appendChild(innerEl);

    outerEl = document.createElement("div");
    outerEl.style.cssText = [
      "position:fixed;top:0;left:0",
      "width:" + OUTER_SIZE + "px;height:" + OUTER_SIZE + "px",
      "border-radius:50%",
      "background:" + OUTER_COLOR,
      "mix-blend-mode:" + BLEND_MODE,
      "pointer-events:none;z-index:2147483647",
      "will-change:transform,width,height,border-radius",
      "backface-visibility:hidden",
      "opacity:0",
      "transition:width 0.12s cubic-bezier(0.25,0.1,0.25,1),height 0.12s cubic-bezier(0.25,0.1,0.25,1),border-radius 0.12s cubic-bezier(0.25,0.1,0.25,1),transform 0.08s linear,opacity 0.2s ease",
    ].join(";");
    document.body.appendChild(outerEl);

    window.setTimeout(() => {
      if (innerEl) innerEl.style.opacity = "1";
      if (outerEl) outerEl.style.opacity = "1";
    }, 100);

    document.documentElement.classList.add("cd-hide-native-cursor");
  }

  function removeElements(): void {
    document.documentElement.classList.remove("cd-hide-native-cursor");
    if (innerEl) { innerEl.remove(); innerEl = null; }
    if (outerEl) { outerEl.remove(); outerEl = null; }
  }

  function animate(): void {
    if (!innerEl || !outerEl) {
      rafId = window.requestAnimationFrame(animate);
      return;
    }
    updateFollow();
    rafId = window.requestAnimationFrame(animate);
  }

  function updateFollow(): void {
    if (!innerEl || !outerEl) return;
    innerEl.style.transform = "translate(" + (mouseX - HALF_INNER) + "px, " + (mouseY - HALF_INNER) + "px)";

    const targetX = mouseX - HALF_OUTER;
    const targetY = mouseY - HALF_OUTER;
    const dx = targetX - outerX;
    const dy = targetY - outerY;

    if (Math.abs(dx) > MIN_DISTANCE || Math.abs(dy) > MIN_DISTANCE) {
      outerX += dx * FOLLOW_SPEED;
      outerY += dy * FOLLOW_SPEED;
      outerEl.style.transform = "translate(" + outerX + "px, " + outerY + "px)";
    }
  }

  function onMouseMove(e: MouseEvent): void {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  function onMouseLeave(): void {
    if (innerEl) innerEl.style.opacity = "0";
    if (outerEl) outerEl.style.opacity = "0";
  }

  function onMouseEnter(): void {
    if (innerEl) innerEl.style.opacity = "1";
    if (outerEl) outerEl.style.opacity = "1";
  }

  function onVisibilityChange(): void {
    if (document.hidden) {
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
    } else if (config.mode === "creative-mouse" && !rafId) {
      rafId = window.requestAnimationFrame(animate);
    }
  }

  function onResize(): void {
    outerX = mouseX - HALF_OUTER;
    outerY = mouseY - HALF_OUTER;
  }

  function bindEvents(): void {
    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", onResize, { passive: true });
  }

  function unbindEvents(): void {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseleave", onMouseLeave);
    document.removeEventListener("mouseenter", onMouseEnter);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("resize", onResize);
  }

  function stop(): void {
    if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
    removeElements();
  }

  function syncConfig(atmosConfig: AtmosphereConfig | null | undefined): void {
    if (!atmosConfig) return;
    const prevMode = config.mode;
    config.mode = atmosConfig.mode || "none";

    if (config.mode === "creative-mouse") {
      createElements();
      outerX = mouseX - HALF_OUTER;
      outerY = mouseY - HALF_OUTER;
      if (!rafId) {
        rafId = window.requestAnimationFrame(animate);
      }
    } else if (prevMode === "creative-mouse") {
      stop();
    }

    diagnostics?.log("atmosphere.sync", { mode: config.mode });
  }

  function destroy(): void {
    unbindEvents();
    stop();
    isActive = false;
  }

  function init(): void {
    if (isActive) return;
    bindEvents();
    isActive = true;
  }

  init();

  return { syncConfig, destroy };
}
