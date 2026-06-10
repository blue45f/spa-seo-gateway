import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from '../../components/Header';
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

describe('Header', () => {
  it('renders the active nav item title', () => {
    renderWithRouter(<Header />);
    expect(screen.getByRole('heading', { name: '소개' })).toBeInTheDocument();
  });

  it('logout keeps a 44px mobile touch target and clears authed', async () => {
    useStore.setState({ authed: true });
    globalThis.fetch = mockJsonFetch({ ok: true });
    renderWithRouter(<Header />);
    const btn = screen.getByText('logout');
    // desktop density stays intact via the md: reset; mobile gets the 44px floor
    expect(btn).toHaveClass('min-h-[44px]', 'md:min-h-0');
    fireEvent.click(btn);
    await waitFor(() => expect(useStore.getState().authed).toBe(false));
  });
});
