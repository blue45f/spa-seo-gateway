import { translate } from './i18n';
import type { Lang } from './types';

export type NavItem = {
  id: string;
  /** react-router path 부분 (basename 은 '/admin/ui') */
  path: string;
  icon: string;
  labelKey: string;
  subtitleKey: string;
  /** 인증 없이 접근 가능 */
  public?: boolean;
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

export function navItemsForLang(lang: Lang): Array<NavItem & { label: string; subtitle: string }> {
  return NAV_ITEMS.map((n) => ({
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
