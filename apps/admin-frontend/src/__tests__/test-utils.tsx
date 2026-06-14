import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type RenderOptions, type RenderResult, render } from '@testing-library/react'
import { MemoryRouter, type MemoryRouterProps, Outlet, Route, Routes } from 'react-router-dom'

import { useStore } from '../lib/store'

import type { PublicInfo } from '../lib/types'
import type { ReactElement } from 'react'

/**
 * 테스트용 QueryClient — 매 render 마다 새 인스턴스라 캐시가 테스트 간 누수되지 않는다.
 * retry off + 캐시 비활성으로 프로덕션 동작(1회 fetch, 재시도 없음)을 그대로 반영.
 */
function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
      },
      mutations: { retry: false },
    },
  })
}

/**
 * 자체 라우터 셋업(MemoryRouter)을 쓰는 테스트가 QueryClientProvider 만 손쉽게 두를 수
 * 있게 하는 래퍼. 매 호출마다 새 QueryClient 라 테스트 간 캐시 누수가 없다.
 */
export function withQueryClient(ui: ReactElement): ReactElement {
  return <QueryClientProvider client={makeTestQueryClient()}>{ui}</QueryClientProvider>
}

/**
 * Layout 의 OutletContext (publicInfo) 가 필요한 페이지를 테스트할 때 사용.
 * 그냥 페이지를 라우터로 감싸서 mount 해 줍니다.
 */
export function renderWithRouter(
  ui: ReactElement,
  opts: {
    initialEntries?: MemoryRouterProps['initialEntries']
    publicInfo?: PublicInfo | null
  } = {},
  options?: RenderOptions
): RenderResult {
  const { initialEntries = ['/'], publicInfo = null } = opts
  const queryClient = makeTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route element={<OutletShim publicInfo={publicInfo} />}>
            <Route path="*" element={ui} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
    options
  )
}

function OutletShim({ publicInfo }: { publicInfo: PublicInfo | null }) {
  // react-router 의 useOutletContext 가 동작하도록 OutletContext 를 주입.
  return <Outlet context={{ publicInfo }} />
}

/** 매 테스트마다 store 초기화. 언어/테마를 강제 ko/light 로 — 테스트 간 i18n 누수 방지. */
export function resetStore() {
  useStore.setState({
    authed: false,
    adminEnabled: true,
    theme: 'light',
    themeMode: 'system',
    density: 'comfortable',
    lang: 'ko',
    sidebarOpen: true,
    cmdPaletteOpen: false,
    shortcutsOpen: false,
    tourSeen: true,
    tourStep: -1,
    toasts: [],
    globalError: '',
  })
}

export function authedStore() {
  useStore.setState({ authed: true, adminEnabled: true })
}

/** Mock fetch — JSON body 반환. fetch 글로벌을 vi.fn 으로 대체. */
export function mockJsonFetch<T>(payload: T, status = 200) {
  return ((..._args: Parameters<typeof fetch>) => {
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    )
  }) as unknown as typeof fetch
}

export function mockTextFetch(payload: string, status = 200) {
  return ((..._args: Parameters<typeof fetch>) => {
    return Promise.resolve(
      new Response(payload, {
        status,
        headers: { 'content-type': 'text/plain' },
      })
    )
  }) as unknown as typeof fetch
}
