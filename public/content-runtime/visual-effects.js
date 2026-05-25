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
      if (actionConfig.textWeight === "加粗") return 700;
      if (actionConfig.textWeight === "中等") return 600;
      return 500;
    }

    const TEXT_FONT_FAMILY_VALUES = {
      系统默认: '"SF Pro Text","PingFang SC","Microsoft YaHei",system-ui,sans-serif',
      "苹方 / 微软雅黑": '"PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif',
      宋体: 'SimSun,"Songti SC",serif',
      黑体: 'SimHei,"Heiti SC",sans-serif',
      楷体: 'KaiTi,"Kaiti SC",serif',
      等宽字体: '"SFMono-Regular",Consolas,"Liberation Mono",monospace',
    };

    function getTextFontFamily(value) {
      const textFontFamily = typeof value === "string" ? value.trim() : "";
      if (!textFontFamily || textFontFamily === "自定义") return TEXT_FONT_FAMILY_VALUES.系统默认;
      if (TEXT_FONT_FAMILY_VALUES[textFontFamily]) return TEXT_FONT_FAMILY_VALUES[textFontFamily];
      return textFontFamily.replace(/[;\n\r]/g, "").slice(0, 120) || TEXT_FONT_FAMILY_VALUES.系统默认;
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
      const palette = Array.isArray(particleConfig.particlePalette) && particleConfig.particlePalette.length
        ? particleConfig.particlePalette
        : ["#FDBA74", "#FDE68A", "#86EFAC", "#93C5FD", "#F9A8D4"];
      if (particleConfig.particleColorMode === "随机轻变化") {
        return hexToRgba(palette[index % palette.length], (particleConfig.particleOpacity || 88) / 100);
      }
      return hexToRgba(palette[0] || "#FBBF24", (particleConfig.particleOpacity || 88) / 100);
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
        const rippleColor = rippleConfig.rippleColor || "#34D399";
        node.style.border = filled ? "none" : `${lineWidth}px solid ${hexToRgba(rippleColor, layerOpacity)}`;
        if (filled) {
          node.style.background = `radial-gradient(circle, ${hexToRgba(rippleColor, layerOpacity * 0.34)} 0%, ${hexToRgba(rippleColor, layerOpacity * 0.16)} 56%, ${hexToRgba(rippleColor, 0)} 100%)`;
          node.style.boxShadow = `0 0 0 1px ${hexToRgba(rippleColor, layerOpacity * 0.22)} inset`;
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

      if (style === "脉冲波纹") {
        renderLayer({ scaleFrom: 0.12, scaleMid: 0.58, scaleTo: 0.98, filled: true });
        renderLayer({ scaleFrom: 0.32, scaleMid: 0.78, scaleTo: 1.2, delay: Math.min(180, duration * 0.18), layerSize: size * 1.24, layerOpacity: opacity * 0.52 });
        renderLayer({ scaleFrom: 0.48, scaleMid: 0.88, scaleTo: 1.36, delay: Math.min(320, duration * 0.36), layerSize: size * 1.4, layerOpacity: opacity * 0.26 });
        return;
      }

      if (style === "回声环") {
        renderLayer({ scaleFrom: 0.16, scaleMid: 0.62, scaleTo: 0.96 });
        renderLayer({ scaleFrom: 0.28, scaleMid: 0.72, scaleTo: 1.06, delay: Math.min(90, duration * 0.1), layerSize: size * 1.1, layerOpacity: opacity * 0.68 });
        renderLayer({ scaleFrom: 0.4, scaleMid: 0.82, scaleTo: 1.18, delay: Math.min(180, duration * 0.2), layerSize: size * 1.22, layerOpacity: opacity * 0.44 });
        renderLayer({ scaleFrom: 0.52, scaleMid: 0.9, scaleTo: 1.32, delay: Math.min(280, duration * 0.3), layerSize: size * 1.36, layerOpacity: opacity * 0.22 });
        return;
      }

      if (style === "能量脉冲") {
        renderLayer({ scaleFrom: 0.1, scaleMid: 0.56, scaleTo: 0.96, filled: true, layerOpacity: opacity * 1.1 });
        renderLayer({ scaleFrom: 0.26, scaleMid: 0.74, scaleTo: 1.12, delay: Math.min(140, duration * 0.14), layerSize: size * 1.16, layerOpacity: opacity * 0.58 });
        return;
      }

      renderLayer({ scaleFrom: 0.18, scaleMid: 0.72, scaleTo: 1 });
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

      if (style === "斜切闪片") {
        node.style.borderRadius = "22px";
        node.style.background = "linear-gradient(135deg, rgba(250,204,21,0.96), rgba(249,115,22,0.92))";
        node.style.boxShadow = "0 18px 32px rgba(249, 115, 22, 0.22)";
      } else if (style === "弹跳徽记") {
        node.style.borderRadius = "999px";
        node.style.background = "radial-gradient(circle at 35% 35%, rgba(96,165,250,0.96), rgba(79,70,229,0.94))";
        node.style.boxShadow = "0 16px 30px rgba(79, 70, 229, 0.2)";
      } else if (style === "漩涡旋转") {
        node.style.borderRadius = "38%";
        node.style.background = `linear-gradient(135deg, ${hexToRgba(animColor, 0.92)}, ${hexToRgba(animColor, 0.48)})`;
        node.style.boxShadow = `0 14px 28px ${hexToRgba(animColor, 0.26)}`;
      } else if (style === "星光闪耀") {
        node.style.borderRadius = "0";
        node.style.clipPath = "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
        node.style.background = `radial-gradient(circle at 35% 35%, ${hexToRgba(animColor, 0.96)}, ${hexToRgba(animColor, 0.62)})`;
        if (glow) node.style.boxShadow = glow;
      } else if (style === "轨道环绕") {
        node.style.borderRadius = "28%";
        node.style.background = `conic-gradient(from 0deg, ${hexToRgba(animColor, 0.72)}, ${hexToRgba(animColor, 0)}, ${hexToRgba(animColor, 0.72)})`;
        if (glow) node.style.boxShadow = glow;
      } else if (style === "螺旋上升") {
        node.style.borderRadius = "30% 70% 70% 30% / 30% 30% 70% 70%";
        node.style.background = `radial-gradient(circle at 35% 35%, ${hexToRgba(animColor, 0.92)}, ${hexToRgba(animColor, 0.28)})`;
        node.style.boxShadow = `0 12px 26px ${hexToRgba(animColor, 0.22)}`;
      } else {
        node.style.borderRadius = "999px";
        node.style.background = `radial-gradient(circle, ${hexToRgba(animColor, 0.3)} 0%, ${hexToRgba(animColor, 0.14)} 55%, ${hexToRgba(animColor, 0)} 100%)`;
        node.style.border = `2px solid ${hexToRgba(animColor, 0.42)}`;
        if (glow) node.style.boxShadow = glow;
      }

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

    function renderParticles(x, y, actionConfig) {
      const particleConfig = configStore.getActionParticleConfig(actionConfig);
      if (!particleConfig.particle) return;

      const count = Math.min(particleConfig.particleCount || 0, 40);
      if (!count) return;

      const gravity = (particleConfig.particleGravity || 0) / 100;
      const wind = (particleConfig.particleWind || 0) / 100;
      const bounce = (particleConfig.particleBounce || 0) / 100;
      const hasTrail = particleConfig.particleTrail;

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

        const spread = particleConfig.particleSpread || 52;
        const angle = startAngle + (count === 1 ? 0 : (index / (count - 1)) * sweep);
        const distance = Math.max(16, spread * (0.52 + index / Math.max(count * 1.4, 1)));
        const baseX = Math.cos(angle) * distance;
        const baseY = Math.sin(angle) * distance;
        const tx = baseX + wind * spread * 1.2;
        const ty = baseY + gravity * spread * 1.6;
        const bounceY = bounce > 0 ? -spread * bounce * 1.0 : 0;
        const node = document.createElement("span");
        node.className = "cd-effect cd-particle";
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        const baseSize = Math.max(4, (particleConfig.particleSize || 10) * (0.52 + (index % 4) * 0.1));
        const particleStyle = particleConfig.particleStyle || "点状粒子";
        const rotation = getParticleRotation(particleStyle, index);

        applyParticleShape(node, particleStyle, baseSize, index, actionConfig);

        const midX = tx * 0.35;
        const midY = (ty + bounceY) * 0.4;
        const midTransform = `translate3d(calc(-50% + ${midX}px), calc(-50% + ${midY}px), 0) rotate(${rotation}deg)`;
        const endTransform = `translate3d(calc(-50% + ${tx}px), calc(-50% + ${ty}px), 0) rotate(${rotation}deg)`;
        const endScale = particleStyle === "火花" ? 0.52 : particleStyle === "星光" ? 0.38 : 0.65;

        animateNode(
          node,
          [
            { opacity: 0, transform: `translate3d(-50%, -50%, 0) rotate(${rotation}deg) scale(0.5)` },
            { opacity: 0.9, transform: `${midTransform} scale(1)` },
            { opacity: 0, transform: `${endTransform} scale(${endScale})` },
          ],
          {
            duration: particleConfig.particleDuration || 760,
            easing: particleStyle === "火花" || particleStyle === "星光" ? "cubic-bezier(0.22, 1, 0.36, 1)" : "ease-out",
          }
        );

        if (hasTrail && index % 3 === 0) {
          for (let t = 1; t <= 2; t++) {
            const trailNode = document.createElement("span");
            trailNode.className = "cd-effect cd-particle";
            trailNode.style.left = `${x}px`;
            trailNode.style.top = `${y}px`;
            const trailSize = baseSize * (1 - t * 0.32);
            const trailTx = tx * 0.24;
            const trailTy = ty * 0.24;
            const trailTxEnd = tx * 0.6;
            const trailTyEnd = ty * 0.6;
            applyParticleShape(trailNode, particleStyle, trailSize, index + t, actionConfig);
            trailNode.style.opacity = String(Math.max(0.12, 0.4 - t * 0.14));
            animateNode(
              trailNode,
              [
                { opacity: 0, transform: `translate3d(-50%, -50%, 0) rotate(${rotation}deg) scale(0.5)` },
                { opacity: Math.max(0.12, 0.4 - t * 0.14), transform: `translate3d(calc(-50% + ${trailTx}px), calc(-50% + ${trailTy}px), 0) rotate(${rotation}deg) scale(0.68)` },
                { opacity: 0, transform: `translate3d(calc(-50% + ${trailTxEnd}px), calc(-50% + ${trailTyEnd}px), 0) rotate(${rotation}deg) scale(0.44)` },
              ],
              { duration: (particleConfig.particleDuration || 760) * 0.8, easing: "ease-out", delay: t * 40 }
            );
          }
        }
      }
    }

    function getParticleRotation(style, index) {
      if (style === "火花") return -28 + ((index * 17) % 7) * 11;
      if (style === "碎屑粒子") return -42 + ((index * 13) % 9) * 10;
      if (style === "星光") return ((index * 23) % 9) * 8;
      if (style === "钻石") return 45 + ((index * 11) % 7) * 5;
      if (style === "心形") return -12 + ((index * 9) % 7) * 6;
      if (style === "方块") return ((index * 19) % 13) * 7;
      if (style === "三角") return ((index * 31) % 11) * 16;
      return 0;
    }

    function applyParticleShape(node, style, size, index, actionConfig) {
      if (style === "火花") {
        node.style.width = `${size * 1.9}px`;
        node.style.height = `${Math.max(3, size * 0.42)}px`;
        node.style.borderRadius = "999px";
        node.style.boxShadow = `0 0 12px ${hexToRgba("#F59E0B", 0.34)}`;
      } else if (style === "碎屑粒子") {
        node.style.width = `${size * 1.35}px`;
        node.style.height = `${Math.max(4, size * 0.72)}px`;
        node.style.borderRadius = "38%";
        node.style.boxShadow = `0 4px 10px ${hexToRgba("#0F172A", 0.12)}`;
      } else if (style === "星光") {
        node.style.width = `${size * 1.5}px`;
        node.style.height = `${size * 1.5}px`;
        node.style.clipPath = "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)";
        node.style.borderRadius = "0";
        node.style.boxShadow = `0 0 10px ${hexToRgba("#FBBF24", 0.38)}`;
      } else if (style === "钻石") {
        node.style.width = `${size * 1.2}px`;
        node.style.height = `${size * 1.2}px`;
        node.style.clipPath = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
        node.style.borderRadius = "18%";
        node.style.boxShadow = `0 4px 12px ${hexToRgba("#0F172A", 0.16)}`;
      } else if (style === "心形") {
        node.style.width = `${size * 1.4}px`;
        node.style.height = `${size * 1.3}px`;
        node.style.clipPath = "polygon(50% 15%, 72% 0%, 94% 12%, 94% 38%, 80% 62%, 50% 90%, 20% 62%, 6% 38%, 6% 12%, 28% 0%)";
        node.style.borderRadius = "0";
        node.style.boxShadow = `0 3px 10px ${hexToRgba("#EC4899", 0.22)}`;
      } else if (style === "方块") {
        node.style.width = `${size * 1.15}px`;
        node.style.height = `${size * 1.15}px`;
        node.style.borderRadius = "12%";
        node.style.boxShadow = `0 4px 10px ${hexToRgba("#0F172A", 0.14)}`;
      } else if (style === "三角") {
        node.style.width = `${size * 1.3}px`;
        node.style.height = `${size * 1.2}px`;
        node.style.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
        node.style.borderRadius = "0";
        node.style.boxShadow = `0 3px 9px ${hexToRgba("#0F172A", 0.12)}`;
      } else {
        node.style.width = `${size}px`;
        node.style.height = `${size}px`;
        node.style.borderRadius = "999px";
        node.style.boxShadow = "0 6px 14px rgba(15, 23, 42, 0.12)";
      }

      node.style.background = getParticleColor(actionConfig, index);
    }

    return {
      ensureRoot,
      renderText,
      renderRipple,
      renderAnimationEffect,
      renderImageEffect,
      renderParticles,
      renderCursorOverride,
      hasCursorOverride,
    };
  };
})(window);
