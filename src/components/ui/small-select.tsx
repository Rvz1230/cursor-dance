import { Select } from "@/components/ui/select";

export function SmallSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
  label?: string;
}) {
  const disabled = !onChange;
  return <Select value={value} options={options} onValueChange={onChange} disabled={disabled} aria-label={label || "选择配置项"} />;
}
