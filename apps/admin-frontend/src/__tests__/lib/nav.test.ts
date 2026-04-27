import { describe, expect, it } from 'vitest';
import {
  findNavItemById,
  findNavItemByPath,
  NAV_ITEMS,
  navItemsForLang,
  requiresAuth,
  visibleForMode,
} from '../../lib/nav';

describe('navItems', () => {
  it('contains all 16 tabs (14 base + sites + tenants)', () => {
    expect(NAV_ITEMS).toHaveLength(16);
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
      'sites',
      'tenants',
      'api',
      'library',
      'help',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('sites tab is gated to cms mode only', () => {
    const sites = findNavItemById('sites');
    expect(sites?.modes).toEqual(['cms']);
  });

  it('tenants tab is gated to saas mode only', () => {
    const tenants = findNavItemById('tenants');
    expect(tenants?.modes).toEqual(['saas']);
  });

  it('visibleForMode hides sites/tenants in render-only mode', () => {
    const ids = visibleForMode(NAV_ITEMS, 'render-only').map((n) => n.id);
    expect(ids).not.toContain('sites');
    expect(ids).not.toContain('tenants');
  });

  it('visibleForMode includes sites in cms mode (excludes tenants)', () => {
    const ids = visibleForMode(NAV_ITEMS, 'cms').map((n) => n.id);
    expect(ids).toContain('sites');
    expect(ids).not.toContain('tenants');
  });

  it('visibleForMode includes tenants in saas mode (excludes sites)', () => {
    const ids = visibleForMode(NAV_ITEMS, 'saas').map((n) => n.id);
    expect(ids).toContain('tenants');
    expect(ids).not.toContain('sites');
  });

  it('visibleForMode with no mode hides both gated items', () => {
    const ids = visibleForMode(NAV_ITEMS, undefined).map((n) => n.id);
    expect(ids).not.toContain('sites');
    expect(ids).not.toContain('tenants');
  });

  it('marks public-only tabs', () => {
    expect(requiresAuth('welcome')).toBe(false);
    expect(requiresAuth('api')).toBe(false);
    expect(requiresAuth('library')).toBe(false);
    expect(requiresAuth('help')).toBe(false);
  });

  it('requires auth for sites + tenants', () => {
    expect(requiresAuth('sites')).toBe(true);
    expect(requiresAuth('tenants')).toBe(true);
  });

  it('finds nav item by path', () => {
    expect(findNavItemByPath('/visual')?.id).toBe('visual');
    expect(findNavItemByPath('/sites')?.id).toBe('sites');
    expect(findNavItemByPath('/tenants')?.id).toBe('tenants');
    expect(findNavItemByPath('/')?.id).toBe('welcome');
  });

  it('finds nav item by id', () => {
    expect(findNavItemById('audit')?.path).toBe('/audit');
    expect(findNavItemById('sites')?.path).toBe('/sites');
    expect(findNavItemById('tenants')?.path).toBe('/tenants');
  });

  it('translates labels per language (mode-filtered)', () => {
    const koCms = navItemsForLang('ko', 'cms');
    const enCms = navItemsForLang('en', 'cms');
    expect(koCms.find((n) => n.id === 'sites')?.label).toBe('사이트 관리');
    expect(enCms.find((n) => n.id === 'sites')?.label).toBe('Sites');
    // tenants 는 cms 모드에선 노출되지 않음
    expect(koCms.find((n) => n.id === 'tenants')).toBeUndefined();
  });
});
