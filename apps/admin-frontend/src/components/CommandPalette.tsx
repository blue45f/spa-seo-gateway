import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { navItemsForLang } from '../lib/nav'
import { useStore } from '../lib/store'
import { useFocusRestore } from '../lib/useFocusRestore'
import { useFocusTrap } from '../lib/useFocusTrap'

import { NavIcon } from './NavIcon'

export function CommandPalette() {
  const open = useStore((s) => s.cmdPaletteOpen)
  const close = useStore((s) => s.closeCmd)
  const lang = useStore((s) => s.lang)
  const mode = useStore((s) => s.publicInfo?.mode)
  const t = useStore((s) => s.t)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useFocusRestore(open)
  useFocusTrap(dialogRef, open)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      // autoFocus 대체 — open 시 input 으로 포커스 이동
      inputRef.current?.focus()
    }
  }, [open])

  const items = useMemo(() => navItemsForLang(lang, mode), [lang, mode])
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return items
    return items.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        (n.subtitle ?? '').toLowerCase().includes(q)
    )
  }, [items, query])

  // 결과가 바뀌면 활성 인덱스를 첫 항목으로 리셋
  useEffect(() => setActive(0), [filtered])

  // 활성 옵션을 뷰포트 안으로 스크롤 (DOM 포커스는 input 에 유지)
  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const select = (i: number) => {
    const n = filtered[i]
    if (!n) return
    navigate(n.path)
    close()
  }

  return (
    // 배경(scrim) 클릭은 닫기 편의 기능일 뿐이며, 키보드 닫기(Escape)는 App.tsx 의
    // 전역 keydown 핸들러가 이미 제공한다. jsx-a11y 는 같은 요소에 키 핸들러가 없다는
    // 이유로 오탐을 내므로 이 요소만 비활성화한다.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-[80] bg-scrim flex items-start justify-center pt-24 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      data-testid="cmd-palette"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('cmd.placeholder')}
        className="bg-panel border border-line rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="cmd-listbox"
          aria-activedescendant={filtered[active] ? `cmd-opt-${filtered[active].id}` : undefined}
          aria-label={t('cmd.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              // 빈 결과(length 0)에서도 -1 로 내려가지 않게 하한 0 클램프
              setActive((i) => Math.max(0, Math.min(i + 1, filtered.length - 1)))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Home') {
              e.preventDefault()
              setActive(0)
            } else if (e.key === 'End') {
              e.preventDefault()
              setActive(Math.max(0, filtered.length - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              select(active)
            }
          }}
          placeholder={t('cmd.placeholder')}
          className="w-full px-4 py-3 text-sm border-b border-line bg-transparent text-ink placeholder:text-ink-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
        />
        <div
          ref={listRef}
          id="cmd-listbox"
          role="listbox"
          aria-label={t('cmd.placeholder')}
          className="max-h-72 overflow-y-auto"
        >
          {filtered.map((n, i) => (
            <button
              key={n.id}
              type="button"
              id={`cmd-opt-${n.id}`}
              role="option"
              // 가상 포커스(aria-activedescendant) 모델 — 옵션은 Tab 순서에서 제외하고
              // 포커스는 input 에 유지. mousedown 의 포커스 탈취도 막는다.
              tabIndex={-1}
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(i)}
              onMouseMove={() => setActive(i)}
              className={`w-full text-left px-4 py-2 flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset ${i === active ? 'bg-accent-soft' : 'hover:bg-accent-soft'}`}
            >
              <span aria-hidden="true" className="flex text-ink-subtle">
                <NavIcon id={n.id} className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm">{n.label}</span>
              <span className="text-xs text-ink-subtle">{n.subtitle}</span>
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-sm text-center text-ink-subtle">{t('cmd.empty')}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
