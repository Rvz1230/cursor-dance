// FieldRow — label + control 自适应布局
//
// 使用 CSS container query 判断容器实际宽度（非 viewport md 断点）：
//   容器宽 ≥ 280px：两列 grid [80px label] [1fr control]，垂直居中
//   容器宽 < 280px：堆叠，label 在上 control 在下
//
// 父容器需要 .field-row-container (设置 container-type: inline-size)。
// WorkbenchPanel 的滚动容器已添加此类名。
//
// 为什么不用 md 断点：viewport 可能在 960px 但 config 列只有 ~225px，
// md(768px) 断点无法感知容器实际宽度，导致控件区被挤压到 ~77px。

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
    <div className="field-row grid min-w-0 gap-1.5 py-2">
      <div className="field-row-label">
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
      </div>
      <div className="min-w-0">{control}</div>
    </div>
  );
}
