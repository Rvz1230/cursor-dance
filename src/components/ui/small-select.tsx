import { Select } from "@/components/ui/select";

export function SmallSelect<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: ReadonlyArray<T | { value: T; label: string }>;
  onChange?: (value: T) => void;
  label?: string;
}) {
  const disabled = !onChange;
  return <Select value={value} options={options} onValueChange={onChange ? (nextValue) => onChange(nextValue as T) : undefined} disabled={disabled} aria-label={label || "选择配置项"} />;
}
