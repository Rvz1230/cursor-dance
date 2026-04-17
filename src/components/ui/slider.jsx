import { cn } from './utils.js'

export function Slider({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }) {
  return (
    <div className={cn('relative flex w-full touch-none select-none items-center', className)}>
      <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200">
        <div
          className="absolute h-full bg-slate-950"
          style={{ width: `${((value[0] - min) / (max - min)) * 100}%` }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(e) => onValueChange?.([parseInt(e.target.value)])}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
        {...props}
      />
      <div
        className="block h-5 w-5 rounded-full border-2 border-slate-950 bg-white shadow transition-colors focus-visible:outline-none"
        style={{ marginLeft: `calc(${((value[0] - min) / (max - min)) * 100}% - 10px)` }}
      />
    </div>
  )
}