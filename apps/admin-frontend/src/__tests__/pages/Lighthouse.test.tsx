import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Lighthouse } from '../../pages/Lighthouse';
import { useStore } from '../../lib/store';
import { renderWithRouter, resetStore } from '../test-utils';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetStore();
  useStore.setState({ authed: true, adminEnabled: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Lighthouse page', () => {
  it('runs measurement and shows scores', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          url: 'https://x.com/',
          scores: { performance: 95, accessibility: 80, seo: 100, bestPractices: 70 },
          cached: true,
          durationMs: 6800,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const user = userEvent.setup();
    renderWithRouter(<Lighthouse />);
    await user.type(screen.getByPlaceholderText('https://www.example.com/'), 'https://x.com/');
    await user.click(screen.getByText('측정 실행'));
    await waitFor(() => expect(screen.getByText('95')).toBeInTheDocument());
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText(/\(캐시된 결과\)/)).toBeInTheDocument();
  });
});
