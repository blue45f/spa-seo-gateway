import { describe, expect, it } from 'vitest';
import {
  findNavItemById,
  findNavItemByPath,
  NAV_ITEMS,
  navItemsForLang,
  requiresAuth,
} from '../../lib/nav';

describe('navItems', () => {
  it('contains all 14 tabs from the legacy admin UI', () => {
    expect(NAV_ITEMS).toHaveLength(14);
    const ids = NAV_ITEMS.map((n) => n.id);
    for (const id of [
      'welcome',
      'dashboard',
      'routes',
      'cache',
      'warm',
      'test',
      'metrics',
      'lighthouse',
      'visual',
      'ai',
      'audit',
      'api',
      'library',
      'help',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('marks public-only tabs', () => {
    expect(requiresAuth('welcome')).toBe(false);
    expect(requiresAuth('api')).toBe(false);
    expect(requiresAuth('library')).toBe(false);
    expect(requiresAuth('help')).toBe(false);
  });

  it('requires auth for everything else', () => {
    expect(requiresAuth('dashboard')).toBe(true);
    expect(requiresAuth('routes')).toBe(true);
    expect(requiresAuth('audit')).toBe(true);
    expect(requiresAuth('ai')).toBe(true);
  });

  it('finds nav item by path', () => {
    expect(findNavItemByPath('/visual')?.id).toBe('visual');
    expect(findNavItemByPath('/')?.id).toBe('welcome');
  });

  it('finds nav item by id', () => {
    expect(findNavItemById('audit')?.path).toBe('/audit');
  });

  it('translates labels per language', () => {
    const ko = navItemsForLang('ko');
    const en = navItemsForLang('en');
    const koVisual = ko.find((n) => n.id === 'visual');
    const enVisual = en.find((n) => n.id === 'visual');
    expect(koVisual?.label).toBe('시각 회귀');
    expect(enVisual?.label).toBe('Visual Diff');
  });
});
