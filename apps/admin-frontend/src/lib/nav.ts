import { translate } from './i18n';
import type { Lang, PublicInfo } from './types';

export type GatewayMode = PublicInfo['mode'];

export type NavItem = {
  id: string;
  /** react-router path 부분 (basename 은 '/admin/ui') */
  path: string;
  icon: string;
  labelKey: string;
  subtitleKey: string;
  /** 인증 없이 접근 가능 */
  public?: boolean;
  /** 특정 모드에서만 노출 (지정 시 해당 모드에서만 사이드바/router/cmd palette 에 등장). */
  modes?: GatewayMode[];
};

/** 사이드바 / command palette / 라우터 매핑이 모두 참조하는 단일 진실 원천. */
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'welcome',
    path: '/',
    icon: '👋',
    labelKey: 'nav.welcome',
    subtitleKey: 'nav.welcome.sub',
    public: true,
  },
  {
    id: 'dashboard',
    path: '/dashboard',
    icon: '📊',
    labelKey: 'nav.dashboard',
    subtitleKey: 'nav.dashboard.sub',
  },
  {
    id: 'routes',
    path: '/routes',
    icon: '🛣️',
    labelKey: 'nav.routes',
    subtitleKey: 'nav.routes.sub',
  },
  { id: 'cache', path: '/cache', icon: '🗄️', labelKey: 'nav.cache', subtitleKey: 'nav.cache.sub' },
  { id: 'warm', path: '/warm', icon: '🔥', labelKey: 'nav.warm', subtitleKey: 'nav.warm.sub' },
  { id: 'test', path: '/test', icon: '🧪', labelKey: 'nav.test', subtitleKey: 'nav.test.sub' },
  {
    id: 'metrics',
    path: '/metrics',
    icon: '📈',
    labelKey: 'nav.metrics',
    subtitleKey: 'nav.metrics.sub',
  },
  {
    id: 'lighthouse',
    path: '/lighthouse',
    icon: '💡',
    labelKey: 'nav.lighthouse',
    subtitleKey: 'nav.lighthouse.sub',
  },
  {
    id: 'visual',
    path: '/visual',
    icon: '🖼️',
    labelKey: 'nav.visual',
    subtitleKey: 'nav.visual.sub',
  },
  { id: 'ai', path: '/ai', icon: '✨', labelKey: 'nav.ai', subtitleKey: 'nav.ai.sub' },
  { id: 'audit', path: '/audit', icon: '🔐', labelKey: 'nav.audit', subtitleKey: 'nav.audit.sub' },
  // 모드별 페이지 — Sidebar/Router/CmdPalette 가 publicInfo.mode 기준으로 필터.
  {
    id: 'sites',
    path: '/sites',
    icon: '🌐',
    labelKey: 'nav.sites',
    subtitleKey: 'nav.sites.sub',
    modes: ['cms'],
  },
  {
    id: 'tenants',
    path: '/tenants',
    icon: '🏢',
    labelKey: 'nav.tenants',
    subtitleKey: 'nav.tenants.sub',
    modes: ['saas'],
  },
  {
    id: 'api',
    path: '/api',
    icon: '🔌',
    labelKey: 'nav.api',
    subtitleKey: 'nav.api.sub',
    public: true,
  },
  {
    id: 'library',
    path: '/library',
    icon: '📦',
    labelKey: 'nav.library',
    subtitleKey: 'nav.library.sub',
    public: true,
  },
  {
    id: 'help',
    path: '/help',
    icon: '❓',
    labelKey: 'nav.help',
    subtitleKey: 'nav.help.sub',
    public: true,
  },
];

export function findNavItemByPath(path: string): NavItem | undefined {
  // basename 이 '/admin/ui' 라 path 가 '/' 부터 시작.
  const normalized = path === '/' ? '/' : path.replace(/\/$/, '');
  return NAV_ITEMS.find((n) => n.path === normalized);
}

export function findNavItemById(id: string): NavItem | undefined {
  return NAV_ITEMS.find((n) => n.id === id);
}

/** 현재 mode 에서 노출되는 nav 항목만 (modes 필드가 없거나 현재 모드를 포함하면 OK). */
export function visibleForMode(items: NavItem[], mode?: GatewayMode): NavItem[] {
  return items.filter((n) => !n.modes || (mode && n.modes.includes(mode)));
}

export function navItemsForLang(
  lang: Lang,
  mode?: GatewayMode,
): Array<NavItem & { label: string; subtitle: string }> {
  return visibleForMode(NAV_ITEMS, mode).map((n) => ({
    ...n,
    label: translate(lang, n.labelKey),
    subtitle: translate(lang, n.subtitleKey),
  }));
}

export function requiresAuth(navId: string): boolean {
  const n = findNavItemById(navId);
  if (!n) return true;
  return !n.public;
}
