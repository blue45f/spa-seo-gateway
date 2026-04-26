/**
 * 외부 시스템 통합 어댑터 인터페이스 — 실제 SDK 는 사용자가 가져와 구현.
 * core 는 어댑터의 공통 모양만 정의해 게이트웨이가 한 곳에서 호출할 수 있게 한다.
 *
 * BYO (Bring Your Own) 패턴:
 *   - AI schema 생성: 사용자가 OpenAI/Anthropic 클라이언트 주입
 *   - Stripe 빌링: 사용자가 Stripe SDK 와 가격 모델 주입
 *   - Search Console: 사용자가 Google API 인증 토큰 주입
 *
 * 게이트웨이는 어댑터를 쓰는 hook 만 제공 — 외부 패키지가 늘어나지 않는다.
 */

// ──────────────────────────────────────────────────────────────────
// AI Schema generation
// ──────────────────────────────────────────────────────────────────
export type SchemaSuggestion = {
  type: 'Article' | 'Product' | 'FAQPage' | 'HowTo' | 'WebSite' | 'Other';
  jsonLd: Record<string, unknown>;
  confidence: number; // 0..1
  rationale?: string;
};

export interface AiSchemaAdapter {
  /** HTML 본문에서 schema.org 마크업을 추론. 미구현 시 빈 배열. */
  suggestSchema(html: string, url: string): Promise<SchemaSuggestion[]>;
}

let aiAdapter: AiSchemaAdapter | null = null;

/**
 * AI schema 어댑터 등록. 시작 시 한 번 호출해 OpenAI/Anthropic/Custom 어댑터를 주입.
 * `null` 전달 시 어댑터 초기화 (테스트/언마운트용).
 */
export function setAiSchemaAdapter(adapter: AiSchemaAdapter | null): void {
  aiAdapter = adapter;
}

/** 등록된 AI 어댑터 반환. 미등록 시 `null`. */
export function getAiSchemaAdapter(): AiSchemaAdapter | null {
  return aiAdapter;
}

// ──────────────────────────────────────────────────────────────────
// Stripe billing
// ──────────────────────────────────────────────────────────────────
export type UsageEvent = {
  tenantId: string;
  metric: 'render' | 'cache_hit' | 'warm';
  count: number;
  ts: string;
};

export interface BillingAdapter {
  /** 테넌트 사용량 보고 — 빌링 시스템에 청구 정보 전달. */
  reportUsage(events: UsageEvent[]): Promise<void>;
  /** 현재 plan 의 사용량 한도 (문서/대시보드 표시용). */
  getLimits(plan: string): Promise<Record<string, number>>;
}

let billingAdapter: BillingAdapter | null = null;

/** 빌링 어댑터 등록. 시작 시 한 번. `null` 로 초기화 가능. */
export function setBillingAdapter(adapter: BillingAdapter | null): void {
  billingAdapter = adapter;
}

/** 등록된 빌링 어댑터 반환. 미등록 시 `null`. */
export function getBillingAdapter(): BillingAdapter | null {
  return billingAdapter;
}

// ──────────────────────────────────────────────────────────────────
// Search Console / Index status
// ──────────────────────────────────────────────────────────────────
export type IndexStatus = {
  url: string;
  indexed: boolean;
  lastCrawled?: string;
  errors?: string[];
};

export interface SearchConsoleAdapter {
  /** Google Search Console / Bing Webmaster 등 인덱스 상태 조회. */
  getIndexStatus(urls: string[]): Promise<IndexStatus[]>;
}

let searchConsoleAdapter: SearchConsoleAdapter | null = null;

/** Search Console 어댑터 등록. 시작 시 한 번. `null` 로 초기화 가능. */
export function setSearchConsoleAdapter(adapter: SearchConsoleAdapter | null): void {
  searchConsoleAdapter = adapter;
}

/** 등록된 Search Console 어댑터 반환. 미등록 시 `null`. */
export function getSearchConsoleAdapter(): SearchConsoleAdapter | null {
  return searchConsoleAdapter;
}
