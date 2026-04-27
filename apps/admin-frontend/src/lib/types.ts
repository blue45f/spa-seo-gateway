/** Admin UI client-facing types — core 의 Zod 스키마와 별개로 frontend 가 직접 다루는 모양만 정의. */

export type RouteOverride = {
  pattern: string;
  ttlMs?: number | null;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2' | '';
  waitSelector?: string;
  waitMs?: number | null;
  ignore?: boolean;
  blockResourceTypes?: string[];
  viewport?: { width: number; height: number };
  schemaTemplate?: 'Article' | 'Product' | 'FAQ' | 'HowTo' | 'WebSite';
  variants?: AbVariant[];
};

export type AbVariant = {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  weight?: number;
};

export type SiteSummary = {
  routes: number;
  origin?: string | null;
};

export type CacheStats = {
  ttlMs: number;
  swrMs?: number;
  redisEnabled: boolean;
  size?: number;
};

export type PublicInfo = {
  ok: boolean;
  mode: 'render-only' | 'proxy' | 'cms' | 'saas';
  origin: string | null;
  multiContext: boolean;
  cache: CacheStats;
  site: SiteSummary;
  nodeVersion: string;
  uptimeSec: number;
  timestamp: string;
};

export type SiteInfo = {
  ok: boolean;
  site: SiteSummary;
  mode: PublicInfo['mode'];
  origin?: string;
  breakers: Record<string, { state: string; failures: number }>;
  cache: CacheStats;
  multiContext: boolean;
};

export type AuditEvent = {
  ts: string;
  actor: string;
  action: string;
  target?: string;
  outcome: 'ok' | 'error';
  meta?: Record<string, unknown>;
  hash?: string;
  prevHash?: string;
  signature?: string;
};

export type WarmReport = {
  sitemap: string;
  found: number;
  warmed: number;
  skipped: number;
  errors: number;
  durationMs: number;
};

export type RenderTestResult = {
  ok: true;
  status: number;
  durationMs: number;
  bytes: number;
  headers: Record<string, string>;
  bodyPreview: string;
};

export type LighthouseScores = {
  performance: number;
  accessibility: number;
  seo: number;
  bestPractices: number;
};

export type LighthouseResult = {
  ok: true;
  url: string;
  scores: LighthouseScores;
  cached: boolean;
  durationMs: number;
};

export type VisualDiffResult = {
  url: string;
  baselinePath: string;
  diffPath: string | null;
  width: number;
  height: number;
  diffPixels: number;
  diffPercent: number;
  baselineCreated: boolean;
  durationMs: number;
};

export type SchemaSuggestion = {
  type: 'Article' | 'Product' | 'FAQPage' | 'HowTo' | 'WebSite' | 'Other';
  jsonLd: Record<string, unknown>;
  confidence: number;
  rationale?: string;
};

export type ToastKind = 'success' | 'error' | 'warn' | 'info';
export type ToastItem = {
  id: number;
  message: string;
  kind: ToastKind;
  icon: string;
};

export type Lang = 'ko' | 'en';
export type Theme = 'light' | 'dark';
