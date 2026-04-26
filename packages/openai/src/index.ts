/**
 * OpenAI-compatible reference adapter for spa-seo-gateway.
 *
 * `AiSchemaAdapter` 구현 — `chat/completions` 엔드포인트를 가진 모든 호환 API 와 동작.
 * 동일 코드로 다음 모두 사용 가능:
 *   - OpenAI 공식: `baseUrl: 'https://api.openai.com/v1'` (또는 미지정 시 기본값)
 *   - Groq: `baseUrl: 'https://api.groq.com/openai/v1'`
 *   - OpenRouter: `baseUrl: 'https://openrouter.ai/api/v1'`
 *   - Ollama (로컬): `baseUrl: 'http://localhost:11434/v1'` (apiKey 불필요)
 *   - LM Studio (로컬): `baseUrl: 'http://localhost:1234/v1'` (apiKey 불필요)
 *
 * BYO 패턴 — 시작 시 `setAiSchemaAdapter()` 로 직접 주입.
 *
 *   import { setAiSchemaAdapter } from '@heejun/spa-seo-gateway-core';
 *   import { createOpenAiSchemaAdapter } from '@heejun/spa-seo-gateway-openai';
 *
 *   setAiSchemaAdapter(createOpenAiSchemaAdapter({
 *     apiKey: process.env.OPENAI_API_KEY,
 *     model: 'gpt-4o-mini',
 *   }));
 *
 * 환경변수: OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL.
 *
 * SDK 의존 없음 — `fetch` 만 사용. Node 18+ 또는 모던 브라우저 환경.
 */
import type { AiSchemaAdapter, SchemaSuggestion } from '@heejun/spa-seo-gateway-core';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 60_000;

export type OpenAiSchemaAdapterOptions = {
  apiKey?: string;
  /** API base URL (예: `http://localhost:11434/v1` for Ollama). 미지정 시 OpenAI 공식. */
  baseUrl?: string;
  model?: string;
  /** 페이지 본문을 LLM 입력으로 보낼 때 잘라낼 최대 글자수 (기본 12000) */
  maxHtmlChars?: number;
  /** 한 번에 추론할 최대 schema 갯수 (기본 5) */
  maxSuggestions?: number;
  /** 요청 타임아웃 ms (기본 60000) */
  timeoutMs?: number;
  /** 테스트용 fetch 주입 — 미지정 시 글로벌 fetch */
  fetch?: typeof fetch;
};

export const SYSTEM_PROMPT = `당신은 SEO/검색엔진 최적화 전문가이자 schema.org 마크업 생성 전문가입니다.
주어진 HTML 페이지의 본문을 분석해 가장 적합한 schema.org JSON-LD 마크업을 추론합니다.

규칙:
1. 페이지 콘텐츠가 명백히 어떤 타입인지 알 수 있을 때만 제안하세요. 추측이면 confidence 를 낮추세요.
2. 지원 타입: Article, Product, FAQPage, HowTo, WebSite, Other
3. 반드시 JSON 배열로만 응답. 마크다운/주석/설명 금지.
4. 필드는 schema.org 표준 (@context, @type, name, headline, description, image, url, ...)
5. 없는 필드는 빈 문자열이 아니라 아예 누락. 추측 금지.

응답 형식 (JSON 배열):
[
  {
    "type": "Article" | "Product" | "FAQPage" | "HowTo" | "WebSite" | "Other",
    "jsonLd": { "@context": "https://schema.org", "@type": "...", ... },
    "confidence": 0.0~1.0,
    "rationale": "한 문장 추론 근거"
  }
]

confidence 기준:
- 0.9 이상: 명확한 제목/메타/구조로 타입 단정 가능
- 0.7~0.9: 본문 콘텐츠로 타입 강하게 시사
- 0.5~0.7: 부분 시사, 보강 필요
- 0.5 미만: 추측 — 응답에 포함하지 마세요`;

/** script/style/svg/noscript/comment 제거 후 max chars 로 자른다. LLM 입력 비용 절감. */
export function stripHtml(html: string, maxChars: number): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  return cleaned.slice(0, maxChars);
}

/** LLM 응답에서 JSON 배열 부분만 추출. 실패 시 throw. */
export function extractJson(text: string): unknown {
  const match = text.match(/\[[\s\S]*\]/);
  const slice = match ? match[0] : text;
  return JSON.parse(slice);
}

/** SchemaSuggestion shape 검증 — 필수 필드 누락/잘못된 타입은 false. */
export function isValidSuggestion(x: unknown): x is SchemaSuggestion {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.type === 'string' &&
    typeof o.confidence === 'number' &&
    o.jsonLd !== null &&
    typeof o.jsonLd === 'object'
  );
}

export function createOpenAiSchemaAdapter(opts: OpenAiSchemaAdapterOptions = {}): AiSchemaAdapter {
  const baseUrl = opts.baseUrl ?? process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL;
  const model = opts.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  const maxHtmlChars = opts.maxHtmlChars ?? 12_000;
  const maxSuggestions = opts.maxSuggestions ?? 5;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = opts.fetch ?? globalThis.fetch;

  const isLocal =
    baseUrl.startsWith('http://localhost') ||
    baseUrl.startsWith('http://127.') ||
    baseUrl.includes('ollama') ||
    baseUrl.includes('lmstudio');

  // 로컬 엔드포인트는 보통 apiKey 불필요. 원격이면 필수.
  if (!apiKey && !isLocal) {
    throw new Error(
      `OpenAiSchemaAdapter: apiKey not provided for remote endpoint ${baseUrl} (set OPENAI_API_KEY or pass apiKey option). 로컬 OpenAI-compatible 엔드포인트는 apiKey 불필요.`,
    );
  }

  return {
    async suggestSchema(html, url) {
      const body = stripHtml(html, maxHtmlChars);
      const userMessage = `URL: ${url}\n\n[HTML 본문 발췌]\n${body}`;

      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (apiKey) headers.authorization = `Bearer ${apiKey}`;

      const response = await fetchFn(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 2048,
          stream: false,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`OpenAI-compatible API failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content ?? '';
      if (!text) return [];

      let parsed: unknown;
      try {
        parsed = extractJson(text);
      } catch {
        return [];
      }

      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidSuggestion).slice(0, maxSuggestions);
    },
  };
}
