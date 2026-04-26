import {
  createOpenAiSchemaAdapter,
  extractJson,
  isValidSuggestion,
  stripHtml,
} from '@heejun/spa-seo-gateway-openai';
import { afterEach, describe, expect, it, vi } from 'vitest';

function fakeFetch(text: string, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    async json() {
      return { choices: [{ message: { content: text } }] };
    },
  } as Response);
}

describe('openai stripHtml', () => {
  it('removes script/style/svg/noscript/comment blocks', () => {
    const html = `<html><head><script>x=1</script><style>p{color:red}</style></head>
      <body>visible<svg><circle/></svg><!-- hidden --><noscript>fb</noscript></body></html>`;
    const out = stripHtml(html, 10_000);
    expect(out).toContain('visible');
    expect(out).not.toContain('x=1');
    expect(out).not.toContain('color:red');
    expect(out).not.toContain('<circle/>');
  });

  it('caps at maxChars', () => {
    expect(stripHtml('a'.repeat(100), 25)).toHaveLength(25);
  });
});

describe('openai extractJson + isValidSuggestion', () => {
  it('parses pure JSON array', () => {
    expect(extractJson('[{"a":1}]')).toEqual([{ a: 1 }]);
  });

  it('extracts JSON when wrapped in surrounding text', () => {
    expect(extractJson('Result:\n[{"a":2}]\nfin.')).toEqual([{ a: 2 }]);
  });

  it('throws on non-JSON', () => {
    expect(() => extractJson('garbage')).toThrow();
  });

  it('isValidSuggestion accepts well-formed', () => {
    expect(isValidSuggestion({ type: 'Article', jsonLd: {}, confidence: 0.9 })).toBe(true);
  });

  it('isValidSuggestion rejects when jsonLd missing', () => {
    expect(isValidSuggestion({ type: 'Article', confidence: 0.9 })).toBe(false);
  });

  it('isValidSuggestion rejects null', () => {
    expect(isValidSuggestion(null)).toBe(false);
  });
});

describe('createOpenAiSchemaAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when no apiKey for remote endpoint', () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(() => createOpenAiSchemaAdapter()).toThrow(/apiKey not provided/);
    if (original) process.env.OPENAI_API_KEY = original;
  });

  it('allows missing apiKey for local endpoints (Ollama-style)', () => {
    expect(() => createOpenAiSchemaAdapter({ baseUrl: 'http://localhost:11434/v1' })).not.toThrow();
  });

  it('returns parsed suggestions from a fake fetch', async () => {
    const f = fakeFetch(
      JSON.stringify([
        {
          type: 'Article',
          jsonLd: { '@context': 'https://schema.org', '@type': 'Article' },
          confidence: 0.9,
        },
      ]),
    );
    const adapter = createOpenAiSchemaAdapter({ apiKey: 'sk-test', fetch: f });
    const out = await adapter.suggestSchema('<html><body>x</body></html>', 'https://x/y');
    expect(out).toHaveLength(1);
    expect(out[0]?.type).toBe('Article');
  });

  it('sends bearer token in authorization header when apiKey provided', async () => {
    const f = fakeFetch('[]');
    const adapter = createOpenAiSchemaAdapter({ apiKey: 'sk-secret', fetch: f });
    await adapter.suggestSchema('<html></html>', 'https://x/y');
    const headers = f.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk-secret');
  });

  it('omits authorization header when apiKey absent (local endpoint)', async () => {
    const f = fakeFetch('[]');
    const adapter = createOpenAiSchemaAdapter({
      baseUrl: 'http://localhost:11434/v1',
      fetch: f,
    });
    await adapter.suggestSchema('<html></html>', 'https://x/y');
    const headers = f.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it('targets the correct chat/completions endpoint', async () => {
    const f = fakeFetch('[]');
    const adapter = createOpenAiSchemaAdapter({
      apiKey: 'sk',
      baseUrl: 'https://api.groq.com/openai/v1',
      fetch: f,
    });
    await adapter.suggestSchema('<html></html>', 'https://x/y');
    expect(f.mock.calls[0]?.[0]).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  it('strips trailing slash from baseUrl', async () => {
    const f = fakeFetch('[]');
    const adapter = createOpenAiSchemaAdapter({
      apiKey: 'sk',
      baseUrl: 'https://api.openai.com/v1/',
      fetch: f,
    });
    await adapter.suggestSchema('<html></html>', 'https://x/y');
    expect(f.mock.calls[0]?.[0]).toBe('https://api.openai.com/v1/chat/completions');
  });

  it('passes model into request body', async () => {
    const f = fakeFetch('[]');
    const adapter = createOpenAiSchemaAdapter({
      apiKey: 'sk',
      model: 'llama-3.3-70b-versatile',
      fetch: f,
    });
    await adapter.suggestSchema('<html></html>', 'https://x/y');
    const body = JSON.parse(f.mock.calls[0]?.[1]?.body as string);
    expect(body.model).toBe('llama-3.3-70b-versatile');
  });

  it('includes system + user messages', async () => {
    const f = fakeFetch('[]');
    const adapter = createOpenAiSchemaAdapter({ apiKey: 'sk', fetch: f });
    await adapter.suggestSchema('<html><body>visible</body></html>', 'https://x/y');
    const body = JSON.parse(f.mock.calls[0]?.[1]?.body as string);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toContain('visible');
  });

  it('returns empty on unparseable response', async () => {
    const f = fakeFetch('garbage');
    const adapter = createOpenAiSchemaAdapter({ apiKey: 'sk', fetch: f });
    expect(await adapter.suggestSchema('<html></html>', 'https://x/y')).toEqual([]);
  });

  it('throws on non-OK HTTP response', async () => {
    const f = fakeFetch('error', 500);
    const adapter = createOpenAiSchemaAdapter({ apiKey: 'sk', fetch: f });
    await expect(adapter.suggestSchema('<html></html>', 'https://x/y')).rejects.toThrow(/500/);
  });

  it('caps results at maxSuggestions', async () => {
    const many = Array.from({ length: 10 }, () => ({
      type: 'Article',
      jsonLd: {},
      confidence: 0.8,
    }));
    const f = fakeFetch(JSON.stringify(many));
    const adapter = createOpenAiSchemaAdapter({ apiKey: 'sk', maxSuggestions: 4, fetch: f });
    expect(await adapter.suggestSchema('<html></html>', 'https://x/y')).toHaveLength(4);
  });
});
