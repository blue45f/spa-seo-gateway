import {
  type AnthropicLikeClient,
  createAnthropicSchemaAdapter,
  extractJson,
  isValidSuggestion,
  stripHtml,
} from '@heejun/spa-seo-gateway-anthropic';
import { afterEach, describe, expect, it, vi } from 'vitest';

function fakeClient(text: string) {
  const create = vi.fn().mockResolvedValue({ content: [{ type: 'text', text }] });
  return {
    create,
    client: { messages: { create } } as AnthropicLikeClient,
  };
}

describe('stripHtml', () => {
  it('removes script/style/svg/noscript/comment blocks', () => {
    const html = `<html><head><script>x=1</script><style>p{color:red}</style></head>
      <body>visible<svg><circle/></svg><!-- hidden --><noscript>fallback</noscript></body></html>`;
    const out = stripHtml(html, 10_000);
    expect(out).toContain('visible');
    expect(out).not.toContain('x=1');
    expect(out).not.toContain('color:red');
    expect(out).not.toContain('<circle/>');
    expect(out).not.toContain('<!-- hidden -->');
    expect(out).not.toContain('fallback');
  });

  it('caps at maxChars', () => {
    expect(stripHtml('a'.repeat(100), 20)).toHaveLength(20);
  });
});

describe('extractJson', () => {
  it('parses pure JSON array', () => {
    expect(extractJson('[{"a":1}]')).toEqual([{ a: 1 }]);
  });

  it('extracts JSON when wrapped in surrounding text', () => {
    expect(extractJson('Here it is: [{"a":2}] end.')).toEqual([{ a: 2 }]);
  });

  it('throws on non-JSON', () => {
    expect(() => extractJson('정말 JSON 아님')).toThrow();
  });
});

describe('isValidSuggestion', () => {
  it('accepts well-formed suggestion', () => {
    expect(
      isValidSuggestion({
        type: 'Article',
        jsonLd: { '@type': 'Article' },
        confidence: 0.9,
      }),
    ).toBe(true);
  });

  it('rejects when jsonLd missing', () => {
    expect(isValidSuggestion({ type: 'Article', confidence: 0.9 })).toBe(false);
  });

  it('rejects when confidence is non-number', () => {
    expect(
      isValidSuggestion({
        type: 'Article',
        jsonLd: {},
        confidence: 'high',
      }),
    ).toBe(false);
  });

  it('rejects null / non-object', () => {
    expect(isValidSuggestion(null)).toBe(false);
    expect(isValidSuggestion(undefined)).toBe(false);
    expect(isValidSuggestion('string')).toBe(false);
  });
});

describe('createAnthropicSchemaAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when no apiKey provided and env missing (and no client)', () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => createAnthropicSchemaAdapter()).toThrow(/apiKey not provided/);
    if (original) process.env.ANTHROPIC_API_KEY = original;
  });

  it('uses injected client (no apiKey needed)', async () => {
    const { client, create } = fakeClient(
      JSON.stringify([
        {
          type: 'Article',
          jsonLd: { '@context': 'https://schema.org', '@type': 'Article', name: 'X' },
          confidence: 0.92,
          rationale: 'clear article',
        },
      ]),
    );
    const adapter = createAnthropicSchemaAdapter({ client });
    const out = await adapter.suggestSchema('<html><body>blog</body></html>', 'https://x/y');
    expect(out).toHaveLength(1);
    expect(out[0]?.type).toBe('Article');
    expect(create).toHaveBeenCalledOnce();
  });

  it('extracts JSON when response wrapped with extra text', async () => {
    const { client } = fakeClient(
      'Result:\n[{"type":"Product","jsonLd":{"@type":"Product"},"confidence":0.8}]\n끝.',
    );
    const adapter = createAnthropicSchemaAdapter({ client });
    const out = await adapter.suggestSchema('<html></html>', 'https://x/p');
    expect(out[0]?.type).toBe('Product');
  });

  it('returns empty array on unparseable response', async () => {
    const { client } = fakeClient('파싱 안 됨');
    const adapter = createAnthropicSchemaAdapter({ client });
    expect(await adapter.suggestSchema('<html></html>', 'https://x/p')).toEqual([]);
  });

  it('filters invalid suggestion shapes', async () => {
    const { client } = fakeClient(
      JSON.stringify([
        { type: 'Article', confidence: 0.9 }, // jsonLd 누락
        null,
        { type: 'Product', jsonLd: {}, confidence: 0.7 },
      ]),
    );
    const adapter = createAnthropicSchemaAdapter({ client });
    const out = await adapter.suggestSchema('<html></html>', 'https://x/p');
    expect(out).toHaveLength(1);
    expect(out[0]?.type).toBe('Product');
  });

  it('caps results at maxSuggestions', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      type: 'Article',
      jsonLd: { idx: i },
      confidence: 0.8,
    }));
    const { client } = fakeClient(JSON.stringify(many));
    const adapter = createAnthropicSchemaAdapter({ client, maxSuggestions: 3 });
    expect(await adapter.suggestSchema('<html></html>', 'https://x/p')).toHaveLength(3);
  });

  it('passes user model option through', async () => {
    const { client, create } = fakeClient('[]');
    const adapter = createAnthropicSchemaAdapter({
      client,
      model: 'claude-haiku-4-5-20251001',
    });
    await adapter.suggestSchema('<html></html>', 'https://x/p');
    expect(create.mock.calls[0]?.[0]?.model).toBe('claude-haiku-4-5-20251001');
  });

  it('strips script/svg/style from HTML before sending', async () => {
    const { client, create } = fakeClient('[]');
    const adapter = createAnthropicSchemaAdapter({ client });
    const html = `<html><head><script>secret_key='abc'</script></head>
      <body>visible<svg><circle/></svg></body></html>`;
    await adapter.suggestSchema(html, 'https://x/p');

    const sent = create.mock.calls[0]?.[0]?.messages?.[0]?.content as string;
    expect(sent).toContain('visible');
    expect(sent).not.toContain('secret_key');
    expect(sent).not.toContain('<circle/>');
  });
});
