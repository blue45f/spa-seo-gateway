/**
 * Anthropic Claude reference adapter for spa-seo-gateway.
 *
 * AiSchemaAdapter 구현 — HTML 본문에서 schema.org JSON-LD 를 추론.
 * core 의 BYO 패턴에 따라 사용자가 명시적으로 import 후 setAiSchemaAdapter() 로 주입.
 *
 *   import { setAiSchemaAdapter } from '@heejun/spa-seo-gateway-core';
 *   import { createAnthropicSchemaAdapter } from '@heejun/spa-seo-gateway-anthropic';
 *
 *   setAiSchemaAdapter(createAnthropicSchemaAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }));
 *
 * 환경변수: ANTHROPIC_API_KEY (필수), ANTHROPIC_MODEL (선택, 기본 claude-opus-4-7)
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AiSchemaAdapter, SchemaSuggestion } from '@heejun/spa-seo-gateway-core';

/** Anthropic SDK `messages.create` 의 최소 인터페이스 — 테스트용 fake client 주입 가능. */
export interface AnthropicLikeClient {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: 'user'; content: string }[];
    }): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

export type AnthropicSchemaAdapterOptions = {
  apiKey?: string;
  model?: string;
  /** 페이지 본문을 LLM 입력으로 보낼 때 잘라낼 최대 글자수 (기본 12000) */
  maxHtmlChars?: number;
  /** 한 번에 추론할 최대 schema 갯수 (기본 5) */
  maxSuggestions?: number;
  /** 직접 SDK 인스턴스 주입 (테스트/커스텀 retry 정책용). 주입 시 apiKey 무시. */
  client?: AnthropicLikeClient;
};

const DEFAULT_MODEL = 'claude-opus-4-7';

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

export function createAnthropicSchemaAdapter(
  opts: AnthropicSchemaAdapterOptions = {},
): AiSchemaAdapter {
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const maxHtmlChars = opts.maxHtmlChars ?? 12_000;
  const maxSuggestions = opts.maxSuggestions ?? 5;

  let client: AnthropicLikeClient;
  if (opts.client) {
    client = opts.client;
  } else {
    const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'AnthropicSchemaAdapter: apiKey not provided (set ANTHROPIC_API_KEY or pass apiKey option)',
      );
    }
    client = new Anthropic({ apiKey }) as unknown as AnthropicLikeClient;
  }

  return {
    async suggestSchema(html, url) {
      const body = stripHtml(html, maxHtmlChars);
      const userMessage = `URL: ${url}\n\n[HTML 본문 발췌]\n${body}`;

      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const text = response.content[0]?.type === 'text' ? (response.content[0].text ?? '') : '';
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
