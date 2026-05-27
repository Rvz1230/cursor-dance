(function registerSiteMatcher(globalThis) {
  var modules = globalThis.CursorDanceContentModules || (globalThis.CursorDanceContentModules = {});

  /**
   * @param {string} host  — normalized hostname (trimmed, lowercase)
   * @param {string} path  — path portion of the URL (e.g. "/foo/bar")
   * @param {{ type: string, value: string }} pattern
   * @returns {boolean}
   */
  function matchPattern(host, path, pattern) {
    if (!pattern || typeof pattern !== "object" || !pattern.type || typeof pattern.value !== "string") {
      return false;
    }

    var h = typeof host === "string" ? host.trim().toLowerCase() : "";
    var v = pattern.value.trim();
    if (!h || !v) return false;

    switch (pattern.type) {
      case "exact":
        return h === v.toLowerCase();

      case "glob": {
        // Convert glob pattern to regex:
        //   **  → .*  (multi-segment wildcard)
        //   *   → [^.]* (single-segment wildcard)
        //   .   → \.
        //   ?   → . (single char)
        var reStr = "^" + v.toLowerCase()
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*\*/g, "<<<GLOB_STAR_STAR>>>")
          .replace(/\*/g, "[^.]*")
          .replace(/<<<GLOB_STAR_STAR>>>/g, ".*")
          .replace(/\?/g, ".") + "$";
        try {
          return new RegExp(reStr).test(h);
        } catch (_) {
          return false;
        }
      }

      case "path": {
        var parts = v.split("/");
        var patternHost = (parts[0] || "").toLowerCase();
        var patternPath = "/" + parts.slice(1).join("/");
        if (h !== patternHost) {
          // www. equivalence
          var alt = h.replace(/^www\./, "");
          if (alt !== patternHost.replace(/^www\./, "")) return false;
        }
        if (typeof path === "string") {
          var p = path.trim();
          // Ensure leading slash for consistency
          if (p && !p.startsWith("/")) p = "/" + p;
          return p.startsWith(patternPath) || p === patternPath;
        }
        return true; // path not provided — match on host alone
      }

      default:
        return false;
    }
  }

  /**
   * @param {Array} rules  — ordered list of site rule objects
   * @param {string} host  — normalized hostname
   * @param {string} path  — URL path
   * @returns {null|string|{ enable: boolean, theme?: string }}
   */
  function resolveSiteRule(rules, host, path) {
    if (!Array.isArray(rules) || rules.length === 0) return null;

    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (!rule || rule.enabled === false) continue;
      if (!matchPattern(host, path, rule.pattern)) continue;

      if (rule.action === "disable") return "disable";
      if (rule.action && typeof rule.action === "object" && rule.action.enable) {
        return {
          enable: true,
          theme: typeof rule.action.theme === "string" ? rule.action.theme : undefined,
        };
      }
    }

    return null;
  }

  modules.matchPattern = matchPattern;
  modules.resolveSiteRule = resolveSiteRule;
})(window);
