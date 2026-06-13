export function FieldRow({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5 py-2 md:grid-cols-[104px_minmax(0,1fr)] md:items-center md:gap-3">
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
      </div>
      <div className="min-w-0">{control}</div>
    </div>
  );
}
