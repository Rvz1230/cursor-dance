/**
 * 氛围动效预览层 — 工作台预览区域中展示 Creative Mouse 等效果
 */
export function AtmosphereStagePreview({ atmosphere, pointerX, pointerY, isPointerInside, stageWidth, stageHeight }) {
  const mode = atmosphere?.mode;

  if (mode !== "creative-mouse" || !isPointerInside) return null;

  // Creative Mouse 双圆点光标预览
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* 外圆 */}
      <div
        className="absolute rounded-full"
        style={{
          width: 42,
          height: 42,
          background: "rgba(255,255,255,0.6)",
          mixBlendMode: "exclusion",
          transform: `translate(${pointerX - 21}px, ${pointerY - 21}px)`,
          transition: "transform 0.08s linear",
          willChange: "transform",
        }}
      />
      {/* 内圆 */}
      <div
        className="absolute rounded-full"
        style={{
          width: 12,
          height: 12,
          background: "#4caf50",
          mixBlendMode: "exclusion",
          transform: `translate(${pointerX - 6}px, ${pointerY - 6}px)`,
          willChange: "transform",
        }}
      />
    </div>
  );
}
