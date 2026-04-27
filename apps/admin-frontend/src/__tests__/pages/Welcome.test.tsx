import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Welcome } from '../../pages/Welcome';
import type { PublicInfo } from '../../lib/types';
import { renderWithRouter, resetStore } from '../test-utils';

const INFO: PublicInfo = {
  ok: true,
  mode: 'render-only',
  origin: 'https://www.example.com',
  multiContext: false,
  cache: { ttlMs: 86400000, redisEnabled: true },
  site: { routes: 4 },
  nodeVersion: 'v24.0.0',
  uptimeSec: 3600,
  timestamp: '2026-04-27T00:00:00Z',
};

beforeEach(() => {
  resetStore();
});

describe('Welcome page', () => {
  it('renders headline + intro', () => {
    renderWithRouter(<Welcome />, { publicInfo: INFO });
    expect(screen.getByTestId('page-welcome')).toBeInTheDocument();
    expect(screen.getByText('SPA SEO Gateway')).toBeInTheDocument();
  });

  it('shows mode/origin/uptime/node from publicInfo', () => {
    renderWithRouter(<Welcome />, { publicInfo: INFO });
    expect(screen.getByText('render-only')).toBeInTheDocument();
    expect(screen.getByText('https://www.example.com')).toBeInTheDocument();
    expect(screen.getByText('1h 0m')).toBeInTheDocument();
    expect(screen.getByText('v24.0.0')).toBeInTheDocument();
  });

  it('shows ... when publicInfo is null', () => {
    renderWithRouter(<Welcome />, { publicInfo: null });
    const dots = screen.getAllByText('...');
    expect(dots.length).toBeGreaterThan(0);
  });

  it('renders quickstart steps with router links', () => {
    renderWithRouter(<Welcome />, { publicInfo: INFO });
    expect(screen.getByText('렌더 테스트')).toBeInTheDocument();
    expect(screen.getByText('워밍')).toBeInTheDocument();
  });
});
