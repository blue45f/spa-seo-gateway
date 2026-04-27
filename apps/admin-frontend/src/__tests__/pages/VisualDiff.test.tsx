import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisualDiff } from '../../pages/VisualDiff';
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

describe('VisualDiff page', () => {
  it('captures and shows diff result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            url: 'https://x/',
            baselinePath: '/data/baseline.png',
            diffPath: '/data/diff.png',
            width: 1280,
            height: 800,
            diffPixels: 12,
            diffPercent: 0.05,
            baselineCreated: false,
            durationMs: 1200,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    globalThis.fetch = fetchMock;
    const user = userEvent.setup();
    renderWithRouter(<VisualDiff />);

    await user.type(screen.getByPlaceholderText(/example\.com/), 'https://x.com/');
    fireEvent.submit(screen.getByText('캡처 + 비교').closest('form')!);

    await waitFor(() => expect(screen.getByText('0.050%')).toBeInTheDocument());
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('1280×800')).toBeInTheDocument();
    expect(screen.getByText('1200ms')).toBeInTheDocument();
  });

  it('passes options into request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            url: 'https://x/',
            baselinePath: '/p',
            diffPath: null,
            width: 1,
            height: 1,
            diffPixels: 0,
            diffPercent: 0,
            baselineCreated: true,
            durationMs: 1,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    globalThis.fetch = fetchMock;
    const user = userEvent.setup();
    renderWithRouter(<VisualDiff />);
    await user.type(screen.getByPlaceholderText(/example\.com/), 'https://x.com/');
    await user.selectOptions(screen.getByDisplayValue(/auto/), 'create');
    await user.click(screen.getByLabelText(/fullPage/i));
    fireEvent.submit(screen.getByText('캡처 + 비교').closest('form')!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.mode).toBe('create');
    expect(body.fullPage).toBe(true);
  });
});
