(function registerContentDiagnostics(globalThis) {
  const modules = globalThis.CursorDanceContentModules || (globalThis.CursorDanceContentModules = {});

  modules.createDiagnostics = function createDiagnostics(runtime) {
    const { window } = runtime;
    const STORAGE_KEY = "cursordance.debug";
    const EVENT_NAME = "cursordance:diagnostic";
    const CHANNEL_NAME = "cursordance.local-preview";
    const CHANNEL_MESSAGE_TYPE = "diagnostic-event";
    const DIAGNOSTIC_EVENTS_STORAGE_KEY = "cursordance.diagnosticEvents";
    const MAX_EVENTS = 200;
    const STORAGE_FLUSH_MS = 300;
    const eventBuffer = [];
    let diagnosticsChannel = null;
    let _debugEnabled = null;
    let storageFlushTimer = null;
    const chromeApi = globalThis.chrome ?? null;

    function parseBooleanFlag(value) {
      if (value === true) return true;
      if (typeof value !== "string") return false;
      return ["1", "true", "on", "yes", "debug"].includes(value.trim().toLowerCase());
    }

    function canUseWindowStorage(storage) {
      try {
        const probeKey = "__cursordance_debug_probe__";
        storage.setItem(probeKey, "1");
        storage.removeItem(probeKey);
        return true;
      } catch {
        return false;
      }
    }

    function readStorageFlag() {
      try {
        const storage = window.localStorage;
        if (!canUseWindowStorage(storage)) return false;
        return parseBooleanFlag(storage.getItem(STORAGE_KEY));
      } catch {
        return false;
      }
    }

    function readQueryFlag() {
      try {
        const url = new URL(window.location.href);
        return parseBooleanFlag(url.searchParams.get("cursordance-debug"));
      } catch {
        return false;
      }
    }

    function computeSyncEnabled() {
      return Boolean(window.__CURSORDANCE_DEBUG__ || readQueryFlag() || readStorageFlag());
    }

    function isEnabled() {
      return _debugEnabled;
    }

    // Sync init: try local sources first so the first isEnabled() call is deterministic.
    _debugEnabled = computeSyncEnabled();

    // Async: override from chrome.storage if the workbench set a value.
    (function initStorageBridge() {
      const chromeApi = globalThis.chrome ?? null;
      if (chromeApi?.storage?.onChanged) {
        chromeApi.storage.onChanged.addListener(function handleDebugStorageChange(changes, areaName) {
          if (areaName !== "local" || !(STORAGE_KEY in changes)) return;
          _debugEnabled = parseBooleanFlag(changes[STORAGE_KEY].newValue);
        });
        chromeApi.storage.local.get([STORAGE_KEY]).then(function (result) {
          if (STORAGE_KEY in result) {
            _debugEnabled = parseBooleanFlag(result[STORAGE_KEY]);
          }
        }).catch(function () {
          // Ignore — keep sync value.
        });
      }

      // BroadcastChannel fallback for local dev (no chrome.storage).
      if (typeof window.BroadcastChannel === "function") {
        try {
          var debugChannel = new window.BroadcastChannel(CHANNEL_NAME);
          debugChannel.addEventListener("message", function (event) {
            var message = event.data || {};
            if (message.type === "toggle-debug") {
              _debugEnabled = parseBooleanFlag(message.enabled);
            }
          });
        } catch (_) {
          // Ignore BroadcastChannel setup failures.
        }
      }
    })();

    function normalizeClassName(className) {
      if (typeof className === "string") return className.trim();
      if (typeof className?.baseVal === "string") return className.baseVal.trim();
      return "";
    }

    function describeTarget(target) {
      if (!(target instanceof Element)) {
        return {
          type: target == null ? "null" : typeof target,
        };
      }

      const classes = normalizeClassName(target.className)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3);

      return {
        selector: `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ""}${classes.map((name) => `.${name}`).join("")}`,
        role: target.getAttribute("role") || null,
        text: target.textContent?.trim()?.slice(0, 48) || null,
      };
    }

    function describeMedia(media) {
      return {
        target: describeTarget(media),
        paused: Boolean(media?.paused),
        muted: Boolean(media?.muted),
        volume: typeof media?.volume === "number" ? Number(media.volume.toFixed(3)) : null,
        readyState: Number.isFinite(media?.readyState) ? media.readyState : null,
        currentSrc: media?.currentSrc || media?.src || null,
      };
    }

    function scheduleStorageFlush() {
      if (!chromeApi?.storage?.local) return;
      if (storageFlushTimer) return;
      storageFlushTimer = window.setTimeout(function () {
        storageFlushTimer = null;
        try {
          chromeApi.storage.local.set({ [DIAGNOSTIC_EVENTS_STORAGE_KEY]: eventBuffer.slice() });
        } catch {
          // Best-effort diagnostics persistence.
        }
      }, STORAGE_FLUSH_MS);
    }

    function log(scope, payload = {}) {
      if (!isEnabled()) return;
      const entry = {
        scope,
        at: new Date().toISOString(),
        href: window.location.href,
        ...payload,
      };

      eventBuffer.push(entry);
      if (eventBuffer.length > MAX_EVENTS) {
        eventBuffer.shift();
      }

      try {
        console.info(`[CursorDance][${scope}]`, entry);
      } catch {
        // Ignore console failures in constrained runtimes.
      }

      try {
        window.dispatchEvent(new window.CustomEvent(EVENT_NAME, { detail: entry }));
      } catch {
        // Ignore DOM event bridge failures.
      }

      try {
        if (typeof window.BroadcastChannel === "function") {
          diagnosticsChannel ??= new window.BroadcastChannel(CHANNEL_NAME);
          diagnosticsChannel.postMessage({
            type: CHANNEL_MESSAGE_TYPE,
            entry,
          });
        }
      } catch {
        // Ignore diagnostics bridge failures.
      }

      scheduleStorageFlush();
    }

    return {
      EVENT_NAME,
      STORAGE_KEY,
      isEnabled,
      log,
      describeTarget,
      describeMedia,
      getEvents() {
        return eventBuffer.slice();
      },
    };
  };
})(window);
