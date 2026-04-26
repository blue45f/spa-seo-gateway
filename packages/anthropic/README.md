# @heejun/spa-seo-gateway-anthropic

Anthropic Claude reference adapter for [`spa-seo-gateway`](https://github.com/blue45f/spa-seo-gateway) — HTML 본문에서 schema.org JSON-LD 를 자동 추론.

## Install

```sh
npm install @heejun/spa-seo-gateway-core @heejun/spa-seo-gateway-anthropic @anthropic-ai/sdk
```

## Use

```ts
import { setAiSchemaAdapter, getAiSchemaAdapter } from '@heejun/spa-seo-gateway-core';
import { createAnthropicSchemaAdapter } from '@heejun/spa-seo-gateway-anthropic';

setAiSchemaAdapter(
  createAnthropicSchemaAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-opus-4-7', // optional
  }),
);

// 이후 admin UI 의 POST /admin/api/ai/schema 또는 직접 호출:
const adapter = getAiSchemaAdapter();
const suggestions = await adapter!.suggestSchema(html, url);
```

## Options

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `apiKey` | `process.env.ANTHROPIC_API_KEY` | Anthropic API 키 |
| `model` | `process.env.ANTHROPIC_MODEL` 또는 `claude-opus-4-7` | 모델 ID |
| `maxHtmlChars` | `12000` | LLM 입력으로 보낼 최대 HTML 글자수 |
| `maxSuggestions` | `5` | 한 번에 반환할 최대 schema 갯수 |

## Output

각 suggestion 은 다음 형식:

```ts
{
  type: 'Article' | 'Product' | 'FAQPage' | 'HowTo' | 'WebSite' | 'Other';
  jsonLd: { '@context': 'https://schema.org', '@type': '...', ... };
  confidence: number; // 0..1
  rationale?: string;
}
```

## License

MIT
