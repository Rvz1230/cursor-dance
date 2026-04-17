import React from 'react'
import { cn } from './utils.js'

export const Button = React.forwardRef(({ className, variant = 'default', size = 'default', ...props }, ref) => {
  const variants = {
    default: 'bg-slate-950 text-white hover:bg-slate-800',
    outline: 'border border-black/5 bg-white hover:bg-slate-50 text-slate-700',
    ghost: 'hover:bg-white/70 text-slate-600',
  }
  const sizes = {
    default: 'h-10 px-4 py-2',
    icon: 'h-10 w-10',
  }
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-full text-sm font-medium ring-1 ring-black/5 transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
})
Button.displayName = 'Button'