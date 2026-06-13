import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

/**
 * Automated accessibility gate for the admin frontend.
 *
 * Runs axe-core against the built app (served by `vite preview` under /admin/ui/)
 * and fails the build on CRITICAL or SERIOUS WCAG 2.0/2.1 A & AA violations.
 *
 * Severity is intentionally scoped to critical/serious: moderate/minor findings
 * (e.g. best-practice landmark nesting) are reported by axe but do not gate, so
 * the check stays green and non-flaky while still catching real blockers
 * (missing labels, contrast failures, broken ARIA, keyboard traps).
 *
 * Routes covered are the public, backend-independent surfaces that render full
 * content without auth — the index (Welcome) and Help pages — which together
 * exercise the shared chrome: skip link, nav landmark, headings, links, footer,
 * and the RouteAnnouncer live region.
 */

const GATING_IMPACTS = new Set(['critical', 'serious'])

/** WCAG 2.0/2.1 A & AA — the rule set we actually commit to. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

const ROUTES: ReadonlyArray<{ path: string; name: string }> = [
  { path: '', name: 'index (Welcome)' },
  { path: 'help', name: 'Help' },
]

async function analyze(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
}

for (const route of ROUTES) {
  test(`no critical/serious a11y violations on ${route.name}`, async ({ page }) => {
    // baseURL already ends in /admin/ui/ — relative path keeps deep-link SPA fallback.
    await page.goto(route.path, { waitUntil: 'networkidle' })
    // Skip link lives at the top of the shell; its presence confirms the app shell mounted.
    await expect(page.locator('main#main-content')).toBeVisible()

    const results = await analyze(page)
    const gating = results.violations.filter(
      (v) => v.impact != null && GATING_IMPACTS.has(v.impact)
    )

    if (gating.length > 0) {
      const report = gating
        .map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n  ${v.helpUrl}`)
        .join('\n')
      test.info().annotations.push({ type: 'a11y-violations', description: report })
    }

    expect(gating, `critical/serious axe violations on ${route.name}`).toEqual([])
  })
}
