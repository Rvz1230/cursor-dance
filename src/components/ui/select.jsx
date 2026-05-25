import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from './utils.js'

export function Select({ value, options, onValueChange, disabled = false, placeholder = '请选择', className, 'aria-label': ariaLabel }) {
  const selectOptions = options?.length ? options : [value]

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn(
          'flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        aria-label={ariaLabel || placeholder}
        title={String(value || placeholder)}
      >
        <SelectPrimitive.Value placeholder={placeholder} className="min-w-0 flex-1 truncate whitespace-nowrap" />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          <SelectPrimitive.Viewport className="max-h-72 overflow-y-auto">
            {selectOptions.map((item) => {
              const optionValue = typeof item === 'string' ? item : item.value
              const optionLabel = typeof item === 'string' ? item : item.label
              return (
                <SelectPrimitive.Item
                  key={optionValue}
                  value={optionValue}
                  className="relative flex min-h-9 cursor-default select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-950 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  title={String(optionLabel)}
                >
                  <SelectPrimitive.ItemIndicator className="absolute left-2.5 inline-flex items-center">
                    <Check className="size-4" aria-hidden="true" />
                  </SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText className="truncate">{optionLabel}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              )
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
