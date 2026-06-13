import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright harness scoped to automated accessibility (axe) checks only.
 *
 * The admin app builds to packages/admin-ui/public and is served under the
 * `/admin/ui/` base path (Fastify mounts it there in production). `vite preview`
 * reproduces that base + SPA fallback, so axe runs against the real built bundle
 * — same OKLCH AA tokens, skip link, RouteAnnouncer, and landmarks that ship.
 *
 * No backend is required: the app's API calls fail closed (caught → unauthenticated
 * shell), so the chrome (nav, header, skip link, footer) still renders fully and
 * deterministically. That keeps the check fast and non-flaky.
 */
const PORT = Number(process.env.A11Y_PORT ?? 4317)
const BASE_PATH = '/admin/ui/'

export default defineConfig({
  testDir: './tests/a11y',
  // a11y assertions are deterministic against a static build — no retries needed,
  // a failure is a real regression rather than flake.
  retries: 0,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // In CI: annotate the run via the GitHub reporter and emit a static HTML report
  // (uploaded as an artifact on failure). Locally: a concise list.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    // `vite preview` binds to localhost (resolves to ::1 on dual-stack); keep host
    // consistent across baseURL + webServer.url so the readiness probe matches.
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    // Deterministic viewport so responsive chrome (sidebar vs mobile menu) is stable.
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `build` first so CI can run this job standalone; locally a prior build is reused fast.
    command: `pnpm run build && pnpm run preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
