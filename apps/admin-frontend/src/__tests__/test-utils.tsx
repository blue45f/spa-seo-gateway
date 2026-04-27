import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, type MemoryRouterProps, Outlet, Route, Routes } from 'react-router-dom';
import { useStore } from '../lib/store';
import type { PublicInfo } from '../lib/types';

/**
 * Layout 의 OutletContext (publicInfo) 가 필요한 페이지를 테스트할 때 사용.
 * 그냥 페이지를 라우터로 감싸서 mount 해 줍니다.
 */
export function renderWithRouter(
  ui: ReactElement,
  opts: { initialEntries?: MemoryRouterProps['initialEntries']; publicInfo?: PublicInfo | null } = {},
  options?: RenderOptions,
): RenderResult {
  const { initialEntries = ['/'], publicInfo = null } = opts;
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<OutletShim publicInfo={publicInfo} />}>
          <Route path="*" element={ui} />
        </Route>
      </Routes>
    </MemoryRouter>,
    options,
  );
}

function OutletShim({ publicInfo }: { publicInfo: PublicInfo | null }) {
  // react-router 의 useOutletContext 가 동작하도록 OutletContext 를 주입.
  return <Outlet context={{ publicInfo }} />;
}

/** 매 테스트마다 store 초기화. 언어/테마를 강제 ko/light 로 — 테스트 간 i18n 누수 방지. */
export function resetStore() {
  useStore.setState({
    authed: false,
    adminEnabled: true,
    loginToken: '',
    theme: 'light',
    lang: 'ko',
    sidebarOpen: true,
    cmdPaletteOpen: false,
    shortcutsOpen: false,
    tourSeen: true,
    tourStep: -1,
    toasts: [],
    globalError: '',
  });
}

export function authedStore() {
  useStore.setState({ authed: true, adminEnabled: true });
}

/** Mock fetch — JSON body 반환. fetch 글로벌을 vi.fn 으로 대체. */
export function mockJsonFetch<T>(payload: T, status = 200) {
  return ((..._args: Parameters<typeof fetch>) => {
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }) as unknown as typeof fetch;
}

export function mockTextFetch(payload: string, status = 200) {
  return ((..._args: Parameters<typeof fetch>) => {
    return Promise.resolve(
      new Response(payload, {
        status,
        headers: { 'content-type': 'text/plain' },
      }),
    );
  }) as unknown as typeof fetch;
}
