import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import { SiteDetail } from '../../pages/SiteDetail';
import { useStore } from '../../lib/store';
import type { Site } from '../../lib/types';
import { resetStore } from '../test-utils';

const SITE: Site = {
  id: 'docs',
  name: 'Docs',
  origin: 'https://docs.example.com',
  routes: [
    { pattern: '^/$', ttlMs: 600000 },
    { pattern: '^/blog/', ttlMs: 3600000, waitSelector: '[data-loaded]' },
  ],
  enabled: true,
  webhooks: undefined,
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

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sites/:id" element={<SiteDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SiteDetail page', () => {
  it('shows metadata + routes editor for the matched site', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, sites: [SITE] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderAt('/sites/docs');
    await waitFor(() => expect(screen.getByTestId('page-site-detail')).toBeInTheDocument());
    expect(screen.getByDisplayValue('docs')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Docs')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://docs.example.com')).toBeInTheDocument();
    // RoutesEditor 가 사이트의 routes 를 보여주는지
    expect(screen.getByDisplayValue('^/$')).toBeInTheDocument();
    expect(screen.getByDisplayValue('^/blog/')).toBeInTheDocument();
    expect(screen.getByDisplayValue('[data-loaded]')).toBeInTheDocument();
  });

  it('shows not-found message for unknown id', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, sites: [SITE] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderAt('/sites/missing');
    await waitFor(() => expect(screen.getByText(/존재하지 않는 사이트/)).toBeInTheDocument());
  });

  it('save button POSTs the modified site (with cleaned routes)', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, sites: [SITE] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, site: SITE }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, sites: [SITE] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;
    renderAt('/sites/docs');
    await waitFor(() => expect(screen.getByDisplayValue('docs')).toBeInTheDocument());

    fireEvent.click(screen.getByText('저장'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const postCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
    expect(body.id).toBe('docs');
    expect(body.routes).toHaveLength(2);
    expect(body.routes[0].pattern).toBe('^/$');
    expect(body.routes[0].ttlMs).toBe(600000);
  });
});
