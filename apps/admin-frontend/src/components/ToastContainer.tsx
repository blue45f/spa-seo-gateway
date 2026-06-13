import { CircleAlert, CircleCheck, CircleX, Info, type LucideIcon, X } from 'lucide-react'

import { useStore } from '../lib/store'

import type { ToastKind } from '../lib/types'

const KIND_BG: Record<string, string> = {
  success: 'bg-ok-bg text-ok-fg border border-ok',
  error: 'bg-err-bg text-err-fg border border-err',
  warn: 'bg-warn-bg text-warn-fg border border-warn',
  info: 'bg-accent-soft text-ink border border-accent',
}

const KIND_ICON: Record<ToastKind, LucideIcon> = {
  success: CircleCheck,
  error: CircleX,
  warn: CircleAlert,
  info: Info,
}

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts)
  const removeToast = useStore((s) => s.removeToast)

  return (
    // 순수 위치 컨테이너 — live-region 은 토스트별로 둔다(중첩 금지). 각 토스트의 role
    // (error→alert/assertive, 그 외→status/polite)이 자체적으로 SR 알림 정중함을 운반.
    <div className="fixed bottom-4 right-4 z-[100] space-y-2" data-testid="toast-container">
      {toasts.map((t) => {
        const Icon = KIND_ICON[t.kind] ?? Info
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`toast-enter ${KIND_BG[t.kind] ?? 'bg-accent-soft text-ink border border-accent'} text-sm rounded-lg px-4 py-2 shadow-lg flex items-center gap-2 min-w-[220px]`}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="opacity-70 hover:opacity-100 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="dismiss"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
