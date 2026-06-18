/**
 * SearchDesk — 네이티브 검색 팔레트 연동.
 * ──────────────────────────────────────────────────────────────────────────
 * `@heejun/deskcloud` 의 createSearchClient(pk_) 로 풀텍스트 검색 결과를 받아 앱의
 * Modal + 디자인 토큰(input/listbox)으로 렌더한다 — 외부 위젯 CSS·번들 없음.
 *
 * 앱 자체 CommandPalette 가 ⌘K 를 이미 쓰므로, 충돌을 피해 ⌘⇧K(mod+shift+k) 핫키로
 * 마운트한다(기존 기능을 덮어쓰지 않음). 서버가 돌려주는 `<mark>` 하이라이트 마크업은
 * HTML 주입 없이 평문으로 표시한다(앱의 "HTML 미주입" 원칙 · XSS 차단).
 *
 * VITE_SEARCHDESK_URL 미설정 시(clients 에서 null) 이 컴포넌트는 렌더되지 않는다.
 */
import { Search } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react'

import { EmptyState } from '../../EmptyState'
import { Modal } from '../../Modal'
import { getSearchDesk } from '../clients'

interface Hit {
  id: string
  index: string
  title: string
  url: string | null
  category: string | null
  snippet: string | null
}

type Phase = 'idle' | 'loading' | 'ready' | 'error'

/** `<mark>` 등 서버 하이라이트 마크업을 제거해 평문으로(HTML 미주입). */
function stripTags(value: string | null): string {
  if (!value) return ''
  return value.replace(/<[^>]*>/g, '')
}

export function SearchPalette(): ReactElement | null {
  const [client] = useState(() => getSearchDesk())
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [hits, setHits] = useState<Hit[]>([])
  const [active, setActive] = useState(0)

  const reactId = useId()
  const listboxId = `${reactId}-listbox`
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ⌘⇧K 핫키로 팔레트 열기 (앱 CommandPalette 의 ⌘K 와 충돌 회피).
  useEffect(() => {
    if (!client) return undefined
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [client])

  // 디바운스 검색 — 쿼리가 비면 결과를 비운다.
  useEffect(() => {
    if (!client || !open) return undefined
    const trimmed = query.trim()
    abortRef.current?.abort()
    if (trimmed.length === 0) {
      setHits([])
      setPhase('idle')
      return undefined
    }
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const t = window.setTimeout(() => {
      setPhase('loading')
      client
        .search({ q: trimmed, limit: 20 })
        .then((res) => {
          if (ctrl.signal.aborted) return
          setHits(
            res.hits.map((h) => ({
              id: h.id,
              index: h.index,
              title: h.title,
              url: h.url,
              category: h.category,
              snippet: h.snippet,
            }))
          )
          setActive(0)
          setPhase('ready')
        })
        .catch(() => {
          if (ctrl.signal.aborted) return
          setPhase('error')
        })
    }, 160)
    return () => {
      window.clearTimeout(t)
      ctrl.abort()
    }
  }, [client, open, query])

  // 팔레트가 닫히면 상태 초기화.
  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 30)
      return () => window.clearTimeout(t)
    }
    setQuery('')
    setHits([])
    setPhase('idle')
    setActive(0)
    return undefined
  }, [open])

  const selectHit = useCallback((hit: Hit) => {
    setOpen(false)
    if (hit.url) globalThis.location.assign(hit.url)
  }, [])

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => (hits.length === 0 ? 0 : (i + 1) % hits.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => (hits.length === 0 ? 0 : (i - 1 + hits.length) % hits.length))
      } else if (e.key === 'Enter') {
        const hit = hits[active]
        if (hit) {
          e.preventDefault()
          selectHit(hit)
        }
      }
    },
    [hits, active, selectHit]
  )

  if (!client) return null

  const showResults = query.trim().length > 0

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="검색" size="lg">
      <div className="flex items-center gap-2 rounded-md border border-line bg-panel-2 px-3 py-2 focus-within:border-accent">
        <Search className="h-4 w-4 flex-none text-ink-subtle" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showResults && hits.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={hits.length > 0 ? `${reactId}-opt-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder="사이트, 라우트, 문서 검색…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
        />
        <kbd className="flex-none rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[0.65rem] text-ink-subtle">
          Esc
        </kbd>
      </div>

      <div className="mt-3 max-h-[50vh] overflow-y-auto">
        {!showResults ? (
          <EmptyState
            title="무엇을 찾고 계신가요?"
            hint="검색어를 입력하면 결과가 바로 표시됩니다."
          />
        ) : null}

        {showResults && phase === 'loading' && hits.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-ink-subtle" aria-busy="true">
            검색 중…
          </p>
        ) : null}

        {showResults && phase === 'error' ? (
          <div role="alert" className="alert alert--err">
            <p className="font-medium">검색에 실패했어요</p>
            <p className="mt-1 text-xs">네트워크 상태를 확인해 주세요.</p>
          </div>
        ) : null}

        {showResults && phase === 'ready' && hits.length === 0 ? (
          <EmptyState
            title="결과가 없습니다"
            hint={`"${query.trim()}" 에 대한 검색 결과를 찾지 못했어요.`}
          />
        ) : null}

        {showResults && hits.length > 0 ? (
          <ul role="listbox" id={listboxId} aria-label="검색 결과" className="space-y-1">
            {hits.map((hit, i) => {
              const selected = i === active
              const snippet = stripTags(hit.snippet)
              return (
                <li
                  key={`${hit.index}:${hit.id}`}
                  id={`${reactId}-opt-${i}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectHit(hit)
                  }}
                  className={`cursor-pointer rounded-md px-3 py-2 ${
                    selected ? 'bg-accent-soft' : 'hover:bg-panel-2'
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium text-ink">{hit.title}</span>
                    {hit.category ? (
                      <span className="ml-auto flex-none text-xs text-ink-subtle">
                        {hit.category}
                      </span>
                    ) : null}
                  </div>
                  {snippet ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{snippet}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </Modal>
  )
}

export default SearchPalette
