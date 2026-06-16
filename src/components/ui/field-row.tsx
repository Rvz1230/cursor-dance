import { FieldHint } from "./field-hint";

export function FieldRow({
  label,
  hint,
  tooltip,
  control,
}: {
  label: string;
  hint?: string;
  tooltip?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="field-row grid min-w-0 gap-1.5 py-2">
      <div className="field-row-label">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          {label}
          {tooltip ? <FieldHint content={tooltip} /> : null}
        </div>
        {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
      </div>
      <div className="min-w-0">{control}</div>
    </div>
  );
}
