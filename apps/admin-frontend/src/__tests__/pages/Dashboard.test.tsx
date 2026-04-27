import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../../pages/Dashboard';
import { useStore } from '../../lib/store';
import type { SiteInfo } from '../../lib/types';
import { mockJsonFetch, renderWithRouter, resetStore } from '../test-utils';

const SITE: SiteInfo = {
  ok: true,
  site: { routes: 5 },
  mode: 'cms',
  origin: 'https://docs.example.com',
  breakers: { 'docs.example.com': { state: 'closed', failures: 0 } },
  cache: { ttlMs: 86400000, swrMs: 3600000, redisEnabled: true },
  multiContext: true,
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetStore();
  useStore.setState({ authed: true, adminEnabled: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Dashboard', () => {
  it('shows auth gate when not authed', () => {
    useStore.setState({ authed: false });
    renderWithRouter(<Dashboard />);
    expect(screen.getByText(/인증이 필요한 페이지/)).toBeInTheDocument();
  });

  it('loads + displays site info', async () => {
    globalThis.fetch = mockJsonFetch(SITE);
    renderWithRouter(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId('page-dashboard')).toBeInTheDocument());
    expect(screen.getByText('cms')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('docs.example.com')).toBeInTheDocument();
  });

  it('renders breaker state pill', async () => {
    globalThis.fetch = mockJsonFetch(SITE);
    renderWithRouter(<Dashboard />);
    await waitFor(() => expect(screen.getByTestId('page-dashboard')).toBeInTheDocument());
    expect(screen.getByText('closed')).toBeInTheDocument();
  });
});
