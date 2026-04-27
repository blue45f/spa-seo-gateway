import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Warm } from '../../pages/Warm';
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

describe('Warm page', () => {
  it('submits sitemap + max + concurrency', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          report: {
            sitemap: 'https://x/sitemap.xml',
            found: 10,
            warmed: 8,
            skipped: 1,
            errors: 1,
            durationMs: 1234,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    globalThis.fetch = fetchMock;
    const user = userEvent.setup();
    renderWithRouter(<Warm />);
    await user.type(screen.getByPlaceholderText(/sitemap\.xml/), 'https://x/sitemap.xml');
    await user.click(screen.getByText('워밍 시작'));

    await waitFor(() => expect(screen.getByText('found')).toBeInTheDocument());
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
  });
});
