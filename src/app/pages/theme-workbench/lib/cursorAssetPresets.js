const SUPPORTED_CURSOR_ASSET_TYPES = ["image/png", "image/webp", "image/svg+xml"];

function svgToDataUrl(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function renderSvg({ size = 48, hotspotX = 16, hotspotY = 32, body, background = "" }) {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
      ${background}
      ${body}
      <circle cx="${hotspotX}" cy="${hotspotY}" r="1.8" fill="#ef4444" fill-opacity="0.88"/>
    </svg>
  `);
}

function getSystemPreset(stateId) {
  switch (stateId) {
    case "pointer":
      return {
        imageDataUrl: renderSvg({
          hotspotX: 14,
          hotspotY: 8,
          body: `
            <path d="M12 6c0-1.1.9-2 2-2h3c7.18 0 13 5.82 13 13v3c0 1.1-.9 2-2 2h-6.4l2.32 6.1c.4 1.07-.14 2.27-1.21 2.67l-2.1.79c-1.03.39-2.19-.1-2.62-1.11L14.6 22H14c-1.1 0-2-.9-2-2V6Z" fill="#0f172a"/>
            <path d="M16.5 8.5h.5c5.25 0 9.5 4.25 9.5 9.5v.5h-6.12l2.83 7.44-2.07.79-2.85-7.49V8.5Z" fill="#f8fafc"/>
          `,
        }),
        hotspotX: 14,
        hotspotY: 8,
        size: 48,
      };
    case "text":
      return {
        imageDataUrl: renderSvg({
          hotspotX: 24,
          hotspotY: 24,
          body: `
            <rect x="18" y="6" width="12" height="4" rx="2" fill="#0f172a"/>
            <rect x="18" y="38" width="12" height="4" rx="2" fill="#0f172a"/>
            <rect x="21.5" y="8" width="5" height="32" rx="2.5" fill="#0f172a"/>
          `,
        }),
        hotspotX: 24,
        hotspotY: 24,
        size: 48,
      };
    case "help":
      return {
        imageDataUrl: renderSvg({
          hotspotX: 24,
          hotspotY: 24,
          body: `
            <circle cx="24" cy="24" r="16" fill="#f8fafc" stroke="#0f172a" stroke-width="3"/>
            <path d="M19.7 18.6a4.9 4.9 0 0 1 8.32-3.54c1.8 1.76 1.82 4.64.04 6.44l-1.52 1.53c-.93.94-1.45 2.2-1.45 3.53V27" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
            <circle cx="24" cy="33.5" r="2.1" fill="#0f172a"/>
          `,
        }),
        hotspotX: 24,
        hotspotY: 24,
        size: 48,
      };
    case "wait":
      return {
        imageDataUrl: renderSvg({
          hotspotX: 24,
          hotspotY: 24,
          body: `
            <circle cx="24" cy="24" r="15" stroke="#0f172a" stroke-width="4" stroke-opacity="0.2"/>
            <path d="M24 9a15 15 0 0 1 15 15" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
          `,
        }),
        hotspotX: 24,
        hotspotY: 24,
        size: 48,
      };
    case "notAllowed":
      return {
        imageDataUrl: renderSvg({
          hotspotX: 24,
          hotspotY: 24,
          body: `
            <circle cx="24" cy="24" r="16" fill="#fff1f2" stroke="#be123c" stroke-width="3"/>
            <path d="M15 33 33 15" stroke="#be123c" stroke-width="4" stroke-linecap="round"/>
          `,
        }),
        hotspotX: 24,
        hotspotY: 24,
        size: 48,
      };
    case "default":
    default:
      return {
        imageDataUrl: renderSvg({
          hotspotX: 10,
          hotspotY: 8,
          body: `
            <path d="M8 4 28.5 24.5H18.8L24.5 39l-4.2 1.7-5.7-14.4-6.6 6.6V4Z" fill="#0f172a"/>
            <path d="M11.5 12.5v12.4l4.3-4.3h4.26L11.5 12.5Z" fill="#f8fafc"/>
          `,
        }),
        hotspotX: 10,
        hotspotY: 8,
        size: 48,
      };
  }
}

function getWoodfishPreset(stateId) {
  const labelMap = {
    default: "咚",
    pointer: "点",
    text: "文",
    help: "?",
    wait: "等",
    notAllowed: "停",
  };

  return {
    imageDataUrl: renderSvg({
      hotspotX: 24,
      hotspotY: 24,
      body: `
        <defs>
          <radialGradient id="woodfish-grad" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stop-color="#fcd34d"/>
            <stop offset="100%" stop-color="#b45309"/>
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="16" fill="url(#woodfish-grad)" stroke="#92400e" stroke-width="2"/>
        <text x="24" y="28" text-anchor="middle" font-size="12" font-weight="700" fill="#fff8eb" font-family="system-ui, sans-serif">${labelMap[stateId] || "咚"}</text>
      `,
    }),
    hotspotX: 24,
    hotspotY: 24,
    size: 48,
  };
}

export const CURSOR_BUILTIN_PRESET_OPTIONS = [
  { value: "system", label: "系统样例" },
  { value: "woodfish", label: "木鱼样例" },
];

export function getBuiltinCursorPresetCards(stateId) {
  return [
    {
      id: "system",
      label: "系统样例",
      hint: stateId === "default" ? "标准箭头 / I-beam" : "常见 cursor 语义",
      asset: getSystemPreset(stateId),
    },
    {
      id: "woodfish",
      label: "木鱼样例",
      hint: "演示 / 录屏",
      asset: getWoodfishPreset(stateId),
    },
  ];
}

export function createBuiltinCursorAsset(stateId, presetId) {
  if (presetId === "woodfish") {
    return getWoodfishPreset(stateId);
  }
  return getSystemPreset(stateId);
}

export function validateCursorAssetFile(file, maxBytes) {
  if (!file) return "没有读取到文件。";
  if (!SUPPORTED_CURSOR_ASSET_TYPES.includes(file.type)) {
    return "当前只支持 PNG / WebP / SVG。";
  }
  if (file.size > maxBytes) {
    return `图片过大，请控制在 ${Math.round(maxBytes / 1024)} KB 以内。`;
  }
  return "";
}
