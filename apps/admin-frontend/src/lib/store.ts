/**
 * 전역 admin UI 상태 — Zustand. localStorage 동기화는 명시적으로 .persist() 미사용 (단순함 유지).
 */
import { create } from 'zustand';
import { translate } from './i18n';
import type { Lang, Theme, ToastItem, ToastKind } from './types';

const TOUR_KEY = 'seo-admin-tour-seen';
const THEME_KEY = 'seo-admin-theme';
const LANG_KEY = 'seo-admin-lang';

function detectInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(THEME_KEY) as Theme | null;
  if (saved === 'dark' || saved === 'light') return saved;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function detectInitialLang(): Lang {
  if (typeof window === 'undefined') return 'ko';
  const saved = localStorage.getItem(LANG_KEY) as Lang | null;
  if (saved === 'ko' || saved === 'en') return saved;
  return navigator.language?.startsWith('ko') ? 'ko' : 'en';
}

const TOAST_ICONS: Record<ToastKind, string> = {
  success: '✓',
  error: '✗',
  warn: '⚠',
  info: 'ℹ️',
};

type State = {
  authed: boolean;
  adminEnabled: boolean;
  loginToken: string;
  theme: Theme;
  lang: Lang;
  sidebarOpen: boolean;
  cmdPaletteOpen: boolean;
  shortcutsOpen: boolean;
  tourSeen: boolean;
  tourStep: number;
  toasts: ToastItem[];
  globalError: string;
};

type Actions = {
  setAuthed(v: boolean): void;
  setAdminEnabled(v: boolean): void;
  toggleTheme(): void;
  toggleLang(): void;
  toggleSidebar(): void;
  setSidebarOpen(open: boolean): void;
  openCmd(): void;
  closeCmd(): void;
  openShortcuts(): void;
  closeShortcuts(): void;
  startTour(): void;
  endTour(): void;
  tourNext(): void;
  pushToast(message: string, kind?: ToastKind): void;
  removeToast(id: number): void;
  setGlobalError(msg: string): void;
  /** 현재 언어로 i18n key 를 lookup */
  t(key: string, fallback?: string): string;
};

export const useStore = create<State & Actions>((set, get) => ({
  authed: false,
  adminEnabled: true,
  loginToken: '',
  theme: detectInitialTheme(),
  lang: detectInitialLang(),
  sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  cmdPaletteOpen: false,
  shortcutsOpen: false,
  tourSeen: typeof window !== 'undefined' ? localStorage.getItem(TOUR_KEY) === '1' : true,
  tourStep: 0,
  toasts: [],
  globalError: '',

  setAuthed(v) {
    set({ authed: v });
  },
  setAdminEnabled(v) {
    set({ adminEnabled: v });
  },

  toggleTheme() {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next === 'dark');
      localStorage.setItem(THEME_KEY, next);
    }
    set({ theme: next });
  },

  toggleLang() {
    const next: Lang = get().lang === 'ko' ? 'en' : 'ko';
    if (typeof window !== 'undefined') localStorage.setItem(LANG_KEY, next);
    set({ lang: next });
  },

  toggleSidebar() {
    set((s) => ({ sidebarOpen: !s.sidebarOpen }));
  },
  setSidebarOpen(open) {
    set({ sidebarOpen: open });
  },

  openCmd() {
    set({ cmdPaletteOpen: true });
  },
  closeCmd() {
    set({ cmdPaletteOpen: false });
  },

  openShortcuts() {
    set({ shortcutsOpen: true });
  },
  closeShortcuts() {
    set({ shortcutsOpen: false });
  },

  startTour() {
    set({ tourStep: 0, tourSeen: false });
  },
  endTour() {
    if (typeof window !== 'undefined') localStorage.setItem(TOUR_KEY, '1');
    set({ tourSeen: true, tourStep: -1 });
  },
  tourNext() {
    set((s) => ({ tourStep: s.tourStep + 1 }));
  },

  pushToast(message, kind = 'info') {
    const id = Date.now() + Math.random();
    set((s) => ({
      toasts: [...s.toasts, { id, message, kind, icon: TOAST_ICONS[kind] }],
    }));
    setTimeout(() => get().removeToast(id), 4000);
  },
  removeToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  setGlobalError(msg) {
    set({ globalError: msg });
  },

  t(key, fallback) {
    return translate(get().lang, key, fallback);
  },
}));
