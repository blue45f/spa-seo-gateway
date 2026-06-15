import { Moon, Sun } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'

import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import { Figure } from '../components/Figure'
import { Modal } from '../components/Modal'
import { CardGridSkeleton, Skeleton } from '../components/Skeleton'
import { Sparkline } from '../components/Sparkline'
import { useStore } from '../lib/store'

import type { ReactNode } from 'react'

/**
 * `/design` — living style guide for the admin console's ACTUAL design system.
 *
 * Reads the REAL tokens (CSS custom properties resolved via getComputedStyle so the
 * swatches re-read on theme flip) and renders the REAL components/utilities shipped in
 * styles.css + components/*. No new palette, no new primitives — identity preserved.
 * Public route: the guide is reference material, viewable without an admin token.
 */

type Swatch = { token: string; label: string }

const NEUTRALS: Swatch[] = [
  { token: '--app-bg', label: 'surface' },
  { token: '--app-panel', label: 'panel' },
  { token: '--app-panel-2', label: 'panel-2' },
  { token: '--app-line', label: 'line' },
  { token: '--app-line-strong', label: 'line-strong' },
]

const INKS: Swatch[] = [
  { token: '--app-ink', label: 'ink — body' },
  { token: '--app-ink-muted', label: 'ink-muted — labels' },
  { token: '--app-ink-subtle', label: 'ink-subtle — AA min' },
]

const ACCENT: Swatch[] = [
  { token: '--app-accent', label: 'accent' },
  { token: '--app-accent-hover', label: 'accent-hover' },
  { token: '--app-accent-soft', label: 'accent-soft' },
]

const STATUS: Swatch[] = [
  { token: '--app-ok', label: 'ok' },
  { token: '--app-warn', label: 'warn' },
  { token: '--app-err', label: 'err' },
]

const RAIL: Swatch[] = [
  { token: '--app-rail', label: 'rail' },
  { token: '--app-rail-elev', label: 'rail-elev' },
  { token: '--app-rail-line', label: 'rail-line' },
]

const SPACING = [
  { label: '0.5', rem: '0.125rem' },
  { label: '1', rem: '0.25rem' },
  { label: '2', rem: '0.5rem' },
  { label: '3', rem: '0.75rem' },
  { label: '4', rem: '1rem' },
  { label: '6', rem: '1.5rem' },
  { label: '8', rem: '2rem' },
]

const RADII = [
  { label: 'badge / btn', rem: '0.375rem' },
  { label: 'panel-inset', rem: '0.5rem' },
  { label: 'panel', rem: '0.625rem' },
  { label: 'pill', rem: '999px' },
]

const TYPE_SCALE = [
  { cls: 'text-2xl font-semibold tracking-tight', name: 'text-2xl · 600', sample: 'Page title' },
  { cls: 'text-xl font-semibold tracking-tight', name: 'text-xl · 600', sample: 'Header title' },
  { cls: 'text-base font-medium', name: 'text-base · 500', sample: 'Section heading' },
  { cls: 'text-sm', name: 'text-sm · 400', sample: 'Body / control text' },
  { cls: 'text-xs text-ink-muted', name: 'text-xs · muted', sample: 'Label / caption' },
]

const SECTIONS = [
  { id: 'foundations-color', label: 'Color' },
  { id: 'foundations-type', label: 'Typography' },
  { id: 'foundations-space', label: 'Spacing & Radii' },
  { id: 'foundations-elevation', label: 'Elevation & Motion' },
  { id: 'components-actions', label: 'Buttons' },
  { id: 'components-forms', label: 'Forms' },
  { id: 'components-feedback', label: 'Badges & Alerts' },
  { id: 'components-overlays', label: 'Overlays & States' },
]

const SPARK_SAMPLE = [4, 9, 6, 12, 8, 15, 11, 18, 14, 22]

/** Read a CSS custom property off :root, resolved to its computed value. */
function readVars(tokens: string[]): Record<string, string> {
  if (typeof document === 'undefined') return {}
  const cs = getComputedStyle(document.documentElement)
  const out: Record<string, string> = {}
  for (const token of tokens) out[token] = cs.getPropertyValue(token).trim()
  return out
}

