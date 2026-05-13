const SUPPORTED_IMAGE_EFFECT_TYPES = ["image/png", "image/webp", "image/svg+xml"];

function svgToDataUrl(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createPresetDataUrl({ background, body }) {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none">
      ${background}
      ${body}
    </svg>
  `);
}

export function getImageEffectPresetCards() {
  return [
    {
      id: "seal",
      label: "落章印记",
      hint: "适合轻提示或盖章感。",
      asset: {
        imageDataUrl: createPresetDataUrl({
          background: `
            <defs>
              <radialGradient id="seal-grad" cx="35%" cy="30%" r="80%">
                <stop offset="0%" stop-color="#fca5a5"/>
                <stop offset="100%" stop-color="#be123c"/>
              </radialGradient>
            </defs>
          `,
          body: `
            <circle cx="48" cy="48" r="28" fill="url(#seal-grad)" fill-opacity="0.94"/>
            <circle cx="48" cy="48" r="20" stroke="#fff7ed" stroke-width="3" stroke-dasharray="4 4" stroke-linecap="round" opacity="0.85"/>
            <path d="M34 50.5 43 59l20-22" stroke="#fff7ed" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
          `,
        }),
      },
    },
    {
      id: "spark-badge",
      label: "高亮徽记",
      hint: "更像点击瞬间弹出的贴纸。",
      asset: {
        imageDataUrl: createPresetDataUrl({
          background: `
            <defs>
              <linearGradient id="spark-grad" x1="18" y1="18" x2="78" y2="78" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#fde68a"/>
                <stop offset="100%" stop-color="#f59e0b"/>
              </linearGradient>
            </defs>
          `,
          body: `
            <path d="M48 12 56.6 33.8 80 35.9 62.3 51.1 67.7 73.8 48 61.8 28.3 73.8 33.7 51.1 16 35.9 39.4 33.8 48 12Z" fill="url(#spark-grad)"/>
            <circle cx="48" cy="48" r="12" fill="#fff7ed" fill-opacity="0.88"/>
            <path d="M48 40v16M40 48h16" stroke="#b45309" stroke-width="5" stroke-linecap="round"/>
          `,
        }),
      },
    },
  ];
}

export function validateImageEffectFile(file, maxBytes) {
  if (!file) return "没有读取到文件。";
  if (!SUPPORTED_IMAGE_EFFECT_TYPES.includes(file.type)) {
    return "当前只支持 PNG / WebP / SVG。";
  }
  if (file.size > maxBytes) {
    return `图片过大，请控制在 ${Math.round(maxBytes / 1024)} KB 以内。`;
  }
  return "";
}
