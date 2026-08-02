import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from './utils'

interface ToastToneMeta {
  icon: LucideIcon
  iconClass: string
}

const toneMap: Record<ToastTone, ToastToneMeta> = {
  success: { icon: CheckCircle2, iconClass: 'text-emerald-500' },
  error: { icon: XCircle, iconClass: 'text-rose-500' },
  warning: { icon: AlertTriangle, iconClass: 'text-amber-500' },
  info: { icon: Info, iconClass: 'text-sky-500' },
}

type ToastTone = 'success' | 'error' | 'warning' | 'info'

interface ToastInput {
  title: ReactNode
  description?: string
  tone?: ToastTone
  /**
   * 撤销动作。决策 #7：一次性结果走 toast 且**带撤销**——
   * 没有撤销出口的一次性提示只是在通知用户「已经来不及了」。
   */
  undo?: { label?: string; run: () => void }
}

interface ToastItem {
  id: string
  title: ReactNode
  description: string
  // 调用方来自未严格检查的 src/app，tone 可能是任意字符串，故按 string 存储并在渲染时兜底。
  tone: string
  undo?: { label?: string; run: () => void }
}

interface ToastApi {
  toast: (input: ToastInput) => string
}

const ToastContext = createContext<ToastApi | null>(null)

function resolveTone(tone: string): ToastToneMeta {
  return Object.prototype.hasOwnProperty.call(toneMap, tone) ? toneMap[tone as ToastTone] : toneMap.info
}

export function ToastProvider({ children }: { children?: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback(({ title, description = '', tone = 'info', undo }: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((current) => [...current, { id, title, description, tone, undo }])
    return id
  }, [])

  const closeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={2800}>
        {children}
        {toasts.map((item) => {
          const tone = resolveTone(item.tone)
          const Icon = tone.icon
          return (
            <ToastPrimitive.Root
              key={item.id}
              open
              onOpenChange={(open) => {
                if (!open) closeToast(item.id)
              }}
              className={cn(
                'flex w-fit max-w-sm items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg'
              )}
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', tone.iconClass)} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <ToastPrimitive.Title className="text-xs font-medium text-slate-600 text-pretty">
                  {item.title}
                </ToastPrimitive.Title>
                {item.description ? (
                  <ToastPrimitive.Description className="mt-0.5 text-xs text-slate-500 text-pretty">
                    {item.description}
                  </ToastPrimitive.Description>
                ) : null}
              </div>
              {item.undo ? (
                <ToastPrimitive.Action
                  asChild
                  altText={item.undo.label ?? '撤销'}
                  onClick={() => item.undo?.run()}
                >
                  <button
                    type="button"
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                  >
                    {item.undo.label ?? '撤销'}
                  </button>
                </ToastPrimitive.Action>
              ) : null}
            </ToastPrimitive.Root>
          )
        })}
        <ToastPrimitive.Viewport className="fixed left-1/2 top-4 z-50 flex max-h-dvh -translate-x-1/2 flex-col gap-2 outline-none" />
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
