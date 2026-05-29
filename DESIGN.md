# DESIGN.md — spa-seo-gateway admin console

Design language for the admin frontend (`apps/admin-frontend`). The source of truth is
`src/styles.css` (OKLCH tokens + `@theme inline` utilities + `@layer components`); this file
documents the intent so changes stay coherent.

## Register

**Product.** The console serves a task: operators (backend / SEO / devops engineers) configure
routes, watch cache hit rates, circuit breakers, render tests, and Lighthouse scores. They live
in IDEs and terminals and must *trust the numbers*. Bar: earned familiarity, not novelty. The
tool disappears into the task.

## Color

**Strategy: Restrained.** Identity is carried by warm-tinted neutrals, typography, and density,
not by a loud hue. All color is **OKLCH**. Never `#000` / `#fff` — every neutral is tinted toward
the brand hue.

- **Neutrals are warm** (hue ~80). Light = "engineering paper"; dark = warm charcoal. Explicitly
  *not* cool slate (the category reflex we moved off of).
- **One accent: violet-blue (hue ~285), under ~10% of the surface** — primary action, current
  selection, and focus only. Never decoration.
- **Status hues never collide with the accent:** ok = green (~150), warn = amber (~75),
  err = red (~25).
- **Rail:** the sidebar is a constant warm-charcoal layer (identical in both themes) for focus.

### Tokens

CSS custom properties live on `:root` / `.dark` (`--app-*`) and are exposed to Tailwind via
`@theme inline` as `--color-*`, so utilities like `bg-panel`, `text-ink`, `border-line`,
`text-accent`, `bg-ok-bg` work in **both themes without `dark:`** (the variable swaps).

| Role | Utilities | Light | Dark |
|---|---|---|---|
| app background | `bg-surface` | `oklch(0.974 0.005 80)` | `oklch(0.175 0.006 80)` |
| panel / card | `bg-panel` | `oklch(0.995 0.0025 80)` | `oklch(0.215 0.007 80)` |
| sunken / input / chip | `bg-panel-2` | `oklch(0.955 0.006 80)` | `oklch(0.255 0.008 80)` |
| hairline / strong | `border-line` / `border-line-strong` | `0.905` / `0.85` @80 | `0.305` / `0.40` @80 |
| text primary / muted / subtle | `text-ink` / `-ink-muted` / `-ink-subtle` | `0.28` / `0.50` / `0.62` @80 | `0.93` / `0.71` / `0.58` @80 |
| accent (+hover/fg/soft) | `*-accent`, `-accent-hover`, `-accent-fg`, `-accent-soft` | `oklch(0.54 0.185 285)` | `oklch(0.70 0.16 285)` |
| status ok / warn / err | `text-/bg-{ok,warn,err}` (+`-bg`/`-fg`) | greens/ambers/reds | brightened for dark |
| rail (sidebar) | `bg-rail`, `text-rail-ink`, `border-rail-line`, … | warm charcoal (constant) | same |

## Typography

- **System sans** for UI (`--font-sans`). One family carries headings, labels, body.
- **Monospace for all machine data** — hosts, URLs, TTLs, IDs, numbers — via `font-mono`
  (`--font-mono`, with `tabular-nums` + `ss01`/`zero`). This is the "instrument" signature.
- Fixed rem scale (no fluid clamps). Section titles: `text-lg font-semibold tracking-tight text-ink`.

## Elevation

Hairline borders + one subtle shadow (`--app-shadow`), never heavy drop shadows. Panels layer by
surface lightness (`surface` < `panel-2` < `panel`), not by big shadows.

## Motion

`ease-out-quart` = `cubic-bezier(0.25, 1, 0.5, 1)`, **140–220ms**. Conveys state (hover, focus,
toast in/out, reveal), never decoration. No bounce/elastic. All motion is disabled under
`prefers-reduced-motion: reduce`.

## Component classes (`@layer components`)

Use these instead of re-deriving Tailwind clusters. Color/state live in the class; size (`px/py`,
`text-*`, width) stays as utilities at the call site.

- `.panel` / `.panel-inset` — card surface / sunken surface (e.g. light code blocks)
- `.badge` + `.badge--ok|warn|err|neutral` — status pill (leading status dot via `::before`)
- `.btn-primary` (accent) / `.btn-ghost` (panel-2 + line) / `.btn-danger` (err)
- `.input` — text inputs / selects / textareas (accent focus ring)
- `.alert` + `.alert--ok|warn|err|info` — inline notices
- `.link` — accent text link

Dark code/terminal blocks use `bg-rail text-rail-ink` (consistent dark surface in both themes).

Reusable React components: `EmptyState` (teaching empty states), `Skeleton` / `CardGridSkeleton`
/ `DetailSkeleton` (loading placeholders), `NavIcon`, `Modal`.

## Iconography

[lucide-react](https://lucide.dev) line icons, never emoji. `NavIcon` maps each nav id to an icon
(keyed by id, so `nav.ts` data stays clean) and is shared by the Sidebar and command palette;
toasts map `kind` to `CircleCheck` / `CircleX` / `CircleAlert` / `Info`; close / dismiss use `X`;
the theme/lang toggles use `Sun` / `Moon` / `Languages`. `strokeWidth={1.75}` for the instrument
feel; every decorative icon is `aria-hidden`. On the constant-dark rail, status green uses the
`--color-ok-rail` token (a lighter green that still meets AA on the rail).

## Theme

`.dark` on `<html>` (restored pre-paint by the bootstrap script in `index.html`, mirrored in
Storybook via `@storybook/addon-themes`). CSS variables swap; component code rarely needs `dark:`.

## Accessibility

- **Contrast**: every text/background token pair meets WCAG AA (≥4.5:1), verified by computing
  OKLCH→sRGB relative luminance. The muted/subtle ink tiers and status-label colors are tuned to
  pass in both light and dark.
- **Focus**: every interactive element has a visible `focus-visible` accent ring (buttons, links,
  inputs, nav, rail controls).
- **Bypass blocks**: a skip-to-content link (visible on focus) jumps past the nav to `<main>`
  (`id="main-content"`).
- **Motion**: all animation/transition is disabled under `prefers-reduced-motion: reduce`.
- **Semantics**: roles, `aria-*`, and `aria-current` are preserved; decorative icons are
  `aria-hidden`; status is never conveyed by color alone (text label + icon accompany it).

## Do / Don't

- **Do** reach for the token utilities and component classes above; keep `data-testid`, roles,
  aria, and visible copy stable when restyling.
- **Don't** reintroduce raw `slate/indigo/emerald/amber/red` Tailwind palette or hex/`#fff` —
  map to tokens. (`lib/format.ts` shows status mapping for dynamic class strings.)

### Banned patterns

Side-stripe borders (colored `border-left/right` > 1px), gradient text (`background-clip: text`),
decorative glassmorphism, identical card grids, the big-number hero-metric template,
modal-as-first-thought, and em dashes in copy.
