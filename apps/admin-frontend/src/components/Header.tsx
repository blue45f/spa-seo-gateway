import { useLocation } from 'react-router-dom'

import { api } from '../lib/api'
import { findNavItemByPath, requiresAuth } from '../lib/nav'
import { useStore } from '../lib/store'

import { LoginForm } from './LoginForm'
import { MemberAuthControl } from './MemberAuthControl'

export function Header() {
  const location = useLocation()
  const t = useStore((s) => s.t)
  const authed = useStore((s) => s.authed)
  const setAuthed = useStore((s) => s.setAuthed)
  const pushToast = useStore((s) => s.pushToast)

  const item = findNavItemByPath(location.pathname)
  const tabId = item?.id ?? 'welcome'
  const needsAuth = requiresAuth(tabId)
  const showLogin = !authed && needsAuth

  async function logout() {
    try {
      await api('POST', '/admin/api/logout', undefined, { publicEndpoint: true })
    } catch {
      // ignore
    }
    setAuthed(false)
    pushToast('logged out', 'info')
  }

  return (
    <header className="bg-panel border-b border-line px-6 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pl-16 lg:pl-6">
      <div className="min-w-[8rem] flex-1">
        <h1 className="text-xl font-semibold tracking-tight text-ink truncate">
          {item ? t(item.labelKey) : ''}
        </h1>
        <p className="text-xs text-ink-subtle truncate">{item ? t(item.subtitleKey) : ''}</p>
      </div>
      <div
        className={`flex shrink-0 items-center gap-2${
          showLogin ? ' max-sm:order-last max-sm:w-full' : ''
        }`}
      >
        {showLogin ? <LoginForm /> : null}
        {authed ? (
          <button
            type="button"
            className="btn-ghost shrink-0 min-h-[44px] md:min-h-0 px-3 py-1.5 text-sm"
            onClick={logout}
          >
            {t('auth.logout')}
          </button>
        ) : null}
        {/* 통합 회원 로그인(Firebase) — 위의 관리자 토큰 로그인과 별개로 항상 노출되는
            추가 진입점(이메일/게스트). env 미설정이면 다이얼로그가 친절히 안내한다. */}
        <MemberAuthControl />
      </div>
    </header>
  )
}
