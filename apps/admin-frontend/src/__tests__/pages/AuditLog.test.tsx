import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditLog } from '../../pages/AuditLog';
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

describe('AuditLog page', () => {
  it('shows empty state when no events', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, events: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderWithRouter(<AuditLog />);
    await waitFor(() =>
      expect(screen.getByText('기록된 감사 이벤트가 없습니다.')).toBeInTheDocument(),
    );
  });

  it('renders event rows', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          events: [
            {
              ts: '2026-04-27T10:30:45.123Z',
              actor: 'admin',
              action: 'cache.clear',
              outcome: 'ok',
              hash: 'abcd1234ef5678abcdef',
            },
            {
              ts: '2026-04-27T10:31:00.000Z',
              actor: 'admin',
              action: 'visual.diff',
              target: 'https://x/y',
              outcome: 'error',
              hash: '99887766554433221100',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    renderWithRouter(<AuditLog />);
    await waitFor(() => expect(screen.getByText('cache.clear')).toBeInTheDocument());
    expect(screen.getByText('visual.diff')).toBeInTheDocument();
    expect(screen.getByText('https://x/y')).toBeInTheDocument();
    expect(screen.getByText('10:30:45')).toBeInTheDocument();
  });

  it('verify button calls /audit/verify', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, events: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, verified: true, brokenAt: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;
    renderWithRouter(<AuditLog />);
    await waitFor(() => screen.getByText('체인 검증'));
    fireEvent.click(screen.getByText('체인 검증'));
    await waitFor(() => expect(screen.getAllByText('✓ 무결성 OK').length).toBeGreaterThan(0));
  });
});
