/* global CursorDanceConfigHelpers */
(function registerComputeSpecs(globalThis) {
  var helpers = globalThis.CursorDanceConfigHelpers || (globalThis.CursorDanceConfigHelpers = {});

  // ─── Text content ─────────────────────────────────────────────────────

  function getTextContent(config, runIndex, actionId) {
    runIndex = runIndex || 0;
    actionId = actionId || "leftClick";
    var textConfig = helpers.getActionTextConfig(config);
    if (!textConfig.textEnabled) return "静默";

    if (textConfig.textKind === "文本飘字") {
      var tags = helpers.getOrderedTextTags(textConfig);
      if (!tags.length) return "未设置文本";
      if (textConfig.textTagPlayMode === "随机显示") {
        return tags[(runIndex * 7 + actionId.length) % tags.length];
      }
      return tags[((runIndex - 1) % tags.length + tags.length) % tags.length];
    }

    var numberValue = textConfig.comboEnabled ? Math.max(1, runIndex || 1) : 1;
    var previewNumber = helpers.formatNumber(textConfig.textStyle || "阿拉伯数字 (1, 2, 3)", numberValue);
    if (textConfig.textMode === "模板模式") {
      return (textConfig.textTemplate || "${number}").replaceAll("${number}", previewNumber);
    }

    return "+" + previewNumber;
  }

  // ─── Ripple layers ────────────────────────────────────────────────────

  function computeRippleLayers(config) {
    var rippleConfig = helpers.getActionRippleConfig(config);
    var baseDelay = rippleConfig.rippleDelay || 0;
    var size = rippleConfig.rippleSize;
    var opacity = rippleConfig.rippleOpacity / 100;
    var style = rippleConfig.rippleStyle || "单环";

    if (style === "双环") {
      return [
        { size: size, opacity: opacity, delay: baseDelay, filled: false, scaleFrom: 0.16, scaleMid: 0.62, scaleTo: 0.96 },
        {
          size: size * 1.12,
          opacity: opacity * 0.82,
          delay: baseDelay + Math.min(120, rippleConfig.rippleDuration * 0.12),
          filled: false,
          scaleFrom: 0.28,
          scaleMid: 0.84,
          scaleTo: 1.14,
        },
      ];
    }

    if (style === "柔和面波") {
      return [{ size: size, opacity: opacity, delay: baseDelay, filled: true, scaleFrom: 0.22, scaleMid: 0.7, scaleTo: 1.06 }];
    }

    if (style === "脉冲波纹") {
      return [
        { size: size, opacity: opacity, delay: baseDelay, filled: true, scaleFrom: 0.12, scaleMid: 0.58, scaleTo: 0.98 },
        {
          size: size * 1.24,
          opacity: opacity * 0.52,
          delay: baseDelay + Math.min(180, rippleConfig.rippleDuration * 0.18),
          filled: false,
          scaleFrom: 0.32,
          scaleMid: 0.78,
          scaleTo: 1.2,
        },
        {
          size: size * 1.4,
          opacity: opacity * 0.26,
          delay: baseDelay + Math.min(320, rippleConfig.rippleDuration * 0.36),
          filled: false,
          scaleFrom: 0.48,
          scaleMid: 0.88,
          scaleTo: 1.36,
        },
      ];
    }

    if (style === "回声环") {
      return [
        { size: size, opacity: opacity, delay: baseDelay, filled: false, scaleFrom: 0.16, scaleMid: 0.62, scaleTo: 0.96 },
        {
          size: size * 1.1,
          opacity: opacity * 0.68,
          delay: baseDelay + Math.min(90, rippleConfig.rippleDuration * 0.1),
          filled: false,
          scaleFrom: 0.28,
          scaleMid: 0.72,
          scaleTo: 1.06,
        },
        {
          size: size * 1.22,
          opacity: opacity * 0.44,
          delay: baseDelay + Math.min(180, rippleConfig.rippleDuration * 0.2),
          filled: false,
          scaleFrom: 0.4,
          scaleMid: 0.82,
          scaleTo: 1.18,
        },
        {
          size: size * 1.36,
          opacity: opacity * 0.22,
          delay: baseDelay + Math.min(280, rippleConfig.rippleDuration * 0.3),
          filled: false,
          scaleFrom: 0.52,
          scaleMid: 0.9,
          scaleTo: 1.32,
        },
      ];
    }

    if (style === "能量脉冲") {
      return [
        { size: size, opacity: opacity * 1.1, delay: baseDelay, filled: true, scaleFrom: 0.1, scaleMid: 0.56, scaleTo: 0.96 },
        {
          size: size * 1.16,
          opacity: opacity * 0.58,
          delay: baseDelay + Math.min(140, rippleConfig.rippleDuration * 0.14),
          filled: false,
          scaleFrom: 0.26,
          scaleMid: 0.74,
          scaleTo: 1.12,
        },
      ];
    }

    // 单环 (default)
    return [{ size: size, opacity: opacity, delay: baseDelay, filled: false, scaleFrom: 0.18, scaleMid: 0.72, scaleTo: 1 }];
  }

  // ─── Particle physics ─────────────────────────────────────────────────

  function computeParticleSpecs(config, runIndex) {
    var particleConfig = helpers.getActionParticleConfig(config);
    var baseDelay = particleConfig.particleDelay || 0;
    var visibleCount = Math.min(particleConfig.particleCount, 40);
    var spread = Math.max(0, Math.min(particleConfig.particleSpread || 52, 90));

    var direction = particleConfig.particleDirection || "四周扩散";

    var angleOrder = [];
    for (var ai = 0; ai < visibleCount; ai++) {
      angleOrder[ai] = ai;
    }
    if (direction !== "旋转扫射") {
      for (var si = angleOrder.length - 1; si > 0; si--) {
        var sj = (runIndex * 7 + si * 13) % (si + 1);
        var tmp = angleOrder[si];
        angleOrder[si] = angleOrder[sj];
        angleOrder[sj] = tmp;
      }
    }

    var result = [];
    for (var index = 0; index < visibleCount; index++) {
      var startAngle = 0;
      var sweep = Math.PI * 2;

      if (direction === "向上喷发") {
        startAngle = -Math.PI * 0.95;
        sweep = Math.PI * 0.9;
      }

      var angle;
      if (direction === "随机散射") {
        angle = ((runIndex * 13 + index * 7 + (index % 5) * 19) % 360) * (Math.PI / 180);
      } else {
        var angleIndex = angleOrder[index];
        angle = startAngle + (visibleCount === 1 ? 0 : (angleIndex / (visibleCount - 1)) * sweep);
      }

      var angleForVariance = direction === "随机散射" ? index : angleOrder[index];
      var variance = ((runIndex + 5) * (angleForVariance + 3)) % 11 - 5;
      var style = particleConfig.particleStyle || "点状粒子";
      var motionScale = style === "火花" ? 1.45 : style === "碎屑粒子" ? 1.2 : 1.0;
      var gravityScale = style === "火花" ? 0.35 : style === "碎屑粒子" ? 1.45 : 1.0;
      var spreadScale = style === "火花" ? 0.7 : style === "碎屑粒子" ? 1.3 : 1.0;
      var staggerScale = style === "火花" ? 0.5 : style === "碎屑粒子" ? 0.75 : 1.0;
      var effectiveSpread = spread * spreadScale;
      var distance = Math.max(16, effectiveSpread * (0.55 + index / Math.max(visibleCount * 1.45, 1)) + variance * 1.8);
      var baseX = Math.cos(angle) * distance * motionScale;
      var baseY = Math.sin(angle) * distance * motionScale;
      var gravity = (particleConfig.particleGravity || 0) / 100;
      var wind = (particleConfig.particleWind || 0) / 100;
      var bounce = (particleConfig.particleBounce || 0) / 100;
      var bounceY = bounce > 0 ? -effectiveSpread * bounce * 1.0 : 0;
      var tx = baseX + wind * effectiveSpread * 1.2;
      var ty = baseY + gravity * gravityScale * effectiveSpread * 1.6;
      result.push({
        x: tx,
        y: ty,
        midX: tx * 0.35,
        midY: (ty + bounceY) * 0.4,
        delay: baseDelay + index * (particleConfig.particleStagger || 26) * staggerScale,
        size: Math.max(4, (particleConfig.particleSize || 10) * (0.52 + (index % 4) * 0.1)),
        endScale: style === "火花" ? 0.35 : style === "碎屑粒子" ? 0.55 : style === "星光" ? 0.38 : 0.65,
      });
    }
    return result;
  }

  // ─── Orbital particle specs ───────────────────────────────────────────

  function computeOrbitalParticleSpecs(config) {
    var particleConfig = helpers.getActionParticleConfig(config);
    var count = Math.min(particleConfig.orbitalCount || 6, 16);
    var radius = Math.max(16, Math.min(particleConfig.orbitalRadius || 32, 80));
    var speed = Math.max(1, Math.min(particleConfig.orbitalSpeed || 3, 8));
    var duration = particleConfig.particleDuration || 780;

    var result = [];
    for (var i = 0; i < count; i++) {
      var angle = (i / count) * Math.PI * 2;
      var size = Math.max(4, (particleConfig.particleSize || 10) * (0.5 + (i % 3) * 0.12));
      result.push({
        angle: angle,
        sx: Math.cos(angle) * 4,
        sy: Math.sin(angle) * 4,
        ex: Math.cos(angle) * radius,
        ey: Math.sin(angle) * radius,
        delay: -(i / count) * speed * 1000,
        size: size,
        duration: duration,
        speed: speed,
      });
    }
    return result;
  }

  // ─── Particle shape / style ───────────────────────────────────────────

  function getParticleShapeStyle(config, index, size) {
    var particleConfig = helpers.getActionParticleConfig(config);
    var style = particleConfig.particleStyle || "点状粒子";

    if (style === "火花") {
      var sparkW = size * 1.9;
      var sparkH = Math.max(3, size * 0.42);
      return {
        width: sparkW,
        height: sparkH,
        borderRadius: "999px",
        rotation: -28 + ((index * 17) % 7) * 11,
        boxShadow: "0 0 4px " + helpers.hexToRgba("#F59E0B", 0.5) + ", 0 0 16px " + helpers.hexToRgba("#F59E0B", 0.28),
      };
    }

    if (style === "碎屑粒子") {
      var debrisW = size * (1.2 + (index % 3) * 0.15);
      var debrisH = size * (0.6 + (index % 2) * 0.2);
      return {
        width: debrisW,
        height: debrisH,
        borderRadius: String(20 + (index % 5) * 6) + "%",
        rotation: -42 + ((index * 13) % 9) * 10,
        boxShadow: "0 4px 10px " + helpers.hexToRgba("#0F172A", 0.12) + ", inset 0 1px 0 " + helpers.hexToRgba("#FFFFFF", 0.18),
      };
    }

    if (style === "星光") {
      return {
        width: size * 1.5,
        height: size * 1.5,
        borderRadius: "0",
        rotation: ((index * 23) % 9) * 8,
        clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
        boxShadow: "0 0 10px " + helpers.hexToRgba("#FBBF24", 0.38),
      };
    }

    if (style === "钻石") {
      return {
        width: size * 1.2,
        height: size * 1.2,
        borderRadius: "18%",
        rotation: 45 + ((index * 11) % 7) * 5,
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        boxShadow: "0 4px 12px " + helpers.hexToRgba("#0F172A", 0.16),
      };
    }

    if (style === "心形") {
      return {
        width: size * 1.4,
        height: size * 1.3,
        borderRadius: "0",
        rotation: -12 + ((index * 9) % 7) * 6,
        clipPath: "polygon(50% 15%, 72% 0%, 94% 12%, 94% 38%, 80% 62%, 50% 90%, 20% 62%, 6% 38%, 6% 12%, 28% 0%)",
        boxShadow: "0 3px 10px " + helpers.hexToRgba("#EC4899", 0.22),
      };
    }

    if (style === "方块") {
      return {
        width: size * 1.15,
        height: size * 1.15,
        borderRadius: "12%",
        rotation: ((index * 19) % 13) * 7,
        boxShadow: "0 4px 10px " + helpers.hexToRgba("#0F172A", 0.14),
      };
    }

    if (style === "三角") {
      return {
        width: size * 1.3,
        height: size * 1.2,
        borderRadius: "0",
        rotation: ((index * 31) % 11) * 16,
        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
        boxShadow: "0 3px 9px " + helpers.hexToRgba("#0F172A", 0.12),
      };
    }

    // 点状粒子 (default)
    return {
      width: size,
      height: size,
      borderRadius: "999px",
      rotation: 0,
      boxShadow: "0 0 0 1px " + helpers.hexToRgba("#FFFFFF", 0.4),
    };
  }

  // ─── Particle color / tint ────────────────────────────────────────────

  function getParticleTint(config, index) {
    var particleConfig = helpers.getActionParticleConfig(config);
    var textConfig = helpers.getActionTextConfig(config);
    if (particleConfig.particleColorMode === "跟随飘字色") {
      return helpers.hexToRgba(textConfig.textColor, particleConfig.particleOpacity / 100);
    }
    var palette = Array.isArray(particleConfig.particlePalette) && particleConfig.particlePalette.length
      ? particleConfig.particlePalette
      : ["#FDBA74", "#FDE68A", "#86EFAC", "#93C5FD", "#F9A8D4"];
    if (particleConfig.particleColorMode === "随机轻变化") {
      return helpers.hexToRgba(palette[index % palette.length], particleConfig.particleOpacity / 100);
    }
    return helpers.hexToRgba(palette[0] || "#FBBF24", particleConfig.particleOpacity / 100);
  }

  // ─── Animation visual style ───────────────────────────────────────────

  function getAnimationVisualStyle(config) {
    var animationConfig = helpers.getActionAnimationConfig(config);
    var style = animationConfig.animationStyle || "聚焦脉冲";
    var animColor = animationConfig.animationColor || "#34D399";
    var glow = animationConfig.animationGlow ? "0 0 18px " + helpers.hexToRgba(animColor, 0.24) : "";

    if (style === "斜切闪片") {
      return {
        borderRadius: "22px",
        background: "linear-gradient(135deg, rgba(250,204,21,0.96), rgba(249,115,22,0.92))",
        boxShadow: "0 18px 32px rgba(249, 115, 22, 0.22)",
      };
    }
    if (style === "弹跳徽记") {
      return {
        borderRadius: "999px",
        background: "radial-gradient(circle at 35% 35%, rgba(96,165,250,0.96), rgba(79,70,229,0.94))",
        boxShadow: "0 16px 30px rgba(79, 70, 229, 0.2)",
      };
    }
    if (style === "漩涡旋转") {
      return {
        borderRadius: "38%",
        background: "linear-gradient(135deg, " + helpers.hexToRgba(animColor, 0.92) + ", " + helpers.hexToRgba(animColor, 0.48) + ")",
        boxShadow: "0 14px 28px " + helpers.hexToRgba(animColor, 0.26),
      };
    }
    if (style === "星光闪耀") {
      return {
        borderRadius: "0",
        clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
        background: "radial-gradient(circle at 35% 35%, " + helpers.hexToRgba(animColor, 0.96) + ", " + helpers.hexToRgba(animColor, 0.62) + ")",
        boxShadow: glow || undefined,
      };
    }
    if (style === "轨道环绕") {
      return {
        borderRadius: "28%",
        background: "conic-gradient(from 0deg, " + helpers.hexToRgba(animColor, 0.72) + ", " + helpers.hexToRgba(animColor, 0) + ", " + helpers.hexToRgba(animColor, 0.72) + ")",
        boxShadow: glow || undefined,
      };
    }
    if (style === "螺旋上升") {
      return {
        borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
        background: "radial-gradient(circle at 35% 35%, " + helpers.hexToRgba(animColor, 0.92) + ", " + helpers.hexToRgba(animColor, 0.28) + ")",
        boxShadow: "0 12px 26px " + helpers.hexToRgba(animColor, 0.22),
      };
    }

    // 聚焦脉冲 (default)
    return {
      borderRadius: "999px",
      background: "radial-gradient(circle, " + helpers.hexToRgba(animColor, 0.3) + " 0%, " + helpers.hexToRgba(animColor, 0.14) + " 55%, " + helpers.hexToRgba(animColor, 0) + " 100%)",
      border: "2px solid " + helpers.hexToRgba(animColor, 0.42),
      boxShadow: glow || undefined,
    };
  }

  // ─── Register on helpers ──────────────────────────────────────────────

  Object.assign(helpers, {
    computeParticleSpecs: computeParticleSpecs,
    computeOrbitalParticleSpecs: computeOrbitalParticleSpecs,
    computeRippleLayers: computeRippleLayers,
    getParticleShapeStyle: getParticleShapeStyle,
    getParticleTint: getParticleTint,
    getAnimationVisualStyle: getAnimationVisualStyle,
    getTextContent: getTextContent,
  });
})(window);
