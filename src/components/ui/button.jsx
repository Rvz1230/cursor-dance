import React from 'react'
import { cn } from './utils.js'

export const Button = React.forwardRef(({ className, variant = 'default', size = 'default', ...props }, ref) => {
  const variants = {
    default: 'border border-slate-950 bg-slate-950 text-white shadow-sm hover:bg-slate-800',
    outline: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  }
  const sizes = {
    default: 'h-9 px-3.5 py-2',
    icon: 'size-9',
  }
  return (
    <button
      type="button"
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-xl text-sm font-medium transition-[transform,color,background-color,border-color,box-shadow,opacity] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
})
Button.displayName = 'Button'
