import { translate } from './i18n'

import type { Lang, PublicInfo } from './types'

export type GatewayMode = PublicInfo['mode']

export type NavItem = {
  id: string
  /** react-router path 부분 (basename 은 '/admin/ui') */
  path: string
  labelKey: string
  subtitleKey: string
  /** 인증 없이 접근 가능 */
  public?: boolean
  /** 특정 모드에서만 노출 (지정 시 해당 모드에서만 사이드바/router/cmd palette 에 등장). */
  modes?: GatewayMode[]
}

/**
 * 사이드바 / command palette / 라우터 매핑이 모두 참조하는 단일 진실 원천.
 * 아이콘은 id 기준으로 NavIcon(lucide) 이 렌더하므로 여기엔 두지 않는다.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'welcome',
    path: '/',
    labelKey: 'nav.welcome',
    subtitleKey: 'nav.welcome.sub',
    public: true,
  },
  {
    id: 'dashboard',
    path: '/dashboard',
    labelKey: 'nav.dashboard',
    subtitleKey: 'nav.dashboard.sub',
  },
  {
    id: 'antigravity',
    path: '/antigravity',
    labelKey: 'nav.antigravity',
    subtitleKey: 'nav.antigravity.sub',
    public: true,
  },
  {
    id: 'routes',
    path: '/routes',
    labelKey: 'nav.routes',
    subtitleKey: 'nav.routes.sub',
  },
  { id: 'cache', path: '/cache', labelKey: 'nav.cache', subtitleKey: 'nav.cache.sub' },
  { id: 'warm', path: '/warm', labelKey: 'nav.warm', subtitleKey: 'nav.warm.sub' },
  { id: 'test', path: '/test', labelKey: 'nav.test', subtitleKey: 'nav.test.sub' },
  {
    id: 'metrics',
    path: '/metrics',
    labelKey: 'nav.metrics',
    subtitleKey: 'nav.metrics.sub',
  },
  {
    id: 'lighthouse',
    path: '/lighthouse',
    labelKey: 'nav.lighthouse',
    subtitleKey: 'nav.lighthouse.sub',
  },
  {
    id: 'visual',
    path: '/visual',
    labelKey: 'nav.visual',
    subtitleKey: 'nav.visual.sub',
  },
  { id: 'ai', path: '/ai', labelKey: 'nav.ai', subtitleKey: 'nav.ai.sub' },
  { id: 'audit', path: '/audit', labelKey: 'nav.audit', subtitleKey: 'nav.audit.sub' },
  // 모드별 페이지 — Sidebar/Router/CmdPalette 가 publicInfo.mode 기준으로 필터.
  {
    id: 'sites',
    path: '/sites',
    labelKey: 'nav.sites',
    subtitleKey: 'nav.sites.sub',
    modes: ['cms'],
  },
  {
    id: 'tenants',
    path: '/tenants',
    labelKey: 'nav.tenants',
    subtitleKey: 'nav.tenants.sub',
    modes: ['saas'],
  },
  {
    id: 'api',
    path: '/api',
    labelKey: 'nav.api',
    subtitleKey: 'nav.api.sub',
    public: true,
  },
  {
    id: 'library',
    path: '/library',
    labelKey: 'nav.library',
    subtitleKey: 'nav.library.sub',
    public: true,
  },
  {
    id: 'help',
    path: '/help',
    labelKey: 'nav.help',
    subtitleKey: 'nav.help.sub',
    public: true,
  },
  {
    id: 'support',
    path: '/support',
    labelKey: 'nav.support',
    subtitleKey: 'nav.support.sub',
    public: true,
  },
]

/**
 * 사이드바/command palette 에는 노출하지 않지만 라우트 매핑(헤더 타이틀 ·
 * document.title · 인증 게이트)은 필요한 보조 라우트 — 푸터 법적 고지 페이지.
 */
export const AUX_NAV_ITEMS: NavItem[] = [
  {
    id: 'design',
    path: '/design',
    labelKey: 'nav.design',
    subtitleKey: 'nav.design.sub',
    public: true,
  },
  {
    id: 'terms',
    path: '/terms',
    labelKey: 'policy.terms.title',
    subtitleKey: 'policy.sub',
    public: true,
  },
  {
    id: 'privacy',
    path: '/privacy',
    labelKey: 'policy.privacy.title',
    subtitleKey: 'policy.sub',
    public: true,
  },
]

export function findNavItemByPath(path: string): NavItem | undefined {
  // basename 이 '/admin/ui' 라 path 가 '/' 부터 시작.
  const normalized = path === '/' ? '/' : path.replace(/\/$/, '')
  return [...NAV_ITEMS, ...AUX_NAV_ITEMS].find((n) => n.path === normalized)
}

export function findNavItemById(id: string): NavItem | undefined {
  return [...NAV_ITEMS, ...AUX_NAV_ITEMS].find((n) => n.id === id)
}

/** 현재 mode 에서 노출되는 nav 항목만 (modes 필드가 없거나 현재 모드를 포함하면 OK). */
export function visibleForMode(items: NavItem[], mode?: GatewayMode): NavItem[] {
  return items.filter((n) => !n.modes || (mode && n.modes.includes(mode)))
}

export function navItemsForLang(
  lang: Lang,
  mode?: GatewayMode
): Array<NavItem & { label: string; subtitle: string }> {
  return visibleForMode(NAV_ITEMS, mode).map((n) => ({
    ...n,
    label: translate(lang, n.labelKey),
    subtitle: translate(lang, n.subtitleKey),
  }))
}

export function requiresAuth(navId: string): boolean {
  const n = findNavItemById(navId)
  if (!n) return true
  return !n.public
}
