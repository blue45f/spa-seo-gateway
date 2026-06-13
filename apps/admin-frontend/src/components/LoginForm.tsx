import { type FormEvent, useState } from 'react'

import { api, errorMessage } from '../lib/api'
import { useStore } from '../lib/store'

export function LoginForm() {
  const t = useStore((s) => s.t)
  const setAuthed = useStore((s) => s.setAuthed)
  const pushToast = useStore((s) => s.pushToast)
  const setGlobalError = useStore((s) => s.setGlobalError)
  const [token, setToken] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = token.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      await api('POST', '/admin/api/login', { token: trimmed }, { publicEndpoint: true })
      setAuthed(true)
      setGlobalError('')
      setToken('')
      pushToast(t('auth.authenticated', 'authenticated'), 'success')
    } catch (e) {
      const msg = errorMessage(e)
      setGlobalError(msg)
      pushToast(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2" data-testid="login-form">
      <input
        type="password"
        placeholder={t('auth.token-placeholder')}
        className="input px-3 py-1.5 text-sm w-full min-w-0 sm:w-72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        aria-label="admin token"
        autoComplete="current-password"
      />
      <button
        type="submit"
        disabled={submitting || !token.trim()}
        aria-busy={submitting}
        className="btn-primary px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[var(--color-surface)]"
      >
        {submitting ? '…' : t('auth.login')}
      </button>
    </form>
  )
}
