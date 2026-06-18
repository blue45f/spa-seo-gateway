/**
 * ChangelogDesk — 네이티브 "변경 이력" 연동.
 * ──────────────────────────────────────────────────────────────────────────
 * `@heejun/deskcloud` 의 createChangelogClient(pk_) 로 게시된 변경 이력을 받아
 * 앱의 Modal + 디자인 토큰(panel/badge/btn-*)으로 렌더한다 — 외부 위젯 CSS·번들 없음.
 *
 * 좌하단 플로팅 런처로 마운트되며, 미읽음이 있으면 카운트 배지를 표시한다.
 * 본문은 bodyMarkdown 을 HTML 주입 없이 React 노드로 렌더한다(MarkdownBlocks).
 * VITE_CHANGELOGDESK_URL 미설정 시(clients 에서 null) 이 컴포넌트는 렌더되지 않는다.
 */
import { Bell } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactElement } from 'react'

import { EmptyState } from '../../EmptyState'
import { Modal } from '../../Modal'
import { Skeleton } from '../../Skeleton'
import { getAnonId, getChangelogDesk } from '../clients'
import { MarkdownBlocks } from '../markdownBlocks'

interface Entry {
  id: string
  title: string
  bodyMarkdown: string
  tag: string
  version: string | null
  publishedAt: string | null
  createdAt: string
}

const TAG_LABELS: Record<string, string> = {
  new: '신규',
  improved: '개선',
  fixed: '수정',
  announcement: '공지',
}
const TAG_TONE: Record<string, string> = {
  new: 'badge--ok',
  improved: 'badge--neutral',
  fixed: 'badge--warn',
  announcement: 'badge--neutral',
}

function tagLabel(tag: string): string {
  return TAG_LABELS[tag] ?? tag
}
function tagTone(tag: string): string {
  return TAG_TONE[tag] ?? 'badge--neutral'
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

type Phase = 'idle' | 'loading' | 'ready' | 'error'

export function ChangelogPanel(): ReactElement | null {
  const [client] = useState(() => getChangelogDesk())
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [entries, setEntries] = useState<Entry[]>([])
  const [unread, setUnread] = useState(0)

  // 미읽음 카운트 — 패널을 열지 않아도 배지를 갱신(1회).
  useEffect(() => {
    if (!client) return undefined
    const ctrl = new AbortController()
    client
      .getUnreadCount({ anonId: getAnonId(), signal: ctrl.signal })
      .then((r) => setUnread(r.unreadCount))
      .catch(() => undefined)
    return () => ctrl.abort()
  }, [client])

  const load = useCallback(() => {
    if (!client) return
    setPhase('loading')
    client
      .getWall({ limit: 20 })
      .then((wall) => {
        const next: Entry[] = wall.items.map((e) => ({
          id: e.id,
          title: e.title,
          bodyMarkdown: e.bodyMarkdown,
          tag: e.tag,
          version: e.version,
          publishedAt: e.publishedAt,
          createdAt: e.createdAt,
        }))
        setEntries(next)
        setPhase('ready')
        const latest = next[0]
        client.markSeen({ anonId: getAnonId(), lastSeenEntryId: latest?.id }).catch(() => undefined)
        setUnread(0)
      })
      .catch(() => setPhase('error'))
  }, [client])

  const openPanel = useCallback(() => {
    setOpen(true)
    if (phase === 'idle' || phase === 'error') load()
  }, [phase, load])

  if (!client) return null

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `변경 이력, 읽지 않은 항목 ${unread}건` : '변경 이력'}
        className="btn-ghost fixed bottom-5 left-5 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

      <Modal open={open} onClose={() => setOpen(false)} title="변경 이력" size="md">
        {phase === 'loading' ? (
          <div className="space-y-4" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
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

        {phase === 'ready' && entries.length === 0 ? (
          <EmptyState
            title="아직 소식이 없어요"
            hint="새로운 변경 이력이 게시되면 여기에 표시됩니다."
          />
        ) : null}

        {phase === 'ready' && entries.length > 0 ? (
          <ul className="divide-y divide-line">
            {entries.map((entry) => {
              const date = formatDate(entry.publishedAt ?? entry.createdAt)
              return (
                <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`badge ${tagTone(entry.tag)}`}>{tagLabel(entry.tag)}</span>
                    {entry.version ? (
                      <span className="font-mono text-xs text-ink-subtle">{entry.version}</span>
                    ) : null}
                    {date ? (
                      <time
                        className="ml-auto text-xs text-ink-subtle"
                        dateTime={entry.publishedAt ?? entry.createdAt}
                      >
                        {date}
                      </time>
                    ) : null}
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-ink">{entry.title}</h3>
                  {entry.bodyMarkdown ? <MarkdownBlocks markdown={entry.bodyMarkdown} /> : null}
                </li>
              )
            })}
          </ul>
        ) : null}
      </Modal>
    </>
  )
}

export default ChangelogPanel
