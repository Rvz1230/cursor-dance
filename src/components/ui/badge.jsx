import React from 'react'
import { cn } from './utils.js'

export const Badge = React.forwardRef(({ className, variant = 'default', ...props }, ref) => {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        className
      )}
      {...props}
    />
  )
})
Badge.displayName = 'Badge'