import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from './utils.js'

const ToastContext = createContext(null)

const toneMap = {
  success: {
    icon: CheckCircle2,
    iconClassName: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
  error: {
    icon: XCircle,
    iconClassName: 'bg-rose-50 text-rose-700 ring-rose-100',
  },
  info: {
    icon: Info,
    iconClassName: 'bg-sky-50 text-sky-700 ring-sky-100',
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
                'grid w-[min(340px,calc(100vw-2rem))] grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 rounded-2xl border border-slate-200 bg-white/98 px-3.5 py-3 text-slate-900 shadow-[0_14px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm'
              )}
            >
              <div className={cn('mt-0.5 flex size-8 items-center justify-center rounded-full ring-1', tone.iconClassName)}>
                <Icon className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <ToastPrimitive.Title className="text-sm font-semibold leading-5 text-pretty text-slate-900">
                  {item.title}
                </ToastPrimitive.Title>
                {item.description ? (
                  <ToastPrimitive.Description className="mt-1 text-xs leading-5 text-slate-500 text-pretty">
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
