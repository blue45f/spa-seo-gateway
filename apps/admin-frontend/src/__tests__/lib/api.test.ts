import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, fetchText } from '../../lib/api';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('api()', () => {
  it('returns parsed JSON for 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, value: 42 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const r = await api<{ ok: true; value: number }>('GET', '/x');
    expect(r.value).toBe(42);
  });

  it('sends JSON body for POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;
    await api('POST', '/x', { foo: 'bar' });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ foo: 'bar' }));
  });

  it('throws ApiError on non-OK response', async () => {
    // mockImplementation 으로 매 호출마다 새 Response — body 가 한 번만 read 가능하므로.
    globalThis.fetch = vi.fn().mockImplementation(
      () =>
        new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
    );
    await expect(api('GET', '/x')).rejects.toThrow(ApiError);
    await expect(api('GET', '/x')).rejects.toThrow('unauthorized');
  });

  it('attaches x-admin-token when token + non-public', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    globalThis.fetch = fetchMock;
    await api('GET', '/x', undefined, { token: 'sekret' });
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['x-admin-token']).toBe('sekret');
  });

  it('omits x-admin-token for public endpoints', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    globalThis.fetch = fetchMock;
    await api('GET', '/x', undefined, { token: 'sekret', publicEndpoint: true });
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['x-admin-token']).toBeUndefined();
  });

  it('uses same-origin credentials so cookies are sent', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    globalThis.fetch = fetchMock;
    await api('GET', '/x');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe('same-origin');
  });

  it('returns text when asText: true', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('plain text', { status: 200 }));
    const r = await api<string>('GET', '/x', undefined, { asText: true });
    expect(r).toBe('plain text');
  });
});

describe('fetchText()', () => {
  it('returns response body text', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('hello', { status: 200 }));
    expect(await fetchText('/x')).toBe('hello');
  });

  it('throws ApiError on non-OK', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('boom', { status: 500, statusText: 'Server Error' }));
    await expect(fetchText('/x')).rejects.toThrow(ApiError);
  });
});
