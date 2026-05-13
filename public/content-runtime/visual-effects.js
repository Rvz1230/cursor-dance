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

    function hexToRgba(hex, alpha) {
      const normalized = (hex || "#f59e0b").replace("#", "");
      const value = normalized.length === 3
        ? normalized
            .split("")
            .map((item) => item + item)
            .join("")
        : normalized;
      const int = Number.parseInt(value, 16);
      const r = (int >> 16) & 255;
      const g = (int >> 8) & 255;
      const b = int & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function getAnimationEasing(label) {
      if (label === "线性") return "linear";
      if (label === "缓入") return "cubic-bezier(0.4, 0, 1, 1)";
      if (label === "缓入缓出") return "cubic-bezier(0.4, 0, 0.2, 1)";
      if (label === "弹跳") return "cubic-bezier(0.34, 1.56, 0.64, 1)";
      if (label === "弹性") return "cubic-bezier(0.22, 1, 0.36, 1.18)";
      return "cubic-bezier(0, 0, 0.2, 1)";
    }

    function getTextWeight(actionConfig) {
      if (actionConfig.textWeight === "加粗") return 800;
      if (actionConfig.textWeight === "中等") return 600;
      return 500;
    }

    function formatNumber(style, number) {
      if (style?.includes("中文")) {
        const values = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
        return values[(number - 1) % values.length];
      }
      if (style?.includes("英文")) {
        const values = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
        return values[(number - 1) % values.length];
      }
      return String(number);
    }

    function getOrderedTextTags(actionConfig) {
      const currentTags = Array.isArray(actionConfig?.textTags) ? actionConfig.textTags.filter(Boolean) : [];
      const primaryText = typeof actionConfig?.textContent === "string" ? actionConfig.textContent.trim() : "";
      if (!primaryText) return currentTags;
      return [primaryText, ...currentTags.filter((item) => item !== primaryText)];
    }

    function getActionText(actionConfig, actionId, runIndex) {
      const textConfig = configStore.getActionTextConfig(actionConfig);
      if (!textConfig.textEnabled) return "";

      if (textConfig.textKind === "文本飘字") {
        const tags = getOrderedTextTags(textConfig);
        if (!tags.length) return "";
        if (textConfig.textTagPlayMode === "随机显示") {
          return tags[(runIndex * 7 + actionId.length) % tags.length];
        }
        return tags[(runIndex - 1) % tags.length];
      }

      const numberValue = textConfig.comboEnabled ? runIndex : 1;
      const formattedNumber = formatNumber(textConfig.textStyle, numberValue);
      if (textConfig.textMode === "模板模式") {
        return (textConfig.textTemplate || "${number}").replaceAll("${number}", formattedNumber);
      }
      return `+${formattedNumber}`;
    }

    function getParticleColor(actionConfig, index) {
      const particleConfig = configStore.getActionParticleConfig(actionConfig);
      const textConfig = configStore.getActionTextConfig(actionConfig);
      if (particleConfig.particleColorMode === "跟随飘字色") {
        return hexToRgba(textConfig.textColor, (particleConfig.particleOpacity || 88) / 100);
      }
      if (particleConfig.particleColorMode === "随机轻变化") {
        const palette = ["#FDBA74", "#FDE68A", "#86EFAC", "#93C5FD", "#F9A8D4"];
        return hexToRgba(palette[index % palette.length], (particleConfig.particleOpacity || 88) / 100);
      }
      return hexToRgba("#F59E0B", (particleConfig.particleOpacity || 88) / 100);
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
      const size = rippleConfig.rippleSize || 88;
      const lineWidth = rippleConfig.rippleLineWidth || 2;
      const opacity = (rippleConfig.rippleOpacity || 72) / 100;
      const duration = rippleConfig.rippleDuration || 820;
      const style = rippleConfig.rippleStyle || "单环";

      const renderLayer = ({ scaleFrom, scaleMid, scaleTo, delay = 0, layerSize = size, layerOpacity = opacity, filled = false }) => {
        const node = document.createElement("div");
        node.className = "cd-effect cd-ripple";
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.width = `${layerSize}px`;
        node.style.height = `${layerSize}px`;
        node.style.borderRadius = "999px";
        node.style.border = filled ? "none" : `${lineWidth}px solid ${hexToRgba("#34D399", layerOpacity)}`;
        if (filled) {
          node.style.background = `radial-gradient(circle, ${hexToRgba("#6EE7B7", layerOpacity * 0.34)} 0%, ${hexToRgba("#34D399", layerOpacity * 0.16)} 56%, ${hexToRgba("#34D399", 0)} 100%)`;
          node.style.boxShadow = `0 0 0 1px ${hexToRgba("#34D399", layerOpacity * 0.22)} inset`;
        }

        animateNode(
          node,
          [
            { opacity: filled ? layerOpacity * 0.84 : layerOpacity * 0.46, transform: `translate3d(-50%, -50%, 0) scale(${scaleFrom})` },
            { opacity: filled ? layerOpacity * 0.42 : layerOpacity * 0.22, transform: `translate3d(-50%, -50%, 0) scale(${scaleMid})` },
            { opacity: 0, transform: `translate3d(-50%, -50%, 0) scale(${scaleTo})` },
          ],
          {
            duration,
            delay,
            easing,
          }
        );
      };

      if (style === "双环") {
        renderLayer({ scaleFrom: 0.16, scaleMid: 0.62, scaleTo: 0.96 });
        renderLayer({
          scaleFrom: 0.28,
          scaleMid: 0.84,
          scaleTo: 1.14,
          delay: Math.min(120, duration * 0.12),
          layerSize: size * 1.12,
          layerOpacity: opacity * 0.82,
        });
        return;
      }

      if (style === "柔和面波") {
        renderLayer({
          scaleFrom: 0.22,
          scaleMid: 0.7,
          scaleTo: 1.06,
          filled: true,
        });
        return;
      }

      renderLayer({ scaleFrom: 0.18, scaleMid: 0.72, scaleTo: 1 });
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

    function renderParticles(x, y, actionConfig) {
      const particleConfig = configStore.getActionParticleConfig(actionConfig);
      if (!particleConfig.particle) return;

      const count = Math.min(particleConfig.particleCount || 0, 40);
      if (!count) return;

      for (let index = 0; index < count; index += 1) {
        let startAngle = 0;
        let sweep = Math.PI * 2;

        if (particleConfig.particleDirection === "向上喷发") {
          startAngle = -Math.PI * 0.95;
          sweep = Math.PI * 0.9;
        } else if (particleConfig.particleDirection === "沿点击方向") {
          startAngle = -Math.PI * 0.38;
          sweep = Math.PI * 0.76;
        }

        const angle = startAngle + (count === 1 ? 0 : (index / (count - 1)) * sweep);
        const distance = Math.max(16, (particleConfig.particleSpread || 52) * (0.52 + index / Math.max(count * 1.4, 1)));
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        const node = document.createElement("span");
        node.className = "cd-effect cd-particle";
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        const baseSize = Math.max(4, (particleConfig.particleSize || 10) * (0.52 + (index % 4) * 0.1));
        const particleStyle = particleConfig.particleStyle || "点状粒子";
        const rotation = particleStyle === "火花"
          ? -28 + ((index * 17) % 7) * 11
          : particleStyle === "碎屑粒子"
            ? -42 + ((index * 13) % 9) * 10
            : 0;
        node.style.width = `${particleStyle === "火花" ? baseSize * 1.9 : particleStyle === "碎屑粒子" ? baseSize * 1.35 : baseSize}px`;
        node.style.height = `${particleStyle === "火花" ? Math.max(3, baseSize * 0.42) : particleStyle === "碎屑粒子" ? Math.max(4, baseSize * 0.72) : baseSize}px`;
        node.style.borderRadius = particleStyle === "点状粒子" ? "999px" : particleStyle === "火花" ? "999px" : "38%";
        node.style.background = getParticleColor(actionConfig, index);
        node.style.boxShadow = particleStyle === "火花"
          ? `0 0 12px ${hexToRgba("#F59E0B", 0.34)}`
          : particleStyle === "碎屑粒子"
            ? `0 4px 10px ${hexToRgba("#0F172A", 0.12)}`
            : "0 6px 14px rgba(15, 23, 42, 0.12)";

        animateNode(
          node,
          [
            { opacity: 0, transform: `translate3d(-50%, -50%, 0) rotate(${rotation}deg) scale(0.5)` },
            { opacity: 0.9, transform: `translate3d(calc(-50% + ${tx * 0.35}px), calc(-50% + ${ty * 0.35}px), 0) rotate(${rotation}deg) scale(1)` },
            { opacity: 0, transform: `translate3d(calc(-50% + ${tx}px), calc(-50% + ${ty}px), 0) rotate(${rotation}deg) scale(${particleStyle === "火花" ? 0.52 : 0.65})` },
          ],
          {
            duration: particleConfig.particleDuration || 760,
            easing: particleStyle === "火花" ? "cubic-bezier(0.22, 1, 0.36, 1)" : "ease-out",
          }
        );
      }
    }

    return {
      ensureRoot,
      renderText,
      renderRipple,
      renderImageEffect,
      renderParticles,
      renderCursorOverride,
      hasCursorOverride,
    };
  };
})(window);
