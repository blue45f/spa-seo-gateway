import { render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { RouteAnnouncer } from '../../components/RouteAnnouncer'
import { useStore } from '../../lib/store'
import { resetStore } from '../test-utils'

/**
 * RouteAnnouncer 는 Layout 의 <main id="main-content"> 를 포커스 타깃으로 쓰므로,
 * 테스트 하네스에서도 동일한 main 요소를 제공한다.
 */
function Harness({ to }: { to?: string }) {
  const navigate = useNavigate()
  useEffect(() => {
    if (to) navigate(to)
  }, [to, navigate])
  return (
    <>
      <RouteAnnouncer />
      <main id="main-content" tabIndex={-1}>
        content
      </main>
    </>
  )
}

function renderAt(initial: string, to?: string) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="*" element={<Harness to={to} />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  resetStore()
})

afterEach(() => {
  document.title = ''
})

describe('RouteAnnouncer', () => {
  it('renders a polite, atomic, visually-hidden live region', () => {
    renderAt('/')
    const region = screen.getByTestId('route-announcer')
    expect(region).toHaveAttribute('role', 'status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('aria-atomic', 'true')
    expect(region).toHaveClass('sr-only')
  })

  it('does not announce or steal focus on initial mount', () => {
    renderAt('/')
    // 초기 진입: 안내 문구는 비어 있고, 포커스는 main 으로 강탈되지 않는다.
    expect(screen.getByTestId('route-announcer').textContent).toBe('')
    expect(document.activeElement).not.toBe(document.getElementById('main-content'))
  })

  it('sets document.title from the matched nav item on initial mount', () => {
    renderAt('/')
    // '/' → welcome ('소개'), ko 로케일.
    expect(document.title).toContain('소개')
  })

  it('announces the new page and moves focus to #main-content on navigation', async () => {
    renderAt('/', '/routes')
    await waitFor(() => {
      // 라우트 변경 → aria-live 안내 문구가 채워진다 (라우트 페이지 라벨 포함).
      expect(screen.getByTestId('route-announcer').textContent).toContain('라우트')
    })
    // 포커스가 본문으로 이동 (skip-link 타깃 재사용).
    expect(document.activeElement).toBe(document.getElementById('main-content'))
    // document.title 도 새 페이지 기준으로 갱신.
    expect(document.title).toContain('라우트')
  })

  it('localizes the announcement when language switches to en', async () => {
    useStore.setState({ lang: 'en' })
    renderAt('/', '/routes')
    await waitFor(() => {
      expect(screen.getByTestId('route-announcer').textContent).toContain('Routes')
    })
    expect(screen.getByTestId('route-announcer').textContent).toContain('Navigated to')
  })
})
