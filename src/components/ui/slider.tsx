import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from './utils'

export function Slider({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }) {
  const disabled = Boolean(props.disabled)

  return (
    <SliderPrimitive.Root
      className={cn('relative flex w-full touch-none select-none items-center data-[disabled]:opacity-60', className)}
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-slate-200">
        <SliderPrimitive.Range className={cn('absolute h-full rounded-full', disabled ? 'bg-slate-300' : 'bg-emerald-600')} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          'block size-4 rounded-full border-2 bg-white shadow-sm ring-4 ring-white transition-colors focus-visible:outline-none focus-visible:ring-slate-300 disabled:cursor-not-allowed',
          disabled ? 'border-slate-300' : 'border-emerald-600'
        )}
        aria-label={props['aria-label'] || '调整数值'}
      />
    </SliderPrimitive.Root>
  )
}
