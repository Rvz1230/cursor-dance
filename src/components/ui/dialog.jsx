import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { X } from 'lucide-react'
import { cn } from './utils.js'

export const Dialog = DialogPrimitive.Root

export function DialogContent({ className, children, titleId, title, showClose = true, ...props }) {
  const fallbackTitle = title || '对话框'

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-950/55" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[min(720px,calc(100dvh-4rem))] w-[calc(100vw-2rem)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-[#f8fafc] shadow-xl focus:outline-none',
          className
        )}
        aria-labelledby={titleId}
        {...props}
      >
        <VisuallyHidden.Root>
          <DialogPrimitive.Title id={titleId}>{fallbackTitle}</DialogPrimitive.Title>
        </VisuallyHidden.Root>
        {children}
        {showClose ? (
          <DialogPrimitive.Close className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2" aria-label="关闭弹窗">
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export const DialogDescription = DialogPrimitive.Description
