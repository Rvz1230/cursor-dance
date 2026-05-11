import { cn } from './utils.js'

export function Slider({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }) {
  const progress = ((value[0] - min) / (max - min)) * 100
  const disabled = Boolean(props.disabled)

  return (
    <div className={cn('relative flex w-full touch-none select-none items-center', disabled && 'opacity-60', className)}>
      <div className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn('absolute h-full rounded-full', disabled ? 'bg-slate-300' : 'bg-emerald-600')}
          style={{ width: `${progress}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(e) => onValueChange?.([parseInt(e.target.value)])}
        className={cn('absolute inset-0 w-full opacity-0', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
        {...props}
      />
      <div
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-4 ring-white transition-colors',
          disabled ? 'border-2 border-slate-300' : 'border-2 border-emerald-600'
        )}
        style={{ marginLeft: `calc(${progress}% - 8px)` }}
      />
    </div>
  )
}
