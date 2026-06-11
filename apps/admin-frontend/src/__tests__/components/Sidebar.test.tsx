import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../../components/Sidebar';
import { useStore } from '../../lib/store';
import stylesCss from '../../styles.css?raw';
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

  it('theme button cycles system → light → dark → system', () => {
    renderWithRouter(<Sidebar />);
    // resetStore leaves themeMode at its default 'system'
    fireEvent.click(screen.getByText('시스템 테마'));
    expect(useStore.getState().themeMode).toBe('light');
    fireEvent.click(screen.getByText('라이트 모드'));
    expect(useStore.getState().themeMode).toBe('dark');
    expect(useStore.getState().theme).toBe('dark');
    fireEvent.click(screen.getByText('다크 모드'));
    expect(useStore.getState().themeMode).toBe('system');
  });

  it('density button toggles comfortable ↔ compact', () => {
    renderWithRouter(<Sidebar />);
    fireEvent.click(screen.getByText('보통 간격'));
    expect(useStore.getState().density).toBe('compact');
    expect(screen.getByText('좁은 간격')).toBeInTheDocument();
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

  it('keeps 44px mobile touch targets on nav links and footer controls', () => {
    useStore.setState({ authed: true });
    renderWithRouter(<Sidebar />);
    const controls = [
      screen.getByText('소개').closest('a'),
      screen.getByText('GitHub').closest('a'),
      screen.getByText('시스템 테마').closest('button'),
      screen.getByText('보통 간격').closest('button'),
      screen.getByText('English').closest('button'),
      screen.getByText('logout').closest('button'),
    ];
    for (const control of controls) {
      // desktop density stays intact via the lg: reset; mobile gets the 44px floor
      expect(control).toHaveClass('min-h-[44px]', 'lg:min-h-0');
    }
  });
});

describe('mobile sidebar breakpoint boundary', () => {
  it('keeps the collapsed-slide media query strictly below the Tailwind lg breakpoint', () => {
    // `lg:`(width >= 1024px)와 정확히 1024px 에서 겹치면 static 사이드바가
    // .collapsed 의 transform: translateX(-100%) 로 사라진 채 240px 데드존을 남기고,
    // 햄버거(lg:hidden)도 없어 내비게이션이 끊긴다. 모바일 쿼리는 1024px 미만이어야 한다.
    expect(stylesCss).toMatch(/@media \(width < 1024px\)/);
    expect(stylesCss).not.toMatch(/max-width:\s*1024px/);
  });
});
