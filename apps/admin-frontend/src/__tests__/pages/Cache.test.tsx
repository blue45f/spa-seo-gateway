import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cache } from '../../pages/Cache';
import { useStore } from '../../lib/store';
import { mockJsonFetch, renderWithRouter, resetStore } from '../test-utils';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetStore();
  useStore.setState({ authed: true, adminEnabled: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Cache page', () => {
  it('renders both forms', () => {
    renderWithRouter(<Cache />);
    expect(screen.getByPlaceholderText(/example.com\/posts/)).toBeInTheDocument();
    expect(screen.getByText(/전체 초기화/)).toBeInTheDocument();
  });

  it('invalidates a single URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, key: 'cache:abc' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;
    const user = userEvent.setup();
    renderWithRouter(<Cache />);
    await user.type(screen.getByPlaceholderText(/example.com\/posts/), 'https://x.com/y');
    await user.click(screen.getByText('URL 무효화'));
    expect(fetchMock).toHaveBeenCalled();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.url).toBe('https://x.com/y');
  });

  it('clear all triggers confirm', () => {
    // happy-dom 의 window.confirm 은 stub 일 수 있어 직접 덮어쓴다.
    const confirmFn = vi.fn().mockReturnValue(false);
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      writable: true,
      value: confirmFn,
    });
    globalThis.fetch = mockJsonFetch({ ok: true, cleared: 0 });
    renderWithRouter(<Cache />);
    fireEvent.click(screen.getByText('전체 초기화'));
    expect(confirmFn).toHaveBeenCalled();
  });
});
