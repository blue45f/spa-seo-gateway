import {
  type AiSchemaAdapter,
  type BillingAdapter,
  getAiSchemaAdapter,
  getBillingAdapter,
  getSearchConsoleAdapter,
  type SearchConsoleAdapter,
  setAiSchemaAdapter,
  setBillingAdapter,
  setSearchConsoleAdapter,
} from '@heejun/spa-seo-gateway-core';
import { afterEach, describe, expect, it } from 'vitest';

describe('BYO adapters', () => {
  afterEach(() => {
    // 테스트 간 간섭 방지 — null 로 명시 reset (싱글톤이므로).
    setAiSchemaAdapter(null as unknown as AiSchemaAdapter);
    setBillingAdapter(null as unknown as BillingAdapter);
    setSearchConsoleAdapter(null as unknown as SearchConsoleAdapter);
  });

  it('AI schema adapter set/get round-trips', async () => {
    expect(getAiSchemaAdapter()).toBeNull();
    const fake: AiSchemaAdapter = {
      async suggestSchema(_html, url) {
        return [
          {
            type: 'Article',
            jsonLd: { '@type': 'Article', url },
            confidence: 0.9,
          },
        ];
      },
    };
    setAiSchemaAdapter(fake);
    const got = getAiSchemaAdapter();
    expect(got).toBe(fake);
    const out = await got!.suggestSchema('<html></html>', 'https://example.com');
    expect(out[0]?.confidence).toBe(0.9);
    expect((out[0]?.jsonLd as { url: string }).url).toBe('https://example.com');
  });

  it('Billing adapter records usage events', async () => {
    const recorded: unknown[] = [];
    const fake: BillingAdapter = {
      async reportUsage(events) {
        recorded.push(...events);
      },
      async getLimits(plan) {
        return plan === 'pro' ? { renders: 10_000 } : { renders: 100 };
      },
    };
    setBillingAdapter(fake);

    await getBillingAdapter()!.reportUsage([
      { tenantId: 't1', metric: 'render', count: 3, ts: '2026-04-27T00:00:00Z' },
    ]);
    expect(recorded).toHaveLength(1);

    const limits = await getBillingAdapter()!.getLimits('pro');
    expect(limits.renders).toBe(10_000);
  });

  it('Search Console adapter resolves index status', async () => {
    const fake: SearchConsoleAdapter = {
      async getIndexStatus(urls) {
        return urls.map((u) => ({ url: u, indexed: u.endsWith('/ok') }));
      },
    };
    setSearchConsoleAdapter(fake);

    const status = await getSearchConsoleAdapter()!.getIndexStatus([
      'https://x/ok',
      'https://x/missing',
    ]);
    expect(status[0]?.indexed).toBe(true);
    expect(status[1]?.indexed).toBe(false);
  });
});
