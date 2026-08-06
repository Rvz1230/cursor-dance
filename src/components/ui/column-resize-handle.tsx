interface ColumnResizeHandleProps {
  label: string;
  onResize: (event: React.PointerEvent) => void;
}

export function ColumnResizeHandle({ label, onResize }: ColumnResizeHandleProps) {
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
