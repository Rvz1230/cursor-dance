(function registerContentVisualEffects(globalThis) {
  const modules = globalThis.CursorDanceContentModules || (globalThis.CursorDanceContentModules = {});

  modules.createVisualEffects = function createVisualEffects(runtime) {
    const {
      window,
      document,
      constants,
      state,
      configStore,
    } = runtime;
    var helpers = globalThis.CursorDanceConfigHelpers || {};

    var hexToRgba = helpers.hexToRgba || function (hex, alpha) {
      var normalized = (hex || "#f59e0b").replace("#", "");
      var value = normalized.length === 3
        ? normalized.split("").map(function (item) { return item + item; }).join("")
        : normalized;
      var int = Number.parseInt(value, 16);
      return "rgba(" + (int >> 16 & 255) + ", " + (int >> 8 & 255) + ", " + (int & 255) + ", " + alpha + ")";
    };
    var getAnimationEasing = helpers.getAnimationEasing || function (label) {
      if (label === "线性") return "linear";
      if (label === "缓入") return "cubic-bezier(0.4, 0, 1, 1)";
      if (label === "缓入缓出") return "cubic-bezier(0.4, 0, 0.2, 1)";
      if (label === "弹跳") return "cubic-bezier(0.34, 1.56, 0.64, 1)";
      if (label === "弹性") return "cubic-bezier(0.22, 1, 0.36, 1.18)";
      return "cubic-bezier(0, 0, 0.2, 1)";
    };
    var getTextWeightValue = helpers.getTextWeightValue || function (label) {
      if (label === "加粗") return 700;
      if (label === "中等") return 600;
      return 500;
    };
    var TEXT_FONT_FAMILY_VALUES = helpers.TEXT_FONT_FAMILY_VALUES || {
      "系统默认": '"SF Pro Text","PingFang SC","Microsoft YaHei",system-ui,sans-serif',
      "苹方 / 微软雅黑": '"PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif',
      "宋体": 'SimSun,"Songti SC",serif',
      "黑体": 'SimHei,"Heiti SC",sans-serif',
      "楷体": 'KaiTi,"Kaiti SC",serif',
      "等宽字体": '"SFMono-Regular",Consolas,"Liberation Mono",monospace',
    };
    var getTextFontFamily = helpers.getTextFontFamily || function (value) {
      var textFontFamily = typeof value === "string" ? value.trim() : "";
      if (!textFontFamily || textFontFamily === "自定义") return TEXT_FONT_FAMILY_VALUES["系统默认"];
      if (TEXT_FONT_FAMILY_VALUES[textFontFamily]) return TEXT_FONT_FAMILY_VALUES[textFontFamily];
      return textFontFamily.replace(/[;\n\r]/g, "").slice(0, 120) || TEXT_FONT_FAMILY_VALUES["系统默认"];
    };
    var formatNumber = helpers.formatNumber || function (style, number) {
      if (style && style.includes("中文")) {
        var values = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
        return values[(number - 1) % values.length];
      }
      if (style && style.includes("英文")) {
        var values = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
        return values[(number - 1) % values.length];
      }
      return String(number);
    };
    // Computation helpers from config-runtime/compute-specs.js (loaded before this file)
    var computeParticleSpecs = helpers.computeParticleSpecs || function () { return []; };
    var computeOrbitalParticleSpecs = helpers.computeOrbitalParticleSpecs || function () { return []; };
    var computeRippleLayers = helpers.computeRippleLayers || function () { return []; };
    var getParticleShapeStyle = helpers.getParticleShapeStyle || function () {
      return { width: 0, height: 0, borderRadius: "0", rotation: 0, boxShadow: "none" };
    };
    var getAnimationVisualStyle = helpers.getAnimationVisualStyle || function () {
      return { borderRadius: "0", background: "transparent" };
    };
    var getTextContent = helpers.getTextContent || function () { return ""; };

    var getTextWeight = function (config) {
      return getTextWeightValue((config && config.textWeight) || "常规");
    };

    function getActionText(actionConfig, actionId, runIndex) {
      return getTextContent(actionConfig, runIndex, actionId);
    }

    function ensureStyles() {
      if (document.getElementById(constants.STYLE_ID)) return;

      const style = document.createElement("style");
      style.id = constants.STYLE_ID;
      style.textContent = `
        #${constants.ROOT_ID} {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 2147483647;
          overflow: hidden;
          contain: layout style paint;
        }
        .cd-effect {
          position: fixed;
          pointer-events: none;
          box-sizing: border-box;
          transform: translate3d(-50%, -50%, 0);
          will-change: transform, opacity;
        }
        .cd-text {
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          white-space: nowrap;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
        }
        .cd-ripple {
          border-radius: 999px;
        }
        .cd-particle {
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
        }
        .cd-animation-effect,
        .cd-animation-effect::before,
        .cd-animation-effect::after {
          box-sizing: border-box;
        }
        .cd-image-effect img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          user-select: none;
          -webkit-user-drag: none;
          filter: drop-shadow(0 12px 24px rgba(15, 23, 42, 0.16));
        }
        .cd-cursor {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.72);
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);
          color: #fff;
          font: 700 13px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: 0.04em;
          backdrop-filter: blur(6px);
        }
        html.${constants.HIDE_CURSOR_CLASS},
        html.${constants.HIDE_CURSOR_CLASS} * {
          cursor: none !important;
        }
        .cd-state-cursor {
          position: fixed;
          top: 0;
          left: 0;
          pointer-events: none;
          will-change: transform;
        }
        .cd-state-cursor img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          user-select: none;
          -webkit-user-drag: none;
        }
      `;
      document.head.append(style);
    }

    function ensureRoot() {
      let root = document.getElementById(constants.ROOT_ID);
      if (!root) {
        ensureStyles();
        root = document.createElement("div");
        root.id = constants.ROOT_ID;
        document.documentElement.append(root);
      }
      return root;
    }

    function animateNode(node, keyframes, options) {
      if (state.activeEffects >= configStore.getMaxActiveEffects()) return;

      const animationOptions = typeof options === "number"
        ? { duration: options, easing: "ease-out", delay: 0 }
        : {
            duration: options?.duration || 0,
            easing: options?.easing || "ease-out",
            delay: options?.delay || 0,
          };

      state.activeEffects += 1;
      ensureRoot().append(node);
      const animation = node.animate(keyframes, {
        duration: animationOptions.duration,
        easing: animationOptions.easing,
        delay: animationOptions.delay,
        fill: "forwards",
      });

      const cleanup = () => {
        node.remove();
        state.activeEffects = Math.max(0, state.activeEffects - 1);
      };

      animation.addEventListener("finish", cleanup, { once: true });
      animation.addEventListener("cancel", cleanup, { once: true });
    }

    function getCursorOverrideKind(cursorOverride) {
      if (cursorOverride === "木鱼（增强态）") return "boost";
      if (cursorOverride === "木鱼（按压态）") return "press";
      if (cursorOverride === "木鱼（继承默认）") return "woodfish";
      if (cursorOverride === "切换到 pointer") return "pointer";
      return null;
    }

    function hasCursorOverride(actionConfig) {
      const cursorFeedbackConfig = configStore.getActionCursorFeedbackConfig(actionConfig);
      return Boolean(getCursorOverrideKind(cursorFeedbackConfig.cursorOverride));
    }

    function renderCursorOverride(x, y, actionConfig) {
      const cursorFeedbackConfig = configStore.getActionCursorFeedbackConfig(actionConfig);
      const cursorKind = getCursorOverrideKind(cursorFeedbackConfig.cursorOverride);
      if (!cursorKind) return;

      if (cursorKind === "pointer") {
        const target = document.body;
        const previousCursor = target.style.cursor;
        target.style.cursor = "pointer";
        window.setTimeout(() => {
          target.style.cursor = previousCursor;
        }, 360);
        return;
      }

      const node = document.createElement("div");
      node.className = "cd-effect cd-cursor";
      const size = cursorFeedbackConfig.cursorSize || 48;
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.style.width = `${size}px`;
      node.style.height = `${size}px`;

      if (cursorKind === "boost") {
        node.style.background = "radial-gradient(circle at 35% 35%, rgba(253,224,71,0.95), rgba(180,83,9,0.94))";
        node.textContent = "击";
      } else if (cursorKind === "press") {
        node.style.background = "radial-gradient(circle at 35% 35%, rgba(251,191,36,0.92), rgba(146,64,14,0.96))";
        node.textContent = "压";
        node.style.borderRadius = "38% 38% 58% 58% / 42% 42% 56% 56%";
      } else {
        node.style.background = "radial-gradient(circle at 35% 35%, rgba(252,211,77,0.94), rgba(180,83,9,0.92))";
        node.textContent = "咚";
      }

      const shake = Math.max(0, cursorFeedbackConfig.shake || 0) / 100;
      const driftX = (shake * 18) || 4;
      const driftY = Math.max(8, shake * 26);
      animateNode(
        node,
        [
          { opacity: 0, transform: "translate3d(-50%, -50%, 0) scale(0.86)" },
          { opacity: 1, transform: `translate3d(calc(-50% + ${driftX * 0.18}px), calc(-50% + ${driftY * 0.08}px), 0) scale(1)` },
          { opacity: 0, transform: `translate3d(calc(-50% + ${driftX}px), calc(-50% + ${driftY}px), 0) scale(0.9)` },
        ],
        { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    }

    function renderText(x, y, actionConfig, actionId, runIndex) {
      const textConfig = configStore.getActionTextConfig(actionConfig);
      if (!textConfig.textEnabled) return;

      const content = getActionText(actionConfig, actionId, runIndex);
      if (!content) return;

      const node = document.createElement("div");
      node.className = "cd-effect cd-text";
      node.textContent = content;
      node.style.left = `${x + (textConfig.textOffsetX || 0)}px`;
      node.style.top = `${y + (textConfig.textOffsetY || -48)}px`;
      node.style.color = hexToRgba(textConfig.textColor || "#ec4899", (textConfig.textOpacity || 100) / 100);
      node.style.fontFamily = getTextFontFamily(textConfig.textFontFamily);
      node.style.fontSize = `${textConfig.fontSize || 22}px`;
      node.style.fontWeight = String(getTextWeight(textConfig));
      node.style.webkitTextStroke = textConfig.textOutlineWidth
        ? `${textConfig.textOutlineWidth}px ${hexToRgba("#ffffff", 0.82)}`
        : "";
      node.style.textShadow = textConfig.textShadow === "清晰"
        ? `0 8px 18px ${hexToRgba(textConfig.textColor || "#ec4899", 0.32)}`
        : textConfig.textShadow === "柔和"
          ? `0 4px 12px ${hexToRgba(textConfig.textColor || "#ec4899", 0.22)}`
          : "none";

      animateNode(
        node,
        [
          { opacity: 0, transform: "translate3d(-50%, -32%, 0) scale(0.92)" },
          { opacity: 1, transform: "translate3d(-50%, -50%, 0) scale(1)" },
          { opacity: 0, transform: "translate3d(-50%, -96%, 0) scale(1.02)" },
        ],
        {
          duration: textConfig.textDuration || 950,
          easing: getAnimationEasing(textConfig.textEasing),
        }
      );
    }

    function renderRipple(x, y, actionConfig) {
      const rippleConfig = configStore.getActionRippleConfig(actionConfig);
      if (!rippleConfig.ripple) return;

      const easing = getAnimationEasing(rippleConfig.rippleEasing);
      const lineWidth = rippleConfig.rippleLineWidth || 2;
      const duration = rippleConfig.rippleDuration || 820;
      const rippleColor = rippleConfig.rippleColor || "#34D399";

      var layers = computeRippleLayers(actionConfig);
      if (!layers || !layers.length) return;

      for (var li = 0; li < layers.length; li++) {
        var layer = layers[li];
        var node = document.createElement("div");
        node.className = "cd-effect cd-ripple";
        node.style.left = x + "px";
        node.style.top = y + "px";
        node.style.width = layer.size + "px";
        node.style.height = layer.size + "px";
        node.style.borderRadius = "999px";
        node.style.border = layer.filled ? "none" : lineWidth + "px solid " + hexToRgba(rippleColor, layer.opacity);
        if (layer.filled) {
          node.style.background = "radial-gradient(circle, " + hexToRgba(rippleColor, layer.opacity * 0.34) + " 0%, " + hexToRgba(rippleColor, layer.opacity * 0.16) + " 56%, " + hexToRgba(rippleColor, 0) + " 100%)";
          node.style.boxShadow = "0 0 0 1px " + hexToRgba(rippleColor, layer.opacity * 0.22) + " inset";
        }

        animateNode(
          node,
          [
            { opacity: layer.filled ? layer.opacity * 0.84 : layer.opacity * 0.46, transform: "translate3d(-50%, -50%, 0) scale(" + layer.scaleFrom + ")" },
            { opacity: layer.filled ? layer.opacity * 0.42 : layer.opacity * 0.22, transform: "translate3d(-50%, -50%, 0) scale(" + layer.scaleMid + ")" },
            { opacity: 0, transform: "translate3d(-50%, -50%, 0) scale(" + layer.scaleTo + ")" },
          ],
          {
            duration: duration,
            delay: layer.delay,
            easing: easing,
          }
        );
      }
    }

    function renderAnimationEffect(x, y, actionConfig) {
      const animationConfig = configStore.getActionAnimationConfig(actionConfig);
      if (!animationConfig.animationEnabled) return;

      const node = document.createElement("div");
      const scale = Math.max(0.6, (animationConfig.animationScale || 100) / 100);
      const opacity = Math.max(0.18, (animationConfig.animationOpacity || 100) / 100);
      const style = animationConfig.animationStyle || "聚焦脉冲";
      const duration = animationConfig.animationDuration || 720;
      const size = Math.round(56 * scale);
      const animColor = animationConfig.animationColor || "#34D399";
      const glow = animationConfig.animationGlow ? `0 0 18px ${hexToRgba(animColor, 0.24)}` : "";

      node.className = "cd-effect cd-animation-effect";
      node.style.left = `${x + (animationConfig.animationOffsetX || 0)}px`;
      node.style.top = `${y + (animationConfig.animationOffsetY || -10)}px`;
      node.style.width = `${size}px`;
      node.style.height = `${size}px`;

      // Apply visual style from shared computation
      var visStyle = getAnimationVisualStyle(actionConfig);
      node.style.borderRadius = visStyle.borderRadius || "";
      node.style.background = visStyle.background || "";
      if (visStyle.clipPath) node.style.clipPath = visStyle.clipPath;
      if (visStyle.boxShadow) node.style.boxShadow = visStyle.boxShadow;
      if (visStyle.border) node.style.border = visStyle.border;

      let keyframes;
      if (style === "斜切闪片") {
        keyframes = [
          { opacity: 0, transform: "translate3d(-50%, -40%, 0) scale(0.68) rotate(-18deg)" },
          { opacity, transform: "translate3d(-50%, -50%, 0) scale(1) rotate(-6deg)" },
          { opacity: 0, transform: "translate3d(calc(-50% + 18px), calc(-50% - 18px), 0) scale(1.08) rotate(12deg)" },
        ];
      } else if (style === "弹跳徽记") {
        keyframes = [
          { opacity: 0, transform: "translate3d(-50%, -24%, 0) scale(0.52)" },
          { opacity, transform: "translate3d(-50%, -50%, 0) scale(1.04)" },
          { opacity: 0, transform: "translate3d(-50%, -92%, 0) scale(0.88)" },
        ];
      } else if (style === "漩涡旋转") {
        keyframes = [
          { opacity: 0, transform: "translate3d(-50%, -50%, 0) scale(0.38) rotate(0deg)" },
          { opacity, transform: "translate3d(-50%, -50%, 0) scale(1) rotate(180deg)" },
          { opacity: 0, transform: "translate3d(-50%, -80%, 0) scale(0.62) rotate(360deg)" },
        ];
      } else if (style === "星光闪耀") {
        keyframes = [
          { opacity: 0, transform: "translate3d(-50%, -44%, 0) scale(0.32)" },
          { opacity: Math.min(1, opacity * 1.2), transform: "translate3d(-50%, -50%, 0) scale(1.12)" },
          { opacity: 0, transform: "translate3d(-50%, -94%, 0) scale(0.48)" },
        ];
      } else if (style === "轨道环绕") {
        keyframes = [
          { opacity: 0, transform: "translate3d(-50%, -50%, 0) scale(0.28) rotate(0deg)" },
          { opacity, transform: "translate3d(-50%, -50%, 0) scale(1.06) rotate(270deg)" },
          { opacity: 0, transform: "translate3d(-50%, -84%, 0) scale(0.68) rotate(540deg)" },
        ];
      } else if (style === "螺旋上升") {
        keyframes = [
          { opacity: 0, transform: "translate3d(-50%, -38%, 0) scale(0.44) rotate(-20deg)" },
          { opacity, transform: "translate3d(-50%, -50%, 0) scale(1) rotate(8deg)" },
          { opacity: 0, transform: "translate3d(calc(-50% + 10px), calc(-50% - 86%), 0) scale(0.72) rotate(36deg)" },
        ];
      } else {
        keyframes = [
          { opacity: 0, transform: "translate3d(-50%, -50%, 0) scale(0.42)" },
          { opacity, transform: "translate3d(-50%, -50%, 0) scale(0.92)" },
          { opacity: 0, transform: "translate3d(-50%, -50%, 0) scale(1.48)" },
        ];
      }

      animateNode(node, keyframes, {
        duration,
        easing: getAnimationEasing(animationConfig.animationEasing),
      });
    }

    function renderImageEffect(x, y, actionConfig) {
      const imageConfig = configStore.getActionImageConfig(actionConfig);
      if (!imageConfig.imageEnabled || !imageConfig.imageDataUrl) return;

      const node = document.createElement("div");
      node.className = "cd-effect cd-image-effect";
      node.style.left = `${x + (imageConfig.imageOffsetX || 0)}px`;
      node.style.top = `${y + (imageConfig.imageOffsetY || -18)}px`;
      node.style.width = `${imageConfig.imageSize || 56}px`;
      node.style.height = `${imageConfig.imageSize || 56}px`;
      node.style.opacity = String(Math.max(0.2, (imageConfig.imageOpacity || 100) / 100));

      const image = document.createElement("img");
      image.src = imageConfig.imageDataUrl;
      image.alt = "";
      node.append(image);

      animateNode(
        node,
        [
          { opacity: 0, transform: "translate3d(-50%, -30%, 0) scale(0.72) rotate(-8deg)" },
          { opacity: Math.max(0.2, (imageConfig.imageOpacity || 100) / 100), transform: "translate3d(-50%, -50%, 0) scale(1) rotate(0deg)" },
          { opacity: 0, transform: "translate3d(-50%, -92%, 0) scale(1.06) rotate(4deg)" },
        ],
        {
          duration: imageConfig.imageDuration || 780,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        }
      );
    }

    function renderParticles(x, y, actionConfig, runIndex) {
      const particleConfig = configStore.getActionParticleConfig(actionConfig);
      if (!particleConfig.particle) return;

      const count = Math.min(particleConfig.particleCount || 0, 40);
      if (!count) return;

      const hasTrail = particleConfig.particleTrail;

      var specs = computeParticleSpecs(actionConfig, runIndex);
      if (!specs || !specs.length) return;

      for (var index = 0; index < specs.length; index++) {
        var spec = specs[index];
        var rotation = 0;
        var shapeStyle = getParticleShapeStyle(actionConfig, index, spec.size);
        if (shapeStyle) rotation = shapeStyle.rotation || 0;

        var node = document.createElement("span");
        node.className = "cd-effect cd-particle";
        node.style.left = x + "px";
        node.style.top = y + "px";
        if (shapeStyle) {
          node.style.width = shapeStyle.width + "px";
          node.style.height = shapeStyle.height + "px";
          node.style.borderRadius = shapeStyle.borderRadius || "";
          if (shapeStyle.clipPath) node.style.clipPath = shapeStyle.clipPath;
          if (shapeStyle.boxShadow) node.style.boxShadow = shapeStyle.boxShadow;
        }

        var particleStyle = particleConfig.particleStyle || "点状粒子";
        var midTransform = "translate3d(calc(-50% + " + spec.midX + "px), calc(-50% + " + spec.midY + "px), 0) rotate(" + rotation + "deg)";
        var endTransform = "translate3d(calc(-50% + " + spec.x + "px), calc(-50% + " + spec.y + "px), 0) rotate(" + rotation + "deg)";

        animateNode(
          node,
          [
            { opacity: 0, transform: "translate3d(-50%, -50%, 0) rotate(" + rotation + "deg) scale(0.5)" },
            { opacity: 0.9, transform: midTransform + " scale(1)" },
            { opacity: 0, transform: endTransform + " scale(" + spec.endScale + ")" },
          ],
          {
            duration: particleConfig.particleDuration || 760,
            easing: particleStyle === "火花" || particleStyle === "星光"
              ? "cubic-bezier(0.22, 1, 0.36, 1)"
              : particleStyle === "碎屑粒子"
                ? "cubic-bezier(0.34, 1.56, 0.64, 1)"
                : "ease-out",
            delay: spec.delay,
          }
        );

        if (hasTrail && index % 3 === 0) {
          for (var t = 1; t <= 2; t++) {
            var trailNode = document.createElement("span");
            trailNode.className = "cd-effect cd-particle";
            trailNode.style.left = x + "px";
            trailNode.style.top = y + "px";
            var trailSize = spec.size * (1 - t * 0.32);
            var trailShapeStyle = getParticleShapeStyle(actionConfig, index + t, trailSize);
            if (trailShapeStyle) {
              trailNode.style.width = trailShapeStyle.width + "px";
              trailNode.style.height = trailShapeStyle.height + "px";
              trailNode.style.borderRadius = trailShapeStyle.borderRadius || "";
              if (trailShapeStyle.clipPath) trailNode.style.clipPath = trailShapeStyle.clipPath;
              if (trailShapeStyle.boxShadow) trailNode.style.boxShadow = trailShapeStyle.boxShadow;
            }
            var trailTx = spec.x * 0.24;
            var trailTy = spec.y * 0.24;
            var trailTxEnd = spec.x * 0.6;
            var trailTyEnd = spec.y * 0.6;
            trailNode.style.opacity = String(Math.max(0.12, 0.4 - t * 0.14));
            animateNode(
              trailNode,
              [
                { opacity: 0, transform: "translate3d(-50%, -50%, 0) rotate(" + rotation + "deg) scale(0.5)" },
                { opacity: Math.max(0.12, 0.4 - t * 0.14), transform: "translate3d(calc(-50% + " + trailTx + "px), calc(-50% + " + trailTy + "px), 0) rotate(" + rotation + "deg) scale(0.68)" },
                { opacity: 0, transform: "translate3d(calc(-50% + " + trailTxEnd + "px), calc(-50% + " + trailTyEnd + "px), 0) rotate(" + rotation + "deg) scale(0.44)" },
              ],
              { duration: (particleConfig.particleDuration || 760) * 0.8, easing: "ease-out", delay: spec.delay + t * 40 }
            );
          }
        }
      }
    }

    function renderOrbitalParticles(x, y, actionConfig, runIndex) {
      var particleConfig = configStore.getActionParticleConfig(actionConfig);
      if (!particleConfig.particle) return;

      var orbitalDuration = Math.max(0, (particleConfig.particleDuration || 760));
      var fadeInDuration = Math.min(400, (particleConfig.particleDuration || 760) * 0.3);

      var specs = computeOrbitalParticleSpecs(actionConfig);
      if (!specs || !specs.length) return;

      var root = ensureRoot();
      var dots = [];

      for (var i = 0; i < specs.length; i++) {
        var spec = specs[i];
        var dot = document.createElement("span");
        dot.className = "cd-effect cd-particle";
        dot.style.left = x + "px";
        dot.style.top = y + "px";

        var shapeStyle = getParticleShapeStyle(actionConfig, i, spec.size);
        if (shapeStyle) {
          dot.style.width = shapeStyle.width + "px";
          dot.style.height = shapeStyle.height + "px";
          dot.style.borderRadius = shapeStyle.borderRadius || "";
          if (shapeStyle.clipPath) dot.style.clipPath = shapeStyle.clipPath;
          if (shapeStyle.boxShadow) dot.style.boxShadow = shapeStyle.boxShadow;
        }

        var oscFrames = [
          { transform: "translate3d(calc(-50% + " + spec.sx + "px), calc(-50% + " + spec.sy + "px), 0) scale(0.6)", opacity: 0.5, offset: 0 },
          { transform: "translate3d(calc(-50% + " + spec.ex + "px), calc(-50% + " + spec.ey + "px), 0) scale(1.2)", opacity: 0.15, offset: 0.5 },
          { transform: "translate3d(calc(-50% + " + spec.sx + "px), calc(-50% + " + spec.sy + "px), 0) scale(0.6)", opacity: 0.5, offset: 1 },
        ];

        var iterations = orbitalDuration > 0 ? Math.ceil(orbitalDuration / (spec.speed * 1000)) : Infinity;
        var anim = dot.animate(oscFrames, {
          duration: spec.speed * 1000,
          iterations: iterations,
          delay: spec.delay,
          easing: "ease-in-out",
          fill: orbitalDuration > 0 ? "forwards" : "none",
        });

        // fade in (uses particleDuration for smoothness)
        dot.animate(
          [{ opacity: 0 }, { opacity: 0.9 }],
          { duration: fadeInDuration, easing: "ease-out", fill: "forwards" }
        );

        root.append(dot);
        dots.push({ dot: dot, anim: anim });
      }

      // store for external cleanup (e.g. hover leave)
      state.orbitalGroups = state.orbitalGroups || [];
      state.orbitalGroups.push(dots);
    }

    function clearOrbitalParticles() {
      var groups = state.orbitalGroups;
      if (!groups) return;
      state.orbitalGroups = [];
      for (var g = 0; g < groups.length; g++) {
        var group = groups[g];
        for (var d = 0; d < group.length; d++) {
          var item = group[d];
          item.anim.cancel();
          item.dot.remove();
        }
      }
    }

    return {
      ensureRoot,
      renderText,
      renderRipple,
      renderAnimationEffect,
      renderImageEffect,
      renderParticles,
      renderOrbitalParticles,
      clearOrbitalParticles,
      renderCursorOverride,
      hasCursorOverride,
    };
  };
})(window);
