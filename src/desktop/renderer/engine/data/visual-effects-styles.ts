/**
 * Visual-effects CSS stylesheet — extracted from visual-effects.ts.
 *
 * The overlay root ID is injected at runtime, so this module exports a
 * builder function rather than a plain string. Desktop native-cursor hiding
 * is owned by the main-process helper instead of renderer CSS.
 */

export function buildVisualEffectsCSS(rootId: string): string {
  return `
        #${rootId} {
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
        .cd-key-feedback {
          text-align: center;
        }
      `;
}
