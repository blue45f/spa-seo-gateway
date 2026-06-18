/**
 * NotifyDesk — 네이티브 "알림 인박스" 연동.
 * ──────────────────────────────────────────────────────────────────────────
 * `@heejun/deskcloud` 의 createNotifyClient(pk_) 로 수신자 인박스를 받아 앱의 Modal +
 * 디자인 토큰으로 렌더한다 — 외부 위젯 CSS·번들 없음. 우상단 플로팅 벨로 마운트되며,
 * 미읽음 카운트 배지를 표시하고, 패널에서 개별/일괄 읽음 처리를 한다.
 *
 * 수신자 식별자(recipientId)는 어드민 콘솔이라 'admin' 고정. VITE_NOTIFYDESK_URL
 * 미설정 시(clients 에서 null) 이 컴포넌트는 렌더되지 않는다(앱 그대로 유지).
 */
import { Bell } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactElement } from 'react'

import { EmptyState } from '../../EmptyState'
import { Modal } from '../../Modal'
import { Skeleton } from '../../Skeleton'
import { getNotifyDesk } from '../clients'

interface InboxItem {
  id: string
  title: string
  body: string
  status: string
  createdAt: string
}

const RECIPIENT_ID = 'admin'

type Phase = 'idle' | 'loading' | 'ready' | 'error'

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ')
  }
}

export function NotificationInbox(): ReactElement | null {
  const [client] = useState(() => getNotifyDesk())
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [items, setItems] = useState<InboxItem[]>([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!client) return undefined
    let cancelled = false
    client
      .getUnreadCount({ recipientId: RECIPIENT_ID })
      .then((r) => {
        if (!cancelled) setUnread(r.unreadCount)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [client])

  const load = useCallback(() => {
    if (!client) return
    setPhase('loading')
    client
      .getInbox({ recipientId: RECIPIENT_ID, limit: 20 })
      .then((inbox) => {
        setItems(
          inbox.items.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            status: n.status,
            createdAt: n.createdAt,
          }))
        )
        setUnread(inbox.unreadCount)
        setPhase('ready')
      })
      .catch(() => setPhase('error'))
  }, [client])

  const openPanel = useCallback(() => {
    setOpen(true)
    if (phase === 'idle' || phase === 'error') load()
  }, [phase, load])

  const markAllRead = useCallback(() => {
    if (!client) return
    client
      .markRead({ recipientId: RECIPIENT_ID, all: true })
      .then((r) => {
        setUnread(r.unreadCount)
        setItems((prev) => prev.map((n) => ({ ...n, status: 'read' })))
      })
      .catch(() => undefined)
  }, [client])

  const markOneRead = useCallback(
    (id: string) => {
      if (!client) return
      client
        .markRead({ recipientId: RECIPIENT_ID, ids: [id] })
        .then((r) => {
          setUnread(r.unreadCount)
          setItems((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)))
        })
        .catch(() => undefined)
    },
    [client]
  )

  if (!client) return null

  return (
    <div className="fixed right-3 top-3 z-50">
      <button
        type="button"
        onClick={openPanel}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `알림, 읽지 않은 항목 ${unread}건` : '알림'}
        className="btn-ghost relative inline-flex h-10 w-10 items-center justify-center rounded-full shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-err px-1 text-[0.65rem] font-bold leading-tight text-white"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="알림" size="md">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-ink-subtle">
            읽지 않은 알림 <span className="font-mono">{unread}</span>건
          </p>
          {items.some((n) => n.status !== 'read') ? (
            <button
              type="button"
              onClick={markAllRead}
              className="btn-ghost px-2.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              모두 읽음
            </button>
          ) : null}
        </div>

        {phase === 'loading' ? (
          <div className="space-y-4" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            ))}
          </div>
        ) : null}

        {phase === 'error' ? (
          <div role="alert" className="alert alert--err">
            <p className="font-medium">불러오지 못했어요</p>
            <p className="mt-1 text-xs">네트워크 상태를 확인하고 다시 시도해 주세요.</p>
            <button
              type="button"
              onClick={load}
              className="btn-ghost mt-3 px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              다시 시도
            </button>
          </div>
        ) : null}

        {phase === 'ready' && items.length === 0 ? (
          <EmptyState title="알림이 없어요" hint="새 알림이 도착하면 여기에 표시됩니다." />
        ) : null}

        {phase === 'ready' && items.length > 0 ? (
          <ul className="divide-y divide-line">
            {items.map((n) => {
              const isUnread = n.status !== 'read'
              return (
                <li key={n.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                      isUnread ? 'bg-accent' : 'bg-line-strong'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <h3 className="truncate text-sm font-semibold text-ink">{n.title}</h3>
                      <time className="ml-auto flex-none text-xs text-ink-subtle">
                        {formatWhen(n.createdAt)}
                      </time>
                    </div>
                    {n.body ? <p className="mt-0.5 text-sm text-ink-muted">{n.body}</p> : null}
                    {isUnread ? (
                      <button
                        type="button"
                        onClick={() => markOneRead(n.id)}
                        className="link mt-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        읽음 표시
                      </button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </Modal>
    </div>
  )
}

export default NotificationInbox
