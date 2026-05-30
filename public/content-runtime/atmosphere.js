/**
 * Creative Mouse — 双圆点光标 + 元素磁吸 + 文本选择自适应插入符号
 *
 * 对照 creative-mouse.js 完整复刻，适配 CursorDance 运行时。
 * 状态优先级：文本选择 > 磁性吸附 > 普通跟随
 */
(function registerContentAtmosphere(globalThis) {
  var modules = globalThis.CursorDanceContentModules || (globalThis.CursorDanceContentModules = {});

  modules.createAtmosphere = function createAtmosphere(runtime) {
    var window = runtime.window;
    var document = runtime.document;
    var diagnostics = runtime.diagnostics;

    // ============================================================
    //  常量 / 预设参数
    // ============================================================

    var INNER_SIZE = 12;
    var INNER_COLOR = "#4caf50";
    var OUTER_SIZE = 42;
    var OUTER_COLOR = "#ffffff";
    var FOLLOW_SPEED = 0.22;
    var HOVER_EXPAND = 20;
    var MIN_DISTANCE = 0.1;
    var BLEND_MODE = "exclusion";
    var TARGET_BLEND_MODE = "difference";
    var MAGNET_SELECTOR = ".g-animation";

    var TEXT_SELECT_WIDTH = 2;
    var TEXT_SELECT_COLOR = "#333333";

    var HALF_INNER = INNER_SIZE / 2;
    var HALF_OUTER = OUTER_SIZE / 2;

    // ============================================================
    //  状态 — 优先级：文本选择 > 磁吸 > 普通
    // ============================================================

    var mouseX = window.innerWidth / 2;
    var mouseY = window.innerHeight / 2;
    var outerX = window.innerWidth / 2;
    var outerY = window.innerHeight / 2;

    var rafId = null;
    var innerEl = null;
    var outerEl = null;
    var isActive = false;

    // -- 磁吸态 --
    var isHovering = false;
    var currentTarget = null;
    var magnetTargets = [];

    // -- 文本选择态 --
    var isSelectingText = false;
    var lastTextTarget = null;
    var textCaretHeight = 18;
    var textBaselineOffset = 2;

    var config = { mode: "none" };

    // ============================================================
    //  DOM 元素
    // ============================================================

    function createElements() {
      if (innerEl && outerEl) return;
      var root = document.getElementById("cursordance-root");
      if (!root) return;

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
      root.appendChild(innerEl);

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
      root.appendChild(outerEl);

      setTimeout(function () {
        if (innerEl) innerEl.style.opacity = "1";
        if (outerEl) outerEl.style.opacity = "1";
      }, 100);

      document.documentElement.classList.add("cd-hide-native-cursor");
    }

    function removeElements() {
      document.documentElement.classList.remove("cd-hide-native-cursor");
      if (innerEl) { innerEl.remove(); innerEl = null; }
      if (outerEl) { outerEl.remove(); outerEl = null; }
    }

    // ============================================================
    //  元素磁吸
    // ============================================================

    function scanMagnetTargets() {
      cleanupMagnetTargets();
      try {
        var elements = document.querySelectorAll(MAGNET_SELECTOR);
        for (var i = 0; i < elements.length; i++) {
          var el = elements[i];
          el.addEventListener("mouseover", onMagnetOver);
          el.addEventListener("mouseout", onMagnetOut);
          el.style.cursor = "none";
          if (window.getComputedStyle(el).position === "static") {
            el.style.position = "relative";
          }

          if (!el.querySelector(".cm-blend-layer")) {
            var layer = document.createElement("div");
            layer.className = "cm-blend-layer";
            layer.style.cssText = [
              "position:absolute",
              "inset:-10px",
              "background:#fff",
              "z-index:1",
              "mix-blend-mode:" + TARGET_BLEND_MODE,
              "pointer-events:none",
              "border-radius:inherit",
            ].join(";");

            var wrapper = document.createElement("div");
            wrapper.className = "cm-blend-content";
            wrapper.style.cssText = "position:relative;z-index:2";
            while (el.firstChild) wrapper.appendChild(el.firstChild);
            el.appendChild(wrapper);
            el.appendChild(layer);
          }

          magnetTargets.push(el);
        }
      } catch (e) {}
    }

    function cleanupMagnetTargets() {
      for (var i = 0; i < magnetTargets.length; i++) {
        var el = magnetTargets[i];
        el.removeEventListener("mouseover", onMagnetOver);
        el.removeEventListener("mouseout", onMagnetOut);
        el.style.cursor = "";
        el.style.position = "";
        var layer = el.querySelector(".cm-blend-layer");
        if (layer) layer.remove();
        var wrapper = el.querySelector(".cm-blend-content");
        if (wrapper) {
          while (wrapper.firstChild) el.insertBefore(wrapper.firstChild, null);
          wrapper.remove();
        }
      }
      magnetTargets = [];
      isHovering = false;
      currentTarget = null;
    }

    function onMagnetOver(e) {
      if (isHovering) return;
      isHovering = true;
      currentTarget = e.currentTarget;
      // 磁吸激活时退出文本选择态
      if (isSelectingText) revertTextSelection();
      if (outerEl) {
        var br = window.getComputedStyle(currentTarget).borderRadius;
        outerEl.style.borderRadius = br;
      }
    }

    function onMagnetOut(e) {
      var related = e.relatedTarget;
      if (related === currentTarget || (currentTarget && currentTarget.contains && currentTarget.contains(related))) return;
      isHovering = false;
      setTimeout(function () {
        if (!isHovering) {
          currentTarget = null;
          if (outerEl) {
            outerEl.style.width = OUTER_SIZE + "px";
            outerEl.style.height = OUTER_SIZE + "px";
            outerEl.style.borderRadius = "50%";
          }
        }
      }, 50);
    }

    // ============================================================
    //  文本选择检测
    // ============================================================

    /** 判断元素是否为可选择文本 */
    function isElementTextSelectable(el) {
      var tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "SELECT" || tag === "IMG" || tag === "VIDEO" || tag === "AUDIO") return false;
      if (!el.textContent || !el.textContent.trim().length) return false;
      var style = window.getComputedStyle(el);
      var userSelect = style.userSelect || style.webkitUserSelect;
      if (userSelect === "none") return false;
      // 排除磁吸目标及其子元素
      for (var i = 0; i < magnetTargets.length; i++) {
        if (magnetTargets[i] === el || magnetTargets[i].contains(el)) return false;
      }
      return true;
    }

    /** 向上遍历 DOM 找到最近的可选文本元素 */
    function findTextElement(target) {
      var el = target;
      while (el && el !== document.body) {
        if (isElementTextSelectable(el)) return el;
        el = el.parentElement;
      }
      return null;
    }

    /** 计算文本 metrics：插入符号高度 & 基线偏移 */
    function calculateTextMetrics(el) {
      var style = window.getComputedStyle(el);
      var fontSize = parseFloat(style.fontSize) || 16;
      var lh = style.lineHeight === "normal" ? fontSize * 1.4 : parseFloat(style.lineHeight) || fontSize * 1.4;
      var caretH = fontSize * 0.9;
      return { caretHeight: caretH, baselineOffset: (lh - caretH) / 2 };
    }

    // ============================================================
    //  动画循环 — 状态优先级：文本选择 > 磁吸 > 普通
    // ============================================================

    function animate() {
      if (!innerEl || !outerEl) {
        rafId = window.requestAnimationFrame(animate);
        return;
      }

      // 优先级 1：文本选择态（仅在非磁吸时激活）
      if (isSelectingText && lastTextTarget && !isHovering) {
        updateTextSelection();
      // 优先级 2：磁吸附态
      } else if (isHovering && currentTarget) {
        if (isSelectingText) revertTextSelection();
        updateHover();
      // 优先级 3：普通跟随态
      } else {
        if (isSelectingText) revertTextSelection();
        updateFollow();
      }

      rafId = window.requestAnimationFrame(animate);
    }

    /** 文本选择态：内圆 → 插入符号，外圆隐藏 */
    function updateTextSelection() {
      innerEl.style.width = TEXT_SELECT_WIDTH + "px";
      innerEl.style.height = textCaretHeight + "px";
      innerEl.style.borderRadius = "0";
      innerEl.style.backgroundColor = TEXT_SELECT_COLOR;
      innerEl.style.transform = "translate(" + (mouseX - TEXT_SELECT_WIDTH / 2) + "px, " + (mouseY - textBaselineOffset) + "px)";

      if (outerEl) outerEl.style.opacity = "0";
    }

    /** 从文本选择态恢复双圆点 */
    function revertTextSelection() {
      if (!innerEl) return;
      innerEl.style.width = INNER_SIZE + "px";
      innerEl.style.height = INNER_SIZE + "px";
      innerEl.style.borderRadius = "50%";
      innerEl.style.backgroundColor = INNER_COLOR;
      innerEl.style.transform = "translate(" + (mouseX - HALF_INNER) + "px, " + (mouseY - HALF_INNER) + "px)";
      if (outerEl) outerEl.style.opacity = "1";
    }

    /** 普通跟随态 */
    function updateFollow() {
      innerEl.style.transform = "translate(" + (mouseX - HALF_INNER) + "px, " + (mouseY - HALF_INNER) + "px)";

      var targetX = mouseX - HALF_OUTER;
      var targetY = mouseY - HALF_OUTER;
      var dx = targetX - outerX;
      var dy = targetY - outerY;

      if (Math.abs(dx) > MIN_DISTANCE || Math.abs(dy) > MIN_DISTANCE) {
        outerX += dx * FOLLOW_SPEED;
        outerY += dy * FOLLOW_SPEED;
        outerEl.style.transform = "translate(" + outerX + "px, " + outerY + "px)";
      }
    }

    /** 磁吸附态 */
    function updateHover() {
      var rect = currentTarget.getBoundingClientRect();
      var tx = rect.left - HOVER_EXPAND / 2;
      var ty = rect.top - HOVER_EXPAND / 2;
      var tw = rect.width + HOVER_EXPAND;
      var th = rect.height + HOVER_EXPAND;

      outerEl.style.width = tw + "px";
      outerEl.style.height = th + "px";
      outerEl.style.transform = "translate(" + tx + "px, " + ty + "px)";

      innerEl.style.transform = "translate(" + (mouseX - HALF_INNER) + "px, " + (mouseY - HALF_INNER) + "px)";
    }

    // ============================================================
    //  事件
    // ============================================================

    function onMouseMove(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;

      // 非磁吸态下检测文本
      if (!isHovering) {
        var textEl = findTextElement(e.target);
        if (textEl && textEl !== lastTextTarget) {
          var m = calculateTextMetrics(textEl);
          textCaretHeight = m.caretHeight;
          textBaselineOffset = m.baselineOffset;
          lastTextTarget = textEl;
          isSelectingText = true;
        } else if (!textEl) {
          isSelectingText = false;
          lastTextTarget = null;
        }
      }
    }

    function onMouseLeave() {
      isSelectingText = false;
      lastTextTarget = null;
      if (innerEl) innerEl.style.opacity = "0";
      if (outerEl) outerEl.style.opacity = "0";
    }

    function onMouseEnter() {
      if (innerEl) innerEl.style.opacity = "1";
      if (outerEl) outerEl.style.opacity = "1";
    }

    function onVisibilityChange() {
      if (document.hidden) {
        if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
      } else {
        if (config.mode === "creative-mouse" && !rafId) {
          rafId = window.requestAnimationFrame(animate);
        }
      }
    }

    function onResize() {
      if (!isHovering) {
        outerX = mouseX - HALF_OUTER;
        outerY = mouseY - HALF_OUTER;
      }
    }

    function bindEvents() {
      document.addEventListener("mousemove", onMouseMove, { passive: true });
      document.addEventListener("mouseleave", onMouseLeave);
      document.addEventListener("mouseenter", onMouseEnter);
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("resize", onResize, { passive: true });
    }

    function unbindEvents() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onResize);
    }

    // ============================================================
    //  配置同步 / 生命周期
    // ============================================================

    function syncConfig(atmosConfig) {
      if (!atmosConfig) return;
      var prevMode = config.mode;
      config.mode = atmosConfig.mode || "none";

      if (config.mode === "creative-mouse") {
        createElements();
        scanMagnetTargets();
        outerX = mouseX - HALF_OUTER;
        outerY = mouseY - HALF_OUTER;
        if (!rafId) {
          rafId = window.requestAnimationFrame(animate);
        }
      } else if (prevMode === "creative-mouse") {
        stop();
      }

      diagnostics && diagnostics.log("atmosphere.sync", { mode: config.mode });
    }

    function stop() {
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
      removeElements();
      cleanupMagnetTargets();
      isSelectingText = false;
      lastTextTarget = null;
    }

    function destroy() {
      unbindEvents();
      stop();
      isActive = false;
    }

    function init() {
      if (isActive) return;
      bindEvents();
      isActive = true;
    }

    init();

    return {
      syncConfig: syncConfig,
      destroy: destroy,
    };
  };
})(window);