import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useStore } from '../lib/store'

/** Catch-all 404 — replaces the old behaviour of silently rendering Welcome. */
export function NotFound() {
  const t = useStore((s) => s.t)
  return (
    <section
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid="page-not-found"
    >
      <Compass className="h-10 w-10 text-ink-subtle" strokeWidth={1.5} aria-hidden="true" />
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-ink">{t('notFound.title')}</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{t('notFound.hint')}</p>
      <Link to="/" className="btn-primary mt-5 px-4 py-2 text-sm font-medium">
        {t('notFound.home')}
      </Link>
    </section>
  )
}
