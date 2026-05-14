import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from './utils.js'

const ToastContext = createContext(null)

const toneMap = {
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  error: {
    icon: XCircle,
    className: 'border-rose-200 bg-rose-50 text-rose-800',
  },
  info: {
    icon: Info,
    className: 'border-slate-200 bg-white text-slate-800',
  },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback(({ title, description = '', tone = 'info' }) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((current) => [...current, { id, title, description, tone }])
    return id
  }, [])

  const closeToast = useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={2800}>
        {children}
        {toasts.map((item) => {
          const tone = toneMap[item.tone] || toneMap.info
          const Icon = tone.icon
          return (
            <ToastPrimitive.Root
              key={item.id}
              open
              onOpenChange={(open) => {
                if (!open) closeToast(item.id)
              }}
              className={cn(
                'grid w-[min(360px,calc(100vw-2rem))] grid-cols-[auto_minmax(0,1fr)] gap-x-3 rounded-2xl border px-4 py-3 shadow-lg',
                tone.className
              )}
            >
              <Icon className="mt-0.5 size-4" aria-hidden="true" />
              <div className="min-w-0">
                <ToastPrimitive.Title className="text-sm font-semibold text-pretty">{item.title}</ToastPrimitive.Title>
                {item.description ? <ToastPrimitive.Description className="mt-0.5 text-xs opacity-80 text-pretty">{item.description}</ToastPrimitive.Description> : null}
              </div>
            </ToastPrimitive.Root>
          )
        })}
        <ToastPrimitive.Viewport className="fixed right-4 top-4 z-50 flex max-h-dvh flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context.toast
}
