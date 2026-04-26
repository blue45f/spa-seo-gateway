# @heejun/spa-seo-gateway-openai

OpenAI-compatible reference adapter for [`spa-seo-gateway`](https://github.com/blue45f/spa-seo-gateway) — `chat/completions` 엔드포인트를 가진 모든 호환 API 와 동작.

동일 코드로 다음 모두 사용 가능:

| 서비스 | baseUrl | apiKey 필요 |
|---|---|---|
| **OpenAI 공식** | (기본 — `https://api.openai.com/v1`) | ✓ |
| **Groq** | `https://api.groq.com/openai/v1` | ✓ |
| **OpenRouter** | `https://openrouter.ai/api/v1` | ✓ |
| **Together AI** | `https://api.together.xyz/v1` | ✓ |
| **Ollama (로컬)** | `http://localhost:11434/v1` | ✗ |
| **LM Studio (로컬)** | `http://localhost:1234/v1` | ✗ |

SDK 의존 없음 — `fetch` 만 사용.

## Install

```sh
npm install @heejun/spa-seo-gateway-core @heejun/spa-seo-gateway-openai
```

## Use

```ts
import { setAiSchemaAdapter } from '@heejun/spa-seo-gateway-core';
import { createOpenAiSchemaAdapter } from '@heejun/spa-seo-gateway-openai';

// OpenAI 공식
setAiSchemaAdapter(
  createOpenAiSchemaAdapter({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  }),
);

// Groq (무료 티어, 빠름)
setAiSchemaAdapter(
  createOpenAiSchemaAdapter({
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  }),
);

// Ollama (로컬, 완전 무료)
setAiSchemaAdapter(
  createOpenAiSchemaAdapter({
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
  }),
);
```

## Options

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `apiKey` | `process.env.OPENAI_API_KEY` | API 키. 로컬 엔드포인트는 불필요 |
| `baseUrl` | `process.env.OPENAI_BASE_URL` 또는 `https://api.openai.com/v1` | 호환 엔드포인트 base URL |
| `model` | `process.env.OPENAI_MODEL` 또는 `gpt-4o-mini` | 모델 ID |
| `maxHtmlChars` | `12000` | LLM 입력으로 보낼 최대 HTML 글자수 |
| `maxSuggestions` | `5` | 한 번에 반환할 최대 schema 갯수 |
| `timeoutMs` | `60000` | 요청 타임아웃 |
| `fetch` | `globalThis.fetch` | 테스트용 fetch 주입 |

## License

MIT
