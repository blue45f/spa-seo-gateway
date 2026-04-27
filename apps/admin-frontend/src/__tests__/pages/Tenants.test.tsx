import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateApiKey, Tenants } from '../../pages/Tenants';
import { useStore } from '../../lib/store';
import type { Tenant } from '../../lib/types';
import { renderWithRouter, resetStore } from '../test-utils';

const originalFetch = globalThis.fetch;

const TENANTS: Tenant[] = [
  {
    id: 'acme',
    name: 'ACME Corp',
    origin: 'https://www.acme.com',
    apiKey: 'tk_live_aaaaaaaaaaaaaaaaaaaa',
    routes: [],
    plan: 'pro',
    enabled: true,
  },
  {
    id: 'startup',
    name: 'Startup Inc',
    origin: 'https://startup.io',
    apiKey: 'tk_live_bbbbbbbbbbbbbbbbbbbb',
    routes: [],
    plan: 'free',
    enabled: false,
  },
];

beforeEach(() => {
  resetStore();
  useStore.setState({ authed: true, adminEnabled: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('generateApiKey', () => {
  it('produces a tk_live_ prefixed string of length >= 28', () => {
    const k = generateApiKey();
    expect(k).toMatch(/^tk_live_[0-9a-f]+$/);
    expect(k.length).toBeGreaterThanOrEqual(28);
  });

  it('produces a different key on each call', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a).not.toBe(b);
  });
});

describe('Tenants page (SaaS)', () => {
  it('lists tenants with masked API key + plan pill', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, tenants: TENANTS }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderWithRouter(<Tenants />);
    await waitFor(() => expect(screen.getByText('ACME Corp')).toBeInTheDocument());
    expect(screen.getByText('Startup Inc')).toBeInTheDocument();
    expect(screen.getByText('pro')).toBeInTheDocument();
    expect(screen.getByText('free')).toBeInTheDocument();
    // 마스킹 처리 — 전체 키가 노출되지 않아야 함.
    expect(screen.queryByText(TENANTS[0]!.apiKey)).not.toBeInTheDocument();
  });

  it('add modal generates an API key by default', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, tenants: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderWithRouter(<Tenants />);
    await waitFor(() => screen.getByText('+ 새 테넌트'));
    fireEvent.click(screen.getByText('+ 새 테넌트'));
    const form = await screen.findByTestId('tenant-form');
    const apiKeyInput = form.querySelectorAll('input')[3] as HTMLInputElement;
    expect(apiKeyInput.value).toMatch(/^tk_live_/);
    expect(apiKeyInput.value.length).toBeGreaterThanOrEqual(20);
  });

  it('regenerates apiKey on click', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, tenants: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderWithRouter(<Tenants />);
    await waitFor(() => screen.getByText('+ 새 테넌트'));
    fireEvent.click(screen.getByText('+ 새 테넌트'));
    const form = await screen.findByTestId('tenant-form');
    const apiKeyInput = form.querySelectorAll('input')[3] as HTMLInputElement;
    const before = apiKeyInput.value;
    fireEvent.click(screen.getByText('생성'));
    expect(apiKeyInput.value).not.toBe(before);
    expect(apiKeyInput.value).toMatch(/^tk_live_/);
  });

  it('POSTs to /admin/api/tenants on save', async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, tenants: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, tenants: TENANTS }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;
    const user = userEvent.setup();

    renderWithRouter(<Tenants />);
    await waitFor(() => screen.getByText('+ 새 테넌트'));
    await user.click(screen.getByText('+ 새 테넌트'));

    const form = await screen.findByTestId('tenant-form');
    const inputs = form.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
    await user.type(inputs[0]!, 'newco');
    await user.type(inputs[1]!, 'New Co');
    await user.type(inputs[2]!, 'https://newco.io');
    // apiKey input (3) 은 자동 생성된 값을 그대로 사용.

    fireEvent.submit(form);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const postCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
    expect(body.id).toBe('newco');
    expect(body.plan).toBe('free');
    expect(body.apiKey).toMatch(/^tk_live_/);
  });
});
