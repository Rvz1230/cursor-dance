import { useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";

interface TextTagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function TextTagEditor({ tags, onChange, disabled = false }: TextTagEditorProps) {
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
              draggedTag === tag && "border-slate-300 bg-slate-50 opacity-60",
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