export function Design() {
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)

  // Re-resolve every showcased token whenever the theme flips so swatch captions
  // always reflect what's painted. `theme` in the dep array is the trigger.
  const allTokens = useMemo(
    () => [...NEUTRALS, ...INKS, ...ACCENT, ...STATUS, ...RAIL].map((s) => s.token),
    []
  )
  const [resolved, setResolved] = useState<Record<string, string>>({})
  useEffect(() => {
    setResolved(readVars(allTokens))
  }, [allTokens, theme])

  return (
    <div className="space-y-8" data-testid="page-design">
      <DesignHeader theme={theme} onToggleTheme={toggleTheme} />
      <InPageNav />

      <SectionGroup title="Foundations">
        {/* ── Color ── */}
        <Section
          id="foundations-color"
          title="Color"
          lead="Restrained: warm-paper neutrals carry the identity; a single violet accent (under 10% of any surface) marks primary action, selection, and focus. Status hues stay clear of the accent. All values OKLCH."
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <SwatchGroup
              title="Neutrals / surface"
              swatches={NEUTRALS}
              resolved={resolved}
              bordered
            />
            <SwatchGroup title="Ink (text on surface)" swatches={INKS} resolved={resolved} ink />
            <SwatchGroup title="Accent (action / focus)" swatches={ACCENT} resolved={resolved} />
            <SwatchGroup title="Status" swatches={STATUS} resolved={resolved} />
            <SwatchGroup title="Sidebar rail (fixed layer)" swatches={RAIL} resolved={resolved} />
          </div>
        </Section>

        {/* ── Typography ── */}
        <Section
          id="foundations-type"
          title="Typography"
          lead="One system sans across the whole console; a mono family for machine data, tabular-figured. Fixed rem scale — never fluid — so labels read identically at every DPI."
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="panel p-5">
              <Caption>Families</Caption>
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="text-xs text-ink-muted">sans · UI</dt>
                  <dd className="text-lg text-ink">The quick brown fox jumps — 0123456789</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">mono · data (tabular)</dt>
                  <dd className="font-mono text-base text-ink">200 · 1,024 ms · 99.95% · 0x1f</dd>
                </div>
              </dl>
            </div>
            <div className="panel p-5">
              <Caption>Type scale</Caption>
              <ul className="mt-3 space-y-2.5">
                {TYPE_SCALE.map((row) => (
                  <li
                    key={row.name}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line pb-2 last:border-0 last:pb-0"
                  >
                    <span className={`${row.cls} text-ink`}>{row.sample}</span>
                    <span className="font-mono text-xs text-ink-subtle">{row.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="panel-inset p-5">
            <Caption>Prose measure — capped at ~68ch for readability</Caption>
            <p
              className="mt-2 text-sm leading-relaxed text-ink"
              style={{ maxWidth: '68ch', textWrap: 'pretty' }}
            >
              Body copy is set in the system sans at the ink color, never the muted gray — muted is
              reserved for labels and captions so running text always clears WCAG AA contrast. Line
              length is held inside the comfortable 65–75 character band; past it the eye loses the
              start of the next line and scanning slows.
            </p>
          </div>
        </Section>

        {/* ── Spacing & Radii ── */}
        <Section
          id="foundations-space"
          title="Spacing & Radii"
          lead="A rem-based step scale (compact density tightens it globally via a single root font-size). Radii climb with elevation: tighter on inset controls, softer on raised panels."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="panel p-5">
              <Caption>Spacing scale</Caption>
              <ul className="mt-3 space-y-2">
                {SPACING.map((s) => (
                  <li key={s.label} className="flex items-center gap-3">
                    <span className="w-6 shrink-0 font-mono text-xs text-ink-subtle">
                      {s.label}
                    </span>
                    <span
                      className="h-3 rounded-sm bg-accent"
                      style={{ width: s.rem }}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-xs text-ink-muted">{s.rem}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel p-5">
              <Caption>Radii</Caption>
              <div className="mt-3 flex flex-wrap gap-4">
                {RADII.map((r) => (
                  <div key={r.label} className="flex flex-col items-center gap-1.5">
                    <span
                      className="h-14 w-14 border border-line-strong bg-panel-2"
                      style={{ borderRadius: r.rem }}
                      aria-hidden="true"
                    />
                    <span className="text-center text-xs text-ink-muted">{r.label}</span>
                    <span className="font-mono text-[0.6875rem] text-ink-subtle">{r.rem}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Elevation & Motion ── */}
        <Section
          id="foundations-elevation"
          title="Elevation & Motion"
          lead="Depth is hairline borders plus one soft shadow token — not stacked drop shadows. Motion is 140–220ms ease-out, used only to confirm state; every animation has a reduced-motion fallback."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="panel p-5">
              <Caption>Elevation</Caption>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div className="rounded-md border border-line bg-panel-2 p-4">
                  <p className="text-sm font-medium text-ink">.panel-inset</p>
                  <p className="text-xs text-ink-muted">border, no shadow — recessed</p>
                </div>
                <div className="panel p-4">
                  <p className="text-sm font-medium text-ink">.panel</p>
                  <p className="text-xs text-ink-muted">border + shadow token — raised</p>
                </div>
              </div>
            </div>
            <MotionDemo />
          </div>
        </Section>
      </SectionGroup>

      <SectionGroup title="Components">
        {/* ── Buttons ── */}
        <Section
          id="components-actions"
          title="Buttons"
          lead="Three intents — primary (accent), ghost (secondary), danger. Size comes from call-site utilities; color, focus ring, and the tactile press live in the shared class. Every state is shown."
        >
          <div className="panel p-5">
            <ButtonRow label="primary — confirm the main action">
              <button type="button" className="btn-primary px-3 py-1.5 text-sm">
                Save changes
              </button>
              <button type="button" className="btn-primary px-3 py-1.5 text-sm" disabled>
                Disabled
              </button>
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-2 px-3 py-1.5 text-sm"
                disabled
              >
                <Spinner /> Saving…
              </button>
            </ButtonRow>
            <ButtonRow label="ghost — secondary / cancel">
              <button type="button" className="btn-ghost px-3 py-1.5 text-sm">
                Cancel
              </button>
              <button type="button" className="btn-ghost px-3 py-1.5 text-sm" disabled>
                Disabled
              </button>
            </ButtonRow>
            <ButtonRow label="danger — destructive" last>
              <button type="button" className="btn-danger px-3 py-1.5 text-sm">
                Delete site
              </button>
              <button type="button" className="btn-danger px-3 py-1.5 text-sm" disabled>
                Disabled
              </button>
            </ButtonRow>
            <p className="mt-4 text-xs text-ink-subtle">
              Tab to any button to see the accent focus ring; press and hold for the tactile shift
              (suppressed under reduced-motion).
            </p>
          </div>
        </Section>

        {/* ── Forms ── */}
        <Section
          id="components-forms"
          title="Forms"
          lead="The <Field> component wires label↔control with useId for accessibility. Inputs, selects, and the native checkbox all route focus and the checked fill through the accent token."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="panel space-y-4 p-5">
              <Caption>Text inputs — default, focus, error, disabled</Caption>
              <Field label="Origin URL">
                <input
                  className="input w-full px-3 py-1.5 text-sm"
                  placeholder="https://example.com"
                />
              </Field>
              <div className="block">
                <label className="text-xs font-medium text-ink-muted" htmlFor="dg-err">
                  Cache TTL (seconds)
                </label>
                <div className="mt-1">
                  <input
                    id="dg-err"
                    className="input w-full px-3 py-1.5 text-sm"
                    aria-invalid="true"
                    defaultValue="-1"
                    style={{ borderColor: 'var(--color-err)' }}
                  />
                </div>
                <p className="alert alert--err mt-2 text-xs" role="alert">
                  TTL must be a positive integer.
                </p>
              </div>
              <Field label="Disabled">
                <input
                  className="input w-full px-3 py-1.5 text-sm"
                  value="read-only"
                  disabled
                  readOnly
                />
              </Field>
            </div>
            <div className="panel space-y-4 p-5">
              <Caption>Select & checkbox</Caption>
              <Field label="Gateway mode">
                <select className="input w-full px-3 py-1.5 text-sm" defaultValue="cms">
                  <option value="proxy">Proxy</option>
                  <option value="cms">CMS — multi-site</option>
                  <option value="saas">SaaS — multi-tenant</option>
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" className="checkbox h-4 w-4" defaultChecked />
                Stale-while-revalidate
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" className="checkbox h-4 w-4" />
                Strip query string from cache key
              </label>
              <p className="text-xs text-ink-subtle">
                Focus any control to see the 3px accent-soft ring; the checkbox accent-color
                matches.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Badges & Alerts ── */}
        <Section
          id="components-feedback"
          title="Badges & Alerts"
          lead="Status vocabulary stays consistent across the console: a dot-leading badge for inline status, a bordered alert for block-level notices. Four semantic roles, one neutral."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="panel p-5">
              <Caption>Badges</Caption>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="badge badge--ok">healthy</span>
                <span className="badge badge--warn">degraded</span>
                <span className="badge badge--err">offline</span>
                <span className="badge badge--neutral">idle</span>
              </div>
            </div>
            <div className="panel space-y-2.5 p-5">
              <Caption>Alerts</Caption>
              <div className="alert alert--info mt-1">Cache warmed for 1,204 routes.</div>
              <div className="alert alert--ok">Audit chain verified — no tampering.</div>
              <div className="alert alert--warn">Admin token expires in 3 days.</div>
              <div className="alert alert--err">Render failed: upstream timeout (504).</div>
            </div>
          </div>
        </Section>

        {/* ── Overlays & States ── */}
        <Section
          id="components-overlays"
          title="Overlays & States"
          lead="Signature components: a portalled Radix dialog that escapes overflow, count-up figures with sparklines for instrument readouts, and the teaching empty / skeleton states."
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <DialogDemo />
            <div className="panel p-5">
              <Caption>Figure + Sparkline — instrument readout</Caption>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-3xl text-ink">
                    <Figure value={1204} format={(n) => Math.round(n).toLocaleString()} />
                  </p>
                  <p className="text-xs text-ink-muted">routes cached</p>
                </div>
                <span className="text-accent">
                  <Sparkline values={SPARK_SAMPLE} width={120} height={40} />
                </span>
              </div>
            </div>
            <div className="panel p-5">
              <Caption>Empty state — teaches the next step</Caption>
              <div className="mt-1">
                <EmptyState
                  title="No routes configured yet"
                  hint="Add a URL pattern to override its rendering behavior."
                />
              </div>
            </div>
            <div className="panel p-5">
              <Caption>Skeletons — structure-preserving loading</Caption>
              <div className="mt-3 space-y-3">
                <Skeleton className="h-4 w-40" />
                <CardGridSkeleton count={2} />
              </div>
            </div>
          </div>
        </Section>
      </SectionGroup>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────── */

function DesignHeader({ theme, onToggleTheme }: { theme: string; onToggleTheme: () => void }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">spa-seo-gateway</p>
        <h2
          className="mt-0.5 text-2xl font-semibold tracking-tight text-ink"
          style={{ textWrap: 'balance' }}
        >
          Design System
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted" style={{ textWrap: 'pretty' }}>
          The live tokens and components behind the admin console — read straight from the running
          stylesheet, so what you see here is exactly what ships.
        </p>
      </div>
      <button
        type="button"
        onClick={onToggleTheme}
        className="btn-ghost inline-flex shrink-0 items-center gap-2 px-3 py-1.5 text-sm"
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )}
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </header>
  )
}

function InPageNav() {
  return (
    <nav
      aria-label="Design system sections"
      className="sticky top-2 z-10 -mx-1 overflow-x-auto rounded-lg border border-line bg-panel/95 px-1 py-1.5 backdrop-blur"
    >
      <ul className="flex gap-1">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="inline-block whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function SectionGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">{title}</h3>
      {children}
    </div>
  )
}

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string
  title: string
  lead: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-16 space-y-4">
      <div>
        <h4
          className="text-lg font-semibold tracking-tight text-ink"
          style={{ textWrap: 'balance' }}
        >
          {title}
        </h4>
        <p className="mt-1 max-w-prose text-sm text-ink-muted" style={{ textWrap: 'pretty' }}>
          {lead}
        </p>
      </div>
      {children}
    </section>
  )
}

function Caption({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-wide text-ink-subtle">{children}</p>
}

function SwatchGroup({
  title,
  swatches,
  resolved,
  bordered,
  ink,
}: {
  title: string
  swatches: Swatch[]
  resolved: Record<string, string>
  bordered?: boolean
  ink?: boolean
}) {
  return (
    <div className="panel p-4">
      <Caption>{title}</Caption>
      <ul className="mt-3 space-y-2">
        {swatches.map((s) => {
          const value = resolved[s.token] ?? ''
          return (
            <li key={s.token} className="flex items-center gap-3">
              {ink ? (
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line bg-panel font-semibold"
                  style={{ color: `var(${s.token})` }}
                  aria-hidden="true"
                >
                  Aa
                </span>
              ) : (
                <span
                  className={`h-9 w-9 shrink-0 rounded-md ${bordered ? 'border border-line-strong' : ''}`}
                  style={{ background: `var(${s.token})` }}
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{s.label}</p>
                <p className="truncate font-mono text-[0.6875rem] text-ink-subtle" title={value}>
                  {s.token}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ButtonRow({
  label,
  children,
  last,
}: {
  label: string
  children: ReactNode
  last?: boolean
}) {
  return (
    <div className={last ? '' : 'mb-4 border-b border-line pb-4'}>
      <Caption>{label}</Caption>
      <div className="mt-2 flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 motion-safe:animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function MotionDemo() {
  const [on, setOn] = useState(false)
  const id = useId()
  return (
    <div className="panel p-5">
      <Caption>Motion — state, not decoration</Caption>
      <p className="mt-2 text-xs text-ink-muted">
        140–220ms ease-out (cubic-bezier 0.25, 1, 0.5, 1). Toggle to see the transition; it
        collapses to an instant change under{' '}
        <code className="font-mono">prefers-reduced-motion</code>.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          id={id}
          role="switch"
          aria-checked={on}
          aria-label="Demo toggle"
          onClick={() => setOn((v) => !v)}
          className="relative h-6 w-11 shrink-0 rounded-full border border-line transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{ background: on ? 'var(--color-accent)' : 'var(--color-panel-2)' }}
        >
          <span
            className="absolute top-0.5 h-4 w-4 rounded-full bg-panel shadow-sm motion-safe:transition-[left] motion-safe:duration-200"
            style={{ left: on ? 'calc(100% - 1.125rem)' : '0.125rem' }}
            aria-hidden="true"
          />
        </button>
        <span className="text-sm text-ink-muted">{on ? 'On' : 'Off'}</span>
      </div>
    </div>
  )
}

function DialogDemo() {
  const [open, setOpen] = useState(false)
  return (
    <div className="panel p-5">
      <Caption>Dialog — portalled, escapes overflow</Caption>
      <p className="mt-2 text-xs text-ink-muted">
        Radix Dialog via the shared <code className="font-mono">{'<Modal>'}</code>: focus trap,
        Escape to close, scroll lock, and trigger-focus restore — all handled.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost mt-3 px-3 py-1.5 text-sm"
      >
        Open dialog
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Invalidate cache?" size="md">
        <p className="text-sm text-ink-muted">
          This clears every cached render for the current origin. Bots will trigger fresh renders on
          their next crawl.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-sm"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger px-3 py-1.5 text-sm"
            onClick={() => setOpen(false)}
          >
            Invalidate
          </button>
        </div>
      </Modal>
    </div>
  )
}
