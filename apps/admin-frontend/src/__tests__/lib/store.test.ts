import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../../lib/store';

describe('admin store', () => {
  beforeEach(() => {
    useStore.setState({
      authed: false,
      adminEnabled: true,
      theme: 'light',
      lang: 'ko',
      sidebarOpen: true,
      cmdPaletteOpen: false,
      shortcutsOpen: false,
      tourSeen: true,
      tourStep: -1,
      toasts: [],
      globalError: '',
    });
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('dark');
    }
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('toggleTheme flips theme + dom class + localStorage', () => {
    useStore.getState().toggleTheme();
    expect(useStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage?.getItem('seo-admin-theme')).toBe('dark');
    useStore.getState().toggleTheme();
    expect(useStore.getState().theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('setThemeMode applies explicit dark and "system" (follows OS)', () => {
    useStore.getState().setThemeMode('dark');
    expect(useStore.getState().themeMode).toBe('dark');
    expect(useStore.getState().theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage?.getItem('seo-admin-theme')).toBe('dark');

    useStore.getState().setThemeMode('system');
    expect(useStore.getState().themeMode).toBe('system');
    expect(window.localStorage?.getItem('seo-admin-theme')).toBe('system');
    expect(['light', 'dark']).toContain(useStore.getState().theme);
  });

  it('toggleDensity flips density + root attr + localStorage', () => {
    useStore.setState({ density: 'comfortable' });
    useStore.getState().toggleDensity();
    expect(useStore.getState().density).toBe('compact');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    expect(window.localStorage?.getItem('seo-admin-density')).toBe('compact');
    useStore.getState().toggleDensity();
    expect(useStore.getState().density).toBe('comfortable');
  });

  it('toggleLang persists to localStorage', () => {
    useStore.getState().toggleLang();
    expect(useStore.getState().lang).toBe('en');
    expect(window.localStorage?.getItem('seo-admin-lang')).toBe('en');
  });

  it('t() resolves keys for the current language', () => {
    const t = useStore.getState().t;
    expect(t('nav.welcome')).toBe('소개');
    useStore.getState().toggleLang();
    expect(useStore.getState().t('nav.welcome')).toBe('Welcome');
  });

  it('pushToast adds and auto-removes after timeout', async () => {
    vi.useFakeTimers();
    useStore.getState().pushToast('hi', 'info');
    expect(useStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(4500);
    expect(useStore.getState().toasts).toHaveLength(0);
  });

  it('removeToast clears specific toast', () => {
    useStore.getState().pushToast('a', 'info');
    useStore.getState().pushToast('b', 'info');
    const target = useStore.getState().toasts[0]!;
    useStore.getState().removeToast(target.id);
    expect(useStore.getState().toasts).toHaveLength(1);
    expect(useStore.getState().toasts[0]?.message).toBe('b');
  });

  it('cmd palette open/close', () => {
    useStore.getState().openCmd();
    expect(useStore.getState().cmdPaletteOpen).toBe(true);
    useStore.getState().closeCmd();
    expect(useStore.getState().cmdPaletteOpen).toBe(false);
  });

  it('endTour persists tourSeen', () => {
    useStore.getState().endTour();
    expect(useStore.getState().tourSeen).toBe(true);
    expect(window.localStorage?.getItem('seo-admin-tour-seen')).toBe('1');
  });

  it('setGlobalError stores text', () => {
    useStore.getState().setGlobalError('boom');
    expect(useStore.getState().globalError).toBe('boom');
  });

  it('toggleSidebar flips sidebarOpen', () => {
    useStore.setState({ sidebarOpen: false });
    useStore.getState().toggleSidebar();
    expect(useStore.getState().sidebarOpen).toBe(true);
    useStore.getState().toggleSidebar();
    expect(useStore.getState().sidebarOpen).toBe(false);
  });

  it('setSidebarOpen sets exact value', () => {
    useStore.getState().setSidebarOpen(false);
    expect(useStore.getState().sidebarOpen).toBe(false);
    useStore.getState().setSidebarOpen(true);
    expect(useStore.getState().sidebarOpen).toBe(true);
  });

  it('openShortcuts / closeShortcuts', () => {
    useStore.getState().openShortcuts();
    expect(useStore.getState().shortcutsOpen).toBe(true);
    useStore.getState().closeShortcuts();
    expect(useStore.getState().shortcutsOpen).toBe(false);
  });

  it('startTour resets tour state', () => {
    useStore.setState({ tourStep: 5, tourSeen: true });
    useStore.getState().startTour();
    expect(useStore.getState().tourStep).toBe(0);
    expect(useStore.getState().tourSeen).toBe(false);
  });

  it('tourNext advances step', () => {
    useStore.setState({ tourStep: 0 });
    useStore.getState().tourNext();
    expect(useStore.getState().tourStep).toBe(1);
    useStore.getState().tourNext();
    expect(useStore.getState().tourStep).toBe(2);
  });
});
