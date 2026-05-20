import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from './utils.js'

const ToastContext = createContext(null)

const toneMap = {
  success: {
    icon: CheckCircle2,
    rootClassName: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    iconClassName: 'text-emerald-600',
  },
  error: {
    icon: XCircle,
    rootClassName: 'border-rose-200 bg-rose-50 text-rose-800',
    iconClassName: 'text-rose-600',
  },
  info: {
    icon: Info,
    rootClassName: 'border-sky-200 bg-sky-50 text-sky-800',
    iconClassName: 'text-sky-600',
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
                'grid w-fit min-w-[240px] max-w-[min(420px,calc(100vw-2rem))] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 rounded-md border px-3 py-2 shadow-md shadow-slate-900/10',
                tone.rootClassName
              )}
            >
              <div className={cn('flex size-5 items-center justify-center', tone.iconClassName)}>
                <Icon className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <ToastPrimitive.Title className="text-sm font-medium leading-5 text-pretty">
                  {item.title}
                </ToastPrimitive.Title>
                {item.description ? (
                  <ToastPrimitive.Description className="mt-0.5 text-xs leading-5 opacity-80 text-pretty">
                    {item.description}
                  </ToastPrimitive.Description>
                ) : null}
              </div>
            </ToastPrimitive.Root>
          )
        })}
        <ToastPrimitive.Viewport className="fixed left-1/2 top-4 z-50 flex max-h-dvh -translate-x-1/2 flex-col gap-2.5 outline-none" />
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
