import { useState } from "react";
import { GripVertical, MousePointer2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { Panel } from "@/components/ui/panel";

// Re-export 已提取到 src/components/ui/ 的通用组件，保持向后兼容
export { Panel } from "@/components/ui/panel";
export { SectionTitle } from "@/components/ui/section-title";
export { DataPill } from "@/components/ui/data-pill";
export { SmallSelect } from "@/components/ui/small-select";
export { FieldRow } from "@/components/ui/field-row";
export { ControlSlider } from "@/components/ui/control-slider";
export { ColorOptions } from "@/components/ui/color-options";
export { ThemeCard } from "@/components/ui/theme-card";

export function WorkbenchAccordionPanel(props: React.ComponentProps<typeof Panel>) {
  return <Panel collapsible {...props} />;
}

export function TextTagEditor({ tags, onChange, disabled = false }: { tags: string[]; onChange: (tags: string[]) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState("");
  const [draggedTag, setDraggedTag] = useState("");

  function addTag() {
    const next = draft.trim();
    if (!next) return;
    if (tags.includes(next)) {
      setDraft("");
      return;
    }
    onChange([...tags, next]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((item) => item !== tag));
  }

  function reorderTag(targetTag: string) {
    if (disabled || !draggedTag || draggedTag === targetTag) return;
    const fromIndex = tags.indexOf(draggedTag);
    const toIndex = tags.indexOf(targetTag);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextTags = [...tags];
    const [movedTag] = nextTags.splice(fromIndex, 1);
    nextTags.splice(toIndex, 0, movedTag);
    onChange(nextTags);
  }

  return (
    <div className="space-y-3">
      <div className={cn("flex flex-wrap gap-2", disabled && "opacity-50")}>
        {tags.map((tag) => (
          <span
            key={tag}
            draggable={!disabled}
            onDragStart={(event) => {
              setDraggedTag(tag);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", tag);
            }}
            onDragOver={(event) => {
              if (!disabled && draggedTag && draggedTag !== tag) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              reorderTag(tag);
              setDraggedTag("");
            }}
            onDragEnd={() => setDraggedTag("")}
            className={cn(
              "inline-flex cursor-grab items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 transition active:cursor-grabbing",
              draggedTag === tag && "border-slate-300 bg-slate-50 opacity-60"
            )}
          >
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span>{tag}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeTag(tag)}
              aria-label={`删除标签 ${tag}`}
              className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {tags.length === 0 ? <div className="text-sm text-slate-500">还没有标签，先添加一个文本内容。</div> : null}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag();
            }
          }}
          placeholder="输入一个文本标签，例如：已命中"
          className="rounded-2xl bg-white"
        />
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 rounded-2xl"
          onClick={addTag}
          disabled={disabled}
          aria-label="添加标签"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function SettingSection({ disabled = false, children }: { disabled?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("border-t border-slate-100 pt-4 first:border-t-0 first:pt-0", disabled && "opacity-50")}>
      {children}
    </div>
  );
}

export function NativeCursorPreview({ size = 48 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: `${size}px`, height: `${size}px` }} aria-label="系统原生鼠标指针预览">
      <MousePointer2 className="absolute left-1 top-1 size-[70%] -rotate-12 fill-white text-slate-950 drop-shadow-sm" />
      <span className="absolute left-[38%] top-[40%] size-2 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden="true" />
    </div>
  );
}

export function WorkspaceItem({ item, active, onClick, compact = false }: { item: { icon: React.ComponentType<{ className?: string }>; label: string }; active?: boolean; onClick?: () => void; compact?: boolean }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        compact
          ? "inline-flex h-7 whitespace-nowrap items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition-[transform,color,background-color,border-color,box-shadow] active:scale-[0.97]"
          : "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
        compact
          ? active
            ? "border-slate-950 bg-slate-950 text-white shadow-sm"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          : active
            ? "bg-slate-100 text-slate-900"
            : "text-slate-600 hover:bg-white hover:text-slate-900"
      )}
    >
      <Icon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
      <span className={cn(compact ? "" : "font-medium")}>{item.label}</span>
    </button>
  );
}

export function ActionTab({ item, active, onClick }: { item: { id: string; label: string; hint?: string }; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-w-fit rounded-xl border px-3 py-1.5 text-xs font-medium transition-[transform,color,background-color,border-color,box-shadow] active:scale-[0.97]",
        active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      {item.label}
    </button>
  );
}

export function PreviewBadge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "emerald" | "amber" | "slate" }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-white text-slate-600";
  return <span className={cn("rounded-lg border px-2 py-1 text-xs font-medium", toneClass)}>{children}</span>;
}

export function ColumnResizeHandle({ label, onResize }: { label: string; onResize: (event: React.PointerEvent) => void }) {
  return (
    <button
      type="button"
      className="group relative my-3 w-1 justify-self-center cursor-col-resize rounded-full bg-slate-300 transition-colors hover:bg-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
      aria-label={label}
      onPointerDown={onResize}
    >
      <span className="absolute -left-1 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-slate-300 transition-colors group-hover:bg-slate-500" />
      <span className="absolute -right-1 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-slate-300 transition-colors group-hover:bg-slate-500" />
    </button>
  );
}
