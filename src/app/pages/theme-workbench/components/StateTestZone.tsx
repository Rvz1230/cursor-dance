import { useMemo, useState } from "react";
import { CURSOR_STATES, formatActionLabel } from "../model/workbenchSchema";
import { DataPill } from "./WorkbenchControls";
import { cn } from "@/components/ui/utils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const TARGET_CURSOR_SIZE = 48;

function resolveStateId(cursorValue) {
  if (cursorValue === "pointer" || cursorValue === "grab" || cursorValue === "grabbing") return "pointer";
  if (cursorValue === "text" || cursorValue === "vertical-text") return "text";
  if (cursorValue === "help") return "help";
  if (cursorValue === "wait" || cursorValue === "progress") return "wait";
  if (cursorValue === "not-allowed" || cursorValue === "no-drop") return "notAllowed";
  return "default";
}

const TEST_ZONES = [
  { id: "default", cursor: "default", label: "空白区域", hint: "cursor: default", element: "div" },
  { id: "link", cursor: "pointer", label: "一个可点击的链接", hint: "cursor: pointer", element: "a" },
  { id: "text-input", cursor: "text", label: "文本输入区域", hint: "cursor: text", element: "input" },
  { id: "disabled", cursor: "not-allowed", label: "禁用的按钮", hint: "cursor: not-allowed", element: "button", disabled: true },
  { id: "loading", cursor: "wait", label: "正在加载...", hint: "cursor: wait", element: "div" },
  { id: "help", cursor: "help", label: "需要帮助？", hint: "cursor: help", element: "div" },
];

export function StateTestZone({
  cursorStateAssets,
  cursorModes,
  cursorStateActions,
  onClose,
}) {
  const [activeCursor, setActiveCursor] = useState("default");
  const [activeZoneId, setActiveZoneId] = useState(null);
  const activeStateId = resolveStateId(activeCursor);
  const activeStateMeta = CURSOR_STATES.find((s) => s.id === activeStateId);

  const resolvedAsset = useMemo(() => {
    if (activeStateId === "default") return cursorStateAssets?.default || null;
    const mode = cursorModes?.[activeStateId];
    if (mode === "继承" || mode === "源") {
      return cursorStateAssets?.default || null;
    }
    return cursorStateAssets?.[activeStateId] || null;
  }, [activeStateId, cursorModes, cursorStateAssets]);

  const resolvedActionId = useMemo(() => {
    if (activeStateId === "default") return cursorStateActions?.default || "leftClick";
    const mode = cursorModes?.[activeStateId];
    if (mode === "继承" || mode === "源") {
      return cursorStateActions?.default || "leftClick";
    }
    return cursorStateActions?.[activeStateId] || "leftClick";
  }, [activeStateId, cursorModes, cursorStateActions]);

  function handleZoneEnter(zoneId, cursor) {
    setActiveZoneId(zoneId);
    setActiveCursor(cursor);
  }

  function handleZoneLeave() {
    setActiveZoneId(null);
    setActiveCursor("default");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-slate-900">状态测试沙箱</h3>
          <p className="mt-0.5 text-xs text-slate-500">鼠标移至下方元素，实时查看状态匹配效果</p>
        </div>
        <Button variant="ghost" className="shrink-0 rounded-xl px-2.5 text-xs" onClick={onClose}>
          <X className="mr-1 h-3.5 w-3.5" />关闭
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-600">当前状态</div>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
              {resolvedAsset?.imageDataUrl ? (
                <img src={resolvedAsset.imageDataUrl} alt="" className="h-12 w-12 object-contain" />
              ) : (
                <span className="text-2xs text-slate-400">—</span>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">
                  {activeStateMeta?.label || "默认"}
                </span>
                <DataPill tone={activeStateId === "default" ? "slate" : "teal"}>
                  {activeStateId}
                </DataPill>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                效果模板 · {formatActionLabel(resolvedActionId)}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-400">
                <span>热点 {resolvedAsset?.hotspotX ?? 0},{resolvedAsset?.hotspotY ?? 0}</span>
                <span>来源 {activeStateId === "default" || cursorModes?.[activeStateId] === "覆盖" ? "独立" : "继承默认"}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-xs font-medium text-slate-600">测试元素</div>
          <div className="grid gap-2">
            {TEST_ZONES.map((zone) => {
              const isActive = activeZoneId === zone.id;
              const Icon = activeStateId ? CURSOR_STATES.find((s) => s.id === activeStateId)?.icon || null : null;
              return (
                <div
                  key={zone.id}
                  onMouseEnter={() => handleZoneEnter(zone.id, zone.cursor)}
                  onMouseLeave={handleZoneLeave}
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    isActive ? "border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-100" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  )}
                  style={{ cursor: zone.cursor }}
                >
                  {Icon && isActive ? (
                    <Icon className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <div className="h-4 w-4 shrink-0 rounded-full bg-slate-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-sm", isActive ? "font-medium text-emerald-900" : "font-medium text-slate-900")}>
                      {zone.element === "input" ? (
                        <span className="inline-block rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600">
                          {zone.label}
                        </span>
                      ) : zone.disabled ? (
                        <span className="inline-block rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-500">
                          {zone.label}
                        </span>
                      ) : (
                        zone.label
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">{zone.hint}</div>
                  </div>
                  {isActive && activeStateMeta ? (
                    <DataPill tone="teal">{activeStateMeta.label}</DataPill>
                  ) : (
                    <DataPill tone="slate">—</DataPill>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">
            <p className="font-medium text-slate-700">使用提示</p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5">
              <li>将鼠标移动到上方的测试元素上，查看不同光标状态下的效果</li>
              <li>当前状态显示在顶部区域，包含光标素材、热点坐标和效果模板</li>
              <li>在左侧修改光标素材或热点后，此处将实时更新</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
