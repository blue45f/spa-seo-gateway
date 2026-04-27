import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiExplorer } from '../../pages/ApiExplorer';
import type { PublicInfo } from '../../lib/types';
import { renderWithRouter, resetStore } from '../test-utils';

const RENDER_ONLY: PublicInfo = {
  ok: true,
  mode: 'render-only',
  origin: null,
  multiContext: false,
  cache: { ttlMs: 0, redisEnabled: false },
  site: { routes: 0 },
  nodeVersion: 'v24',
  uptimeSec: 1,
  timestamp: '2026-04-27T00:00:00Z',
};

const CMS: PublicInfo = { ...RENDER_ONLY, mode: 'cms', multiContext: true };
const SAAS: PublicInfo = { ...RENDER_ONLY, mode: 'saas', multiContext: true };

beforeEach(() => {
  resetStore();
});

describe('ApiExplorer page', () => {
  it('renders common endpoints regardless of mode', () => {
    renderWithRouter(<ApiExplorer />, { publicInfo: RENDER_ONLY });
    expect(screen.getByText('/health')).toBeInTheDocument();
    expect(screen.getByText('/admin/api/site')).toBeInTheDocument();
    expect(screen.getByText('/admin/api/visual-diff')).toBeInTheDocument();
    expect(screen.getByText('/admin/api/ai/schema')).toBeInTheDocument();
    expect(screen.getByText('/admin/api/audit/verify')).toBeInTheDocument();
  });

  it('adds cms-specific endpoints in cms mode', () => {
    renderWithRouter(<ApiExplorer />, { publicInfo: CMS });
    // /admin/api/sites 변형들 (목록/CRUD/cache/warm) 이 여럿 존재.
    expect(screen.getAllByText(/^\/admin\/api\/sites/).length).toBeGreaterThan(1);
    expect(screen.getByText('/admin/api/cms/stats')).toBeInTheDocument();
  });

  it('adds saas-specific endpoints in saas mode', () => {
    renderWithRouter(<ApiExplorer />, { publicInfo: SAAS });
    expect(screen.getAllByText(/^\/admin\/api\/tenants/).length).toBeGreaterThan(1);
    expect(screen.getByText('/api/cache/invalidate')).toBeInTheDocument();
  });
});
