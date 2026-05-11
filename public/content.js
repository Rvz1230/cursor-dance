(function cursorDanceMinimalContent() {
  const ROOT_ID = "cursordance-root";
  const STYLE_ID = "cursordance-style";
  const HIDE_CURSOR_CLASS = "cd-hide-native-cursor";
  const CONFIG_STORAGE_KEY = "cursordance.config";
  const CURSOR_ASSET_STORAGE_KEY_PREFIX = "cursordance.cursorAsset.";
  const LEGACY_ENABLED_STORAGE_KEY = "cursordance.enabled";
  const DEFAULT_CONFIG = window.CursorDanceDefaultConfig || {};
  const CONFIG_RUNTIME = window.CursorDanceConfigRuntime || {};
  const INTERACTIVE_SELECTOR = 'a,button,input,textarea,select,summary,label,[role="button"],[tabindex]';
  const TEXT_EDITABLE_SELECTOR = 'textarea,input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]),[contenteditable]:not([contenteditable="false"])';
  const lastTriggerAtByAction = Object.create(null);
  const actionRunCounts = Object.create(null);
  const lastSoundAtByAction = Object.create(null);
  const mediaDuckState = new WeakMap();
  let activeEffects = 0;
  let config = normalizeConfig(DEFAULT_CONFIG);
  let hoverTimeoutId = null;
  let hoverTarget = null;
  let longPressState = null;
  let lastLeftPointerDownAt = 0;
  let lastLeftPointerUpAt = 0;
  let lastWheelEventAt = 0;
  let audioContext = null;
  let stateCursorNode = null;
  let stateCursorImg = null;

  function normalizeConfig(value) {
    return (CONFIG_RUNTIME.normalizeConfig || ((nextValue) => nextValue))(value, DEFAULT_CONFIG);
  }

  function buildCursorAssetStorageKey(themeId, stateId) {
    return `${CURSOR_ASSET_STORAGE_KEY_PREFIX}${themeId}.${stateId}`;
  }

  function mergeCursorStates(fallbackCursorStates, cursorStates) {
    return (CONFIG_RUNTIME.mergeCursorStates || ((fallbackStates, nextStates) => ({
      ...(fallbackStates || {}),
      ...(nextStates || {}),
    })))(fallbackCursorStates, cursorStates);
  }

  function normalizeHost(host) {
    return typeof host === "string" ? host.trim().toLowerCase() : "";
  }

  function getSchemeById(schemeId) {
    return config.schemes.find((scheme) => scheme.id === schemeId) || config.schemes[0] || {};
  }

  function withResolvedCursorAssets(nextConfig, assetEntries) {
    const assetMap = assetEntries || {};
    const nextThemePacks = (nextConfig.themePacks || []).map((themePack) => ({
      ...themePack,
      cursorStates: Object.fromEntries(
        Object.entries(themePack.cursorStates || {}).map(([stateId, stateConfig]) => [
          stateId,
          {
            ...stateConfig,
            imageDataUrl: assetMap[buildCursorAssetStorageKey(themePack.id, stateId)]?.imageDataUrl || stateConfig.imageDataUrl || "",
          },
        ])
      ),
    }));

    return {
      ...nextConfig,
      themePacks: nextThemePacks,
      schemes: nextThemePacks,
    };
  }

  function getActiveScheme() {
    return getSchemeById(config.activeSchemeId);
  }

  function getCurrentSiteMode() {
    const host = normalizeHost(window.location.hostname);
    return (CONFIG_RUNTIME.getSiteMode || (() => "inherit"))(config, host);
  }

  function isCurrentSiteEnabled() {
    const siteMode = getCurrentSiteMode();
    if (siteMode === "enabled") return true;
    if (siteMode === "disabled") return false;
    return config.enabled;
  }

  function getMaxActiveEffects() {
    return config.performance?.maxActiveEffects || 48;
  }

  function getFallbackDraft(scheme) {
    const clickConfig = scheme?.behavior?.click || {};
    const effects = clickConfig.effects || {};
    const textEffect = effects.text || {};
    const rippleEffect = effects.ripple || {};
    const particleEffect = effects.particle || {};
    const mergedCursorStates = mergeCursorStates(DEFAULT_CONFIG.schemes?.[0]?.cursorStates, scheme?.cursorStates);

    return {
      cursorModes: Object.fromEntries(
        Object.entries(mergedCursorStates || {}).map(([stateId, stateConfig]) => [
          stateId,
          stateId === "default" ? (stateConfig.mode === "override" ? "覆盖" : "源") : (stateConfig.mode === "override" ? "覆盖" : "继承"),
        ])
      ),
      cursorStateActions: Object.fromEntries(
        Object.entries(mergedCursorStates || {}).map(([stateId, stateConfig]) => [stateId, stateConfig?.actionId || "leftClick"])
      ),
      actionConfigs: {
        leftClick: {
          textKind: "文本飘字",
          textStyle: "阿拉伯数字 (1, 2, 3)",
          textMode: "默认模式 (+1)",
          textTemplate: "${number}",
          textEnabled: textEffect.enabled !== false,
          textContent: textEffect.content || "+1",
          textTags: [textEffect.content || "+1"],
          textTagPlayMode: "按顺序显示",
          textColor: textEffect.color || "#ec4899",
          textDuration: textEffect.durationMs || 950,
          textOpacity: 100,
          textWeight: (textEffect.fontWeight || 800) >= 700 ? "加粗" : (textEffect.fontWeight || 800) >= 600 ? "中等" : "常规",
          textOutlineWidth: 0,
          textShadow: "无",
          comboEnabled: true,
          textOffsetX: textEffect.offsetX || 0,
          textOffsetY: textEffect.offsetY || -58,
          particle: particleEffect.enabled !== false,
          particleCount: particleEffect.count || 14,
          particleSpread: particleEffect.baseDistance || 52,
          particleStyle: "点状粒子",
          particleDirection: "四周扩散",
          particleColorMode: "跟随飘字色",
          particleDuration: particleEffect.durationMs || 760,
          particleSize: particleEffect.size || 8,
          particleOpacity: 92,
          ripple: rippleEffect.enabled !== false,
          rippleSize: rippleEffect.size || 118,
          rippleDuration: rippleEffect.durationMs || 820,
          rippleStyle: "单环",
          rippleEasing: "缓出",
          rippleLineWidth: 2,
          rippleOpacity: 72,
          sound: false,
          fontSize: textEffect.fontSize || 28,
          volume: 0,
          playbackRate: 100,
          soundDelay: 0,
          soundFadeOut: 0,
          soundTriggerMode: "每次触发",
          soundBlendMode: "保持原音量",
          shake: 0,
          cursorOverride: "跟随当前状态",
          cursorSize: 48,
          triggerTiming: "抬起时",
          triggerZone: "当前页面可点击区域",
          holdMs: clickConfig.trigger?.cooldownMs || 80,
          soundFile: "",
        },
      },
    };
  }

  function getWorkbenchDraft(scheme) {
    if (scheme?.workbenchDraft?.actionConfigs) return scheme.workbenchDraft;
    return getFallbackDraft(scheme);
  }

  function getActionConfig(scheme, actionId) {
    const draft = getWorkbenchDraft(scheme);
    return draft.actionConfigs?.[actionId] || draft.actionConfigs?.leftClick || null;
  }

  function getCursorMode(scheme, stateId) {
    const draft = getWorkbenchDraft(scheme);
    return draft.cursorModes?.[stateId] || (stateId === "default" ? "源" : "继承");
  }

  function getMergedCursorStates(scheme) {
    return mergeCursorStates(DEFAULT_CONFIG.schemes?.[0]?.cursorStates, scheme?.cursorStates);
  }

  function getCursorStateBinding(scheme, stateId, sourceActionId) {
    if (sourceActionId !== "leftClick") {
      return {
        cursorStateId: stateId,
        actionId: sourceActionId,
        inheritedFromDefault: false,
      };
    }

    const mergedCursorStates = getMergedCursorStates(scheme);
    const defaultActionId = mergedCursorStates?.default?.actionId || "leftClick";
    const stateConfig = mergedCursorStates?.[stateId] || {};
    const inheritedFromDefault = stateId !== "default" && stateConfig.mode !== "override";
    const actionId = inheritedFromDefault ? defaultActionId : (stateConfig.actionId || defaultActionId || sourceActionId);

    return {
      cursorStateId: stateId,
      actionId,
      inheritedFromDefault,
    };
  }

  function getEffectiveCursorStateConfig(scheme, stateId) {
    const mergedCursorStates = getMergedCursorStates(scheme);
    const defaultState = mergedCursorStates?.default || null;
    const stateConfig = mergedCursorStates?.[stateId] || null;
    if (!stateConfig) return defaultState;
    if (stateId === "default" || stateConfig.mode === "override") return stateConfig;
    return defaultState;
  }

  function resolveCursorStateId(target) {
    if (!(target instanceof Element)) return "default";
    const cursorValue = window.getComputedStyle(target).cursor || "";
    if (cursorValue === "pointer") return "pointer";
    if (cursorValue === "text" || cursorValue === "vertical-text") return "text";
    if (cursorValue === "help") return "help";
    if (cursorValue === "wait" || cursorValue === "progress") return "wait";
    if (cursorValue === "not-allowed" || cursorValue === "no-drop") return "notAllowed";
    if (target.closest(TEXT_EDITABLE_SELECTOR)) return "text";
    if (target.closest(":disabled,[aria-disabled='true']")) return "notAllowed";
    if (target.closest(INTERACTIVE_SELECTOR)) return "pointer";
    return "default";
  }

  function isInteractiveTarget(target) {
    return target instanceof Element ? Boolean(target.closest(INTERACTIVE_SELECTOR)) : false;
  }

  function isButtonOrLinkTarget(target) {
    return target instanceof Element ? Boolean(target.closest("a,button,[role='button']")) : false;
  }

  function matchesTriggerZone(target, triggerZone, event) {
    if (!triggerZone) return true;

    if (triggerZone.includes("按钮和链接")) return isButtonOrLinkTarget(target);
    if (triggerZone.includes("可交互元素")) return isInteractiveTarget(target);
    if (triggerZone.includes("空白区域")) return !isInteractiveTarget(target);
    if (triggerZone.includes("内容卡片")) return target instanceof Element ? Boolean(target.closest("article,section,li,div")) : false;
    if (triggerZone.includes("仅向上滚动")) return event?.deltaY < 0;
    if (triggerZone.includes("仅向下滚动")) return event?.deltaY > 0;

    return true;
  }

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

  function getActionTimingMs(actionId, actionConfig) {
    const rawValue = Number(actionConfig?.holdMs);
    const value = Number.isFinite(rawValue) ? rawValue : 0;

    if (actionId === "leftClick" || actionId === "rightClick") {
      return value === 420 ? 0 : Math.max(0, Math.min(320, value));
    }
    if (actionId === "doubleClick") {
      return value === 420 ? 320 : Math.max(180, Math.min(520, value || 320));
    }
    if (actionId === "wheel") {
      return value === 420 ? 180 : Math.max(80, Math.min(520, value || 180));
    }
    if (actionId === "hover") {
      return value === 420 ? 220 : Math.max(80, Math.min(700, value || 220));
    }
    if (actionId === "longPress") {
      return Math.max(120, Math.min(900, value || 420));
    }
    return Math.max(0, value);
  }

  function scheduleActionTrigger(actionId, coords, scheme, delayMs, options = {}) {
    const run = () => triggerAction(actionId, coords, scheme, options);
    if (!delayMs) {
      run();
      return;
    }
    window.setTimeout(run, delayMs);
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
    if (!actionConfig.textEnabled) return "";

    if (actionConfig.textKind === "文本飘字") {
      const tags = getOrderedTextTags(actionConfig);
      if (!tags.length) return "";
      if (actionConfig.textTagPlayMode === "随机显示") {
        return tags[(runIndex * 7 + actionId.length) % tags.length];
      }
      return tags[(runIndex - 1) % tags.length];
    }

    const numberValue = actionConfig.comboEnabled ? runIndex : 1;
    const formattedNumber = formatNumber(actionConfig.textStyle, numberValue);
    if (actionConfig.textMode === "模板模式") {
      return (actionConfig.textTemplate || "${number}").replaceAll("${number}", formattedNumber);
    }
    if (actionConfig.textContent) return actionConfig.textContent.replaceAll("${number}", formattedNumber);
    return `+${formattedNumber}`;
  }

  function getParticleColor(actionConfig, index) {
    if (actionConfig.particleColorMode === "跟随飘字色") {
      return hexToRgba(actionConfig.textColor, (actionConfig.particleOpacity || 88) / 100);
    }
    if (actionConfig.particleColorMode === "随机轻变化") {
      const palette = ["#FDBA74", "#FDE68A", "#86EFAC", "#93C5FD", "#F9A8D4"];
      return hexToRgba(palette[index % palette.length], (actionConfig.particleOpacity || 88) / 100);
    }
    return hexToRgba("#F59E0B", (actionConfig.particleOpacity || 88) / 100);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
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
      html.${HIDE_CURSOR_CLASS},
      html.${HIDE_CURSOR_CLASS} * {
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
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      ensureStyles();
      root = document.createElement("div");
      root.id = ROOT_ID;
      document.documentElement.append(root);
    }
    return root;
  }

  function ensureStateCursorNode() {
    if (stateCursorNode && stateCursorImg) return stateCursorNode;
    stateCursorNode = document.createElement("div");
    stateCursorNode.className = "cd-state-cursor";
    stateCursorNode.hidden = true;
    stateCursorImg = document.createElement("img");
    stateCursorImg.alt = "";
    stateCursorImg.draggable = false;
    stateCursorNode.append(stateCursorImg);
    ensureRoot().append(stateCursorNode);
    return stateCursorNode;
  }

  function clearStateCursorOverlay() {
    document.documentElement.classList.remove(HIDE_CURSOR_CLASS);
    if (stateCursorNode) {
      stateCursorNode.hidden = true;
    }
  }

  function syncStateCursorOverlay(event) {
    if (!isCurrentSiteEnabled()) {
      clearStateCursorOverlay();
      return;
    }

    const target = event?.target instanceof Element ? event.target : document.body;
    const scheme = getActiveScheme();
    const stateId = resolveCursorStateId(target);
    const cursorState = getEffectiveCursorStateConfig(scheme, stateId);

    if (!cursorState?.imageDataUrl) {
      clearStateCursorOverlay();
      return;
    }

    const cursorNode = ensureStateCursorNode();
    const cursorSize = Math.max(24, Math.min(96, cursorState.size || 48));
    cursorNode.hidden = false;
    cursorNode.style.width = `${cursorSize}px`;
    cursorNode.style.height = `${cursorSize}px`;
    cursorNode.style.transform = `translate3d(${event.clientX - (cursorState.hotspotX || 0)}px, ${event.clientY - (cursorState.hotspotY || 0)}px, 0)`;

    if (stateCursorImg.src !== cursorState.imageDataUrl) {
      stateCursorImg.src = cursorState.imageDataUrl;
    }

    document.documentElement.classList.add(HIDE_CURSOR_CLASS);
  }

  function animateNode(node, keyframes, options) {
    if (activeEffects >= getMaxActiveEffects()) return;

    const animationOptions = typeof options === "number"
      ? { duration: options, easing: "ease-out", delay: 0 }
      : {
          duration: options?.duration || 0,
          easing: options?.easing || "ease-out",
          delay: options?.delay || 0,
        };

    activeEffects += 1;
    ensureRoot().append(node);
    const animation = node.animate(keyframes, {
      duration: animationOptions.duration,
      easing: animationOptions.easing,
      delay: animationOptions.delay,
      fill: "forwards",
    });

    const cleanup = () => {
      node.remove();
      activeEffects = Math.max(0, activeEffects - 1);
    };

    animation.addEventListener("finish", cleanup, { once: true });
    animation.addEventListener("cancel", cleanup, { once: true });
  }

  function getAudioContext() {
    if (audioContext) return audioContext;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
    return audioContext;
  }

  function getPageMediaElements() {
    return Array.from(document.querySelectorAll("audio,video"));
  }

  function scheduleMediaRestore(media, durationMs) {
    const current = mediaDuckState.get(media);
    if (!current) return;
    if (current.restoreTimer) {
      window.clearTimeout(current.restoreTimer);
    }
    current.restoreTimer = window.setTimeout(() => {
      const latest = mediaDuckState.get(media);
      if (!latest) return;
      media.volume = latest.originalVolume;
      media.muted = latest.originalMuted;
      mediaDuckState.delete(media);
    }, durationMs);
  }

  function duckPageMedia(actionConfig) {
    const blendMode = actionConfig.soundBlendMode || "保持原音量";
    if (blendMode === "保持原音量") return;

    // Limitation: we can only control native <audio>/<video> elements in the page document.
    const durationMs = Math.max(900, (actionConfig.soundFadeOut || 120) + (actionConfig.soundDelay || 0) + 780);
    const targetVolume = blendMode === "仅插件音效" ? 0 : 0.12;

    getPageMediaElements().forEach((media) => {
      if (!(media instanceof HTMLMediaElement)) return;
      if (media.paused && media.readyState < 2) return;

      if (!mediaDuckState.has(media)) {
        mediaDuckState.set(media, {
          originalVolume: media.volume,
          originalMuted: media.muted,
          restoreTimer: null,
        });
      }

      const state = mediaDuckState.get(media);
      if (blendMode === "仅插件音效") {
        media.muted = true;
      } else {
        media.muted = false;
        media.volume = Math.min(state.originalVolume, targetVolume);
      }
      scheduleMediaRestore(media, durationMs);
      mediaDuckState.set(media, state);
    });
  }

  function getSoundPreset(soundFile) {
    if (soundFile === "woodfish-deep.wav") {
      return {
        waveform: "triangle",
        frequency: 196,
        overtone: 294,
        durationMs: 240,
        decay: 0.14,
      };
    }
    if (soundFile === "tick-light.wav") {
      return {
        waveform: "square",
        frequency: 620,
        overtone: 930,
        durationMs: 90,
        decay: 0.04,
      };
    }
    return {
      waveform: "sine",
      frequency: 262,
      overtone: 392,
      durationMs: 180,
      decay: 0.09,
    };
  }

  function playSound(actionConfig, actionId) {
    if (!actionConfig.sound || (actionConfig.volume || 0) <= 0) return;

    const now = Date.now();
    const mode = actionConfig.soundTriggerMode || "每次触发";
    const throttleMs = mode === "节流播放" ? Math.max(140, actionConfig.soundDelay || 0, actionConfig.holdMs || 0) : 0;
    if (throttleMs && now - (lastSoundAtByAction[actionId] || 0) < throttleMs) return;
    lastSoundAtByAction[actionId] = now;
    duckPageMedia(actionConfig);

    const context = getAudioContext();
    if (!context) return;

    try {
      if (context.state === "suspended") {
        context.resume().catch(() => {});
      }

      const preset = getSoundPreset(actionConfig.soundFile);
      const startAt = context.currentTime + ((actionConfig.soundDelay || 0) / 1000);
      const duration = Math.max(0.06, ((actionConfig.soundFadeOut || preset.durationMs) || preset.durationMs) / 1000);
      const gainNode = context.createGain();
      const baseGain = Math.min(1, Math.max(0, (actionConfig.volume || 0) / 100) * 0.22);
      const playbackRate = Math.max(0.5, (actionConfig.playbackRate || 100) / 100);
      const stackBoost = mode === "连击叠加" ? Math.min(1.18, 1 + ((actionRunCounts[actionId] || 1) - 1) * 0.06) : 1;
      gainNode.connect(context.destination);
      gainNode.gain.setValueAtTime(0.0001, startAt);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, baseGain), startAt + 0.012);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration + preset.decay);

      [preset.frequency, preset.overtone].forEach((baseFrequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = preset.waveform;
        oscillator.frequency.setValueAtTime(baseFrequency * playbackRate * stackBoost * (index === 1 ? 1.02 : 1), startAt);
        oscillator.connect(gainNode);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration + preset.decay);
      });
    } catch {
      // Audio is best-effort in content scripts; visual effects should keep working.
    }
  }

  function getCursorOverrideKind(cursorOverride) {
    if (cursorOverride === "木鱼（增强态）") return "boost";
    if (cursorOverride === "木鱼（按压态）") return "press";
    if (cursorOverride === "木鱼（继承默认）") return "woodfish";
    if (cursorOverride === "切换到 pointer") return "pointer";
    return null;
  }

  function renderCursorOverride(x, y, actionConfig) {
    const cursorKind = getCursorOverrideKind(actionConfig.cursorOverride);
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
    const size = actionConfig.cursorSize || 48;
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

    const shake = Math.max(0, actionConfig.shake || 0) / 100;
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
    if (!actionConfig.textEnabled) return;

    const content = getActionText(actionConfig, actionId, runIndex);
    if (!content) return;

    const node = document.createElement("div");
    node.className = "cd-effect cd-text";
    node.textContent = content;
    node.style.left = `${x + (actionConfig.textOffsetX || 0)}px`;
    node.style.top = `${y + (actionConfig.textOffsetY || -48)}px`;
    node.style.color = hexToRgba(actionConfig.textColor || "#ec4899", (actionConfig.textOpacity || 100) / 100);
    node.style.fontSize = `${actionConfig.fontSize || 22}px`;
    node.style.fontWeight = String(getTextWeight(actionConfig));
    node.style.webkitTextStroke = actionConfig.textOutlineWidth
      ? `${actionConfig.textOutlineWidth}px ${hexToRgba("#ffffff", 0.82)}`
      : "";
    node.style.textShadow = actionConfig.textShadow === "清晰"
      ? `0 8px 18px ${hexToRgba(actionConfig.textColor || "#ec4899", 0.32)}`
      : actionConfig.textShadow === "柔和"
        ? `0 4px 12px ${hexToRgba(actionConfig.textColor || "#ec4899", 0.22)}`
        : "none";

    animateNode(
      node,
      [
        { opacity: 0, transform: "translate3d(-50%, -32%, 0) scale(0.92)" },
        { opacity: 1, transform: "translate3d(-50%, -50%, 0) scale(1)" },
        { opacity: 0, transform: "translate3d(-50%, -96%, 0) scale(1.02)" },
      ],
      {
        duration: actionConfig.textDuration || 950,
        easing: getAnimationEasing(actionConfig.textEasing),
      }
    );
  }

  function renderRipple(x, y, actionConfig) {
    if (!actionConfig.ripple) return;

    const easing = getAnimationEasing(actionConfig.rippleEasing);
    const size = actionConfig.rippleSize || 88;
    const lineWidth = actionConfig.rippleLineWidth || 2;
    const opacity = (actionConfig.rippleOpacity || 72) / 100;
    const color = hexToRgba("#34D399", opacity);
    const duration = actionConfig.rippleDuration || 820;
    const style = actionConfig.rippleStyle || "单环";

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

  function renderParticles(x, y, actionConfig) {
    if (!actionConfig.particle) return;

    const count = Math.min(actionConfig.particleCount || 0, 40);
    if (!count) return;

    for (let index = 0; index < count; index += 1) {
      let startAngle = 0;
      let sweep = Math.PI * 2;

      if (actionConfig.particleDirection === "向上喷发") {
        startAngle = -Math.PI * 0.95;
        sweep = Math.PI * 0.9;
      } else if (actionConfig.particleDirection === "沿点击方向") {
        startAngle = -Math.PI * 0.38;
        sweep = Math.PI * 0.76;
      }

      const angle = startAngle + (count === 1 ? 0 : (index / (count - 1)) * sweep);
      const distance = Math.max(16, (actionConfig.particleSpread || 52) * (0.52 + index / Math.max(count * 1.4, 1)));
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      const node = document.createElement("span");
      node.className = "cd-effect cd-particle";
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      const baseSize = Math.max(4, (actionConfig.particleSize || 10) * (0.52 + (index % 4) * 0.1));
      const particleStyle = actionConfig.particleStyle || "点状粒子";
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
          duration: actionConfig.particleDuration || 760,
          easing: particleStyle === "火花" ? "cubic-bezier(0.22, 1, 0.36, 1)" : "ease-out",
        }
      );
    }
  }

  function triggerAction(sourceActionId, coords, scheme, options = {}) {
    if (!isCurrentSiteEnabled()) return;

    const targetScheme = scheme || getActiveScheme();
    const sourceActionConfig = getActionConfig(targetScheme, sourceActionId);
    if (!sourceActionConfig) return;
    if (!matchesTriggerZone(coords.target, sourceActionConfig.triggerZone, coords.event)) return;

    const resolvedActionId = options.resolvedActionId || getCursorStateBinding(targetScheme, resolveCursorStateId(coords.target), sourceActionId).actionId;
    const actionConfig = getActionConfig(targetScheme, resolvedActionId);
    if (!actionConfig) return;
    if (!actionConfig.textEnabled && !actionConfig.particle && !actionConfig.ripple && !actionConfig.sound && !getCursorOverrideKind(actionConfig.cursorOverride)) return;

    const now = Date.now();
    const throttleMs = options.throttleMs ?? (sourceActionId === "wheel" || sourceActionId === "hover" ? Math.max(80, sourceActionConfig.holdMs || 80) : 40);
    if (!options.force && now - (lastTriggerAtByAction[sourceActionId] || 0) < throttleMs) return;
    lastTriggerAtByAction[sourceActionId] = now;

    const runIndex = (actionRunCounts[resolvedActionId] || 0) + 1;
    actionRunCounts[resolvedActionId] = runIndex;
    renderRipple(coords.x, coords.y, actionConfig);
    renderParticles(coords.x, coords.y, actionConfig);
    renderText(coords.x, coords.y, actionConfig, resolvedActionId, runIndex);
    renderCursorOverride(coords.x, coords.y, actionConfig);
    playSound(actionConfig, resolvedActionId);
  }

  function makeCoordsFromEvent(event) {
    return {
      x: event.clientX,
      y: event.clientY,
      target: event.target,
      event,
    };
  }

  function handleLeftPointerDown(event) {
    if (event.button !== 0) return;
    const scheme = getActiveScheme();
    const leftClickConfig = getActionConfig(scheme, "leftClick");
    if (leftClickConfig?.triggerTiming === "按下时") {
      scheduleActionTrigger("leftClick", makeCoordsFromEvent(event), scheme, getActionTimingMs("leftClick", leftClickConfig));
    }

    const doubleClickConfig = getActionConfig(scheme, "doubleClick");
    const doubleClickInterval = getActionTimingMs("doubleClick", doubleClickConfig);
    const now = Date.now();
    if (doubleClickConfig?.triggerTiming === "第二次按下时") {
      if (now - lastLeftPointerDownAt <= doubleClickInterval) {
        triggerAction("doubleClick", makeCoordsFromEvent(event), scheme, { throttleMs: doubleClickInterval });
        lastLeftPointerDownAt = 0;
      } else {
        lastLeftPointerDownAt = now;
      }
    } else {
      lastLeftPointerDownAt = now;
    }

    const longPressConfig = getActionConfig(scheme, "longPress");
    if (!longPressConfig || !matchesTriggerZone(event.target, longPressConfig.triggerZone, event)) return;

    longPressState = {
      startedAt: Date.now(),
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      target: event.target,
      scheme,
      triggered: false,
      releaseMode: longPressConfig.triggerTiming === "松开后触发",
      thresholdMs: getActionTimingMs("longPress", longPressConfig),
    };

    longPressState.timeoutId = window.setTimeout(() => {
      if (!longPressState) return;
      longPressState.triggered = true;
      if (!longPressState.releaseMode) {
        triggerAction("longPress", { x: longPressState.x, y: longPressState.y, target: longPressState.target }, longPressState.scheme, {
          throttleMs: longPressState.thresholdMs,
        });
      }
    }, longPressState.thresholdMs);
  }

  function finishLongPress(event) {
    if (!longPressState) return;
    window.clearTimeout(longPressState.timeoutId);
    const duration = Date.now() - longPressState.startedAt;
    if (longPressState.releaseMode && duration >= longPressState.thresholdMs) {
      triggerAction(
        "longPress",
        {
          x: event?.clientX ?? longPressState.x,
          y: event?.clientY ?? longPressState.y,
          target: event?.target ?? longPressState.target,
          event,
        },
        longPressState.scheme,
        { throttleMs: longPressState.thresholdMs }
      );
    }
    longPressState = null;
  }

  function cancelLongPress() {
    if (!longPressState) return;
    window.clearTimeout(longPressState.timeoutId);
    longPressState = null;
  }

  function handlePointerUp(event) {
    if (event.button === 0) {
      const scheme = getActiveScheme();
      const leftClickConfig = getActionConfig(scheme, "leftClick");
      if (leftClickConfig?.triggerTiming !== "按下时") {
        scheduleActionTrigger("leftClick", makeCoordsFromEvent(event), scheme, getActionTimingMs("leftClick", leftClickConfig));
      }

      const doubleClickConfig = getActionConfig(scheme, "doubleClick");
      const doubleClickInterval = getActionTimingMs("doubleClick", doubleClickConfig);
      const now = Date.now();
      if (doubleClickConfig?.triggerTiming !== "第二次按下时") {
        if (now - lastLeftPointerUpAt <= doubleClickInterval) {
          triggerAction("doubleClick", makeCoordsFromEvent(event), scheme, { throttleMs: doubleClickInterval });
          lastLeftPointerUpAt = 0;
        } else {
          lastLeftPointerUpAt = now;
        }
      } else {
        lastLeftPointerUpAt = now;
      }
      finishLongPress(event);
    }
  }

  function handlePointerCancel() {
    cancelLongPress();
  }

  function handleRightPointerDown(event) {
    if (event.button !== 2) return;
    const scheme = getActiveScheme();
    const actionConfig = getActionConfig(scheme, "rightClick");
    if (actionConfig?.triggerTiming === "按下时") {
      scheduleActionTrigger("rightClick", makeCoordsFromEvent(event), scheme, getActionTimingMs("rightClick", actionConfig));
    }
  }

  function handleContextMenu(event) {
    const scheme = getActiveScheme();
    const actionConfig = getActionConfig(scheme, "rightClick");
    if (actionConfig?.triggerTiming !== "按下时") {
      scheduleActionTrigger("rightClick", makeCoordsFromEvent(event), scheme, getActionTimingMs("rightClick", actionConfig));
    }
  }

  function handleDoubleClick(event) {
    if (event.button !== 0) return;
  }

  function handleWheel(event) {
    const scheme = getActiveScheme();
    const actionConfig = getActionConfig(scheme, "wheel");
    if (!matchesTriggerZone(event.target, actionConfig?.triggerZone, event)) return;
    const timingMs = getActionTimingMs("wheel", actionConfig);
    const now = Date.now();
    const isNewBurst = now - lastWheelEventAt > timingMs;
    lastWheelEventAt = now;
    if (actionConfig?.triggerTiming === "滚动开始时" && !isNewBurst) return;
    triggerAction("wheel", makeCoordsFromEvent(event), scheme, {
      throttleMs: actionConfig?.triggerTiming === "连续滚动中" ? timingMs : 0,
    });
  }

  function handlePointerOver(event) {
    syncStateCursorOverlay(event);
    const scheme = getActiveScheme();
    const actionConfig = getActionConfig(scheme, "hover");
    if (!actionConfig || !matchesTriggerZone(event.target, actionConfig.triggerZone, event)) return;

    window.clearTimeout(hoverTimeoutId);
    hoverTarget = event.target;

    if (actionConfig.triggerTiming === "进入时") {
      triggerAction("hover", makeCoordsFromEvent(event), scheme, { throttleMs: 120 });
      return;
    }

    const hoverDelay = getActionTimingMs("hover", actionConfig);
    hoverTimeoutId = window.setTimeout(() => {
      if (hoverTarget !== event.target) return;
      triggerAction("hover", makeCoordsFromEvent(event), scheme, {
        throttleMs: hoverDelay,
      });
    }, hoverDelay);
  }

  function handlePointerOut(event) {
    if (!event.relatedTarget) {
      clearStateCursorOverlay();
    }
    if (!hoverTarget) return;
    if (event.target === hoverTarget || (event.target instanceof Element && hoverTarget instanceof Element && event.target.contains(hoverTarget))) {
      window.clearTimeout(hoverTimeoutId);
      hoverTarget = null;
    }
  }

  async function syncConfigFromStorage() {
    try {
      const result = await chrome.storage.local.get([CONFIG_STORAGE_KEY, LEGACY_ENABLED_STORAGE_KEY]);
      const storedConfig = result[CONFIG_STORAGE_KEY];
      const nextConfig = normalizeConfig(storedConfig || {
        ...DEFAULT_CONFIG,
        enabled: result[LEGACY_ENABLED_STORAGE_KEY] !== false,
      });
      const assetKeys = (nextConfig.themePacks || []).flatMap((themePack) =>
        Object.keys(themePack.cursorStates || {}).map((stateId) => buildCursorAssetStorageKey(themePack.id, stateId))
      );
      const assetEntries = assetKeys.length ? await chrome.storage.local.get(assetKeys) : {};
      config = withResolvedCursorAssets(nextConfig, assetEntries);
      if (!storedConfig || (CONFIG_RUNTIME.needsMigration && CONFIG_RUNTIME.needsMigration(storedConfig))) {
        await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: config });
      }
      clearStateCursorOverlay();
    } catch {
      config = normalizeConfig(config);
      clearStateCursorOverlay();
    }
  }

  function previewAtViewportCenter(schemeId, previewScheme, actionId) {
    if (!isCurrentSiteEnabled()) return;
    const resolvedScheme = previewScheme || getSchemeById(schemeId || config.activeSchemeId);
    const x = Math.round(window.innerWidth / 2);
    const y = Math.round(window.innerHeight / 2);
    triggerAction(actionId || "leftClick", { x, y, target: document.body }, resolvedScheme, {
      force: true,
      resolvedActionId: actionId || "leftClick",
      throttleMs: 0,
    });
  }

  ensureRoot();
  syncConfigFromStorage();

  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      const changedKeys = Object.keys(changes);
      if (
        changedKeys.includes(CONFIG_STORAGE_KEY)
        || changedKeys.includes(LEGACY_ENABLED_STORAGE_KEY)
        || changedKeys.some((key) => key.startsWith(CURSOR_ASSET_STORAGE_KEY_PREFIX))
      ) {
        syncConfigFromStorage();
      }
    });
  } catch {
    config = normalizeConfig(config);
  }

  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "CURSORDANCE_PREVIEW_SCHEME") {
        previewAtViewportCenter(message.schemeId, message.scheme, message.actionId);
        sendResponse({ ok: true });
      }
      return false;
    });
  } catch {
    // Keep the runtime usable even if extension messaging is unavailable.
  }

  document.addEventListener("pointerdown", handleLeftPointerDown, true);
  document.addEventListener("pointerdown", handleRightPointerDown, true);
  document.addEventListener("pointermove", syncStateCursorOverlay, { capture: true, passive: true });
  document.addEventListener("pointerup", handlePointerUp, true);
  document.addEventListener("pointercancel", handlePointerCancel, true);
  document.addEventListener("contextmenu", handleContextMenu, true);
  document.addEventListener("dblclick", handleDoubleClick, true);
  document.addEventListener("wheel", handleWheel, { capture: true, passive: true });
  document.addEventListener("pointerover", handlePointerOver, true);
  document.addEventListener("pointerout", handlePointerOut, true);
  window.addEventListener("blur", clearStateCursorOverlay);
})();
