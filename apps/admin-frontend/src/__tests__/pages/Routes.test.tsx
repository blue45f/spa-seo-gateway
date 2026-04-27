import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoutesPage } from '../../pages/Routes';
import { useStore } from '../../lib/store';
import { renderWithRouter, resetStore } from '../test-utils';

const originalFetch = globalThis.fetch;
const ROUTES = [
  { pattern: '^/blog/', ttlMs: 3600000, waitUntil: 'networkidle2', ignore: false },
  { pattern: '^/products/', waitSelector: '[data-loaded]' },
];

beforeEach(() => {
  resetStore();
  useStore.setState({ authed: true, adminEnabled: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Routes page', () => {
  it('lists existing routes from API', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, routes: ROUTES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderWithRouter(<RoutesPage />);
    await waitFor(() => expect(screen.getByDisplayValue('^/blog/')).toBeInTheDocument());
    expect(screen.getByDisplayValue('^/products/')).toBeInTheDocument();
    expect(screen.getByDisplayValue('[data-loaded]')).toBeInTheDocument();
  });

  it('add button appends a new empty row', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, routes: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderWithRouter(<RoutesPage />);
    await waitFor(() => expect(screen.getByText(/정의된 라우트가 없습니다/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('+ 추가'));
    await waitFor(() => {
      const inputs = screen.getAllByPlaceholderText('^/products/[0-9]+');
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it('save button posts cleaned payload', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, routes: ROUTES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, routes: ROUTES }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;
    renderWithRouter(<RoutesPage />);
    await waitFor(() => expect(screen.getByDisplayValue('^/blog/')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByText('저장 (메모리)'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const putCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall?.[1] as RequestInit).body as string);
    expect(body.persist).toBe(false);
    expect(body.routes[0].pattern).toBe('^/blog/');
  });
});
