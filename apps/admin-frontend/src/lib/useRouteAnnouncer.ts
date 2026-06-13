import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { findNavItemByPath } from './nav'
import { useStore } from './store'

/**
 * SPA 라우트 전환 접근성 (WCAG 2.4.3 Focus Order / 4.1.3 Status Messages).
 *
 * react-router 의 클라이언트 내비게이션은 full page load 가 아니라서, 스크린리더/키보드
 * 사용자에게 "페이지가 바뀌었다"는 신호가 전혀 가지 않는다. 이 훅이 매 라우트 전환마다:
 *   1. <main id="main-content"> 로 포커스를 옮긴다 (skip-link 타깃 재사용).
 *      → 키보드 탭 순서가 사이드바 링크가 아니라 새 본문 최상단부터 다시 시작.
 *   2. document.title 을 현재 nav 항목 기준으로 갱신한다 (탭/SR 컨텍스트).
 *   3. aria-live 영역에 읽어 줄 안내 문구(localized)를 반환한다.
 *
 * 첫 마운트(초기 진입)에서는 포커스를 강탈하지 않는다 — 사용자가 의도적으로 어딘가에
 * 포커스했을 수 있고, 초기 로드는 SR 이 이미 문서 제목을 읽어 주기 때문. pathname 이
 * 실제로 *바뀐* 경우에만 포커스를 옮기고 안내한다.
 *
 * @returns aria-live 영역에 넣을 안내 문구 (RouteAnnouncer 가 렌더).
 */
export function useRouteAnnouncer(): string {
  const location = useLocation()
  const t = useStore((s) => s.t)
  // lang 을 구독해 언어 토글 시 안내 문구/타이틀도 재계산되도록.
  const lang = useStore((s) => s.lang)
  const [message, setMessage] = useState('')
  const prevPathRef = useRef<string | null>(null)

  useEffect(() => {
    const item = findNavItemByPath(location.pathname)
    const label = item ? t(item.labelKey) : t('a11y.routeUnknown', 'Page')

    // document.title — 탭 전환/북마크/SR 컨텍스트. 항상(초기 포함) 최신으로.
    if (typeof document !== 'undefined') {
      document.title = `${label} · ${t('app.title', 'spa-seo-gateway admin')}`
    }

    const isInitial = prevPathRef.current === null
    const changed = !isInitial && prevPathRef.current !== location.pathname
    prevPathRef.current = location.pathname

    if (!changed) return

    // 포커스를 본문으로 — skip-link 타깃(<main tabIndex={-1}>)을 재사용.
    if (typeof document !== 'undefined') {
      const main = document.getElementById('main-content')
      // preventScroll: 포커스 이동이 스크롤 점프를 일으키지 않도록(이미 상단).
      main?.focus({ preventScroll: true })
    }

    // aria-live 안내 — "{페이지} 페이지로 이동했습니다".
    setMessage(t('a11y.routeChanged', `Navigated to ${label}`).replace('{page}', label))
  }, [location.pathname, t, lang])

  return message
}
