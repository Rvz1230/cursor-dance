import React from 'react'
import { cn } from './utils'

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  className?: string
  children: React.ReactNode
}

interface TabsListProps {
  className?: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
  selected?: boolean
  onSelect?: () => void
}

export function Tabs({ value, onValueChange, className, children }: TabsProps) {
  return (
    <div className={cn('inline-flex', className)}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement<TabsListProps>(child)) return null
        return React.cloneElement(child, {
          value,
          onValueChange,
        })
      })}
    </div>
  )
}

export function TabsList({ className, value, onValueChange, children }: TabsListProps) {
  return (
    <div className={cn('inline-flex h-10 items-center justify-center rounded-full bg-white/80 p-1 ring-1 ring-black/5', className)}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement<TabsTriggerProps>(child)) return null
        return React.cloneElement(child, {
          selected: child.props.value === value,
          onSelect: () => onValueChange?.(child.props.value),
        })
      })}
    </div>
  )
}

export function TabsTrigger({ className, value: _value, selected, onSelect, ...props }: TabsTriggerProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-black/5 transition-[color,background-color,box-shadow,opacity] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        selected ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100',
        className
      )}
      {...props}
    />
  )
}
