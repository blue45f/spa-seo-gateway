import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../../components/Sidebar';
import { useStore } from '../../lib/store';
import { mockJsonFetch, renderWithRouter, resetStore } from '../test-utils';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Sidebar', () => {
  it('renders all base nav items (no mode gates active)', () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByText('소개')).toBeInTheDocument();
    expect(screen.getByText('대시보드')).toBeInTheDocument();
    expect(screen.getByText('라우트')).toBeInTheDocument();
    expect(screen.getByText('시각 회귀')).toBeInTheDocument();
    expect(screen.getByText('AI Schema')).toBeInTheDocument();
    expect(screen.getByText('감사 로그')).toBeInTheDocument();
    // mode-gated items hidden when mode unknown
    expect(screen.queryByText('사이트 관리')).not.toBeInTheDocument();
    expect(screen.queryByText('테넌트 관리')).not.toBeInTheDocument();
  });

  it('renders Sites tab only in cms mode', () => {
    renderWithRouter(<Sidebar publicMode="cms" />);
    expect(screen.getByText('사이트 관리')).toBeInTheDocument();
    expect(screen.queryByText('테넌트 관리')).not.toBeInTheDocument();
  });

  it('renders Tenants tab only in saas mode', () => {
    renderWithRouter(<Sidebar publicMode="saas" />);
    expect(screen.getByText('테넌트 관리')).toBeInTheDocument();
    expect(screen.queryByText('사이트 관리')).not.toBeInTheDocument();
  });

  it('shows public badge for public tabs only', () => {
    renderWithRouter(<Sidebar />);
    const badges = screen.getAllByText('public');
    // welcome / api / library / help → 4 public badges
    expect(badges).toHaveLength(4);
  });

  it('toggleTheme changes theme on click', () => {
    renderWithRouter(<Sidebar />);
    expect(useStore.getState().theme).toBe('light');
    fireEvent.click(screen.getByText('다크 모드'));
    expect(useStore.getState().theme).toBe('dark');
  });

  it('toggleLang switches between KO and EN', () => {
    renderWithRouter(<Sidebar />);
    expect(useStore.getState().lang).toBe('ko');
    fireEvent.click(screen.getByText('English'));
    expect(useStore.getState().lang).toBe('en');
    expect(screen.getByText('Welcome')).toBeInTheDocument();
  });

  it('logout calls api and clears authed', async () => {
    useStore.setState({ authed: true });
    globalThis.fetch = mockJsonFetch({ ok: true });
    renderWithRouter(<Sidebar />);
    const btns = screen.getAllByText('logout');
    fireEvent.click(btns[0]!);
    await waitFor(() => expect(useStore.getState().authed).toBe(false));
  });

  it('shows public mode badge when provided', () => {
    renderWithRouter(<Sidebar publicMode="render-only" />);
    expect(screen.getByText('render-only')).toBeInTheDocument();
  });
});
