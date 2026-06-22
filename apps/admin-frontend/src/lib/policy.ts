/**
 * TermsDesk 공개 정책 클라이언트 — 이용약관/개인정보처리방침 정본 조회.
 *
 * 정본은 TermsDesk(중앙 정책 게시 서비스)가 무인증 공개 API 로 제공한다.
 * 게이트웨이 자체 API 가 아닌 외부 절대 URL 이고, `api()` 가 항상 싣는
 * `content-type: application/json` 은 GET 에 불필요한 CORS preflight 를
 * 유발하므로 표준 fetch 를 직접 사용한다 (Accept 는 safelisted 헤더).
 */

import { ApiError } from './api'

import type { Lang } from './types'

export const POLICY_SLUGS = ['terms-of-service', 'privacy-policy'] as const
export type PolicySlug = (typeof POLICY_SLUGS)[number]

export const TERMSDESK_BASE_URL = 'https://desk-platform.vercel.app/termsdesk'
export const POLICY_ORG_SLUG = 'spa-seo-gateway'

export function policyApiUrl(slug: PolicySlug): string {
  return `${TERMSDESK_BASE_URL}/api/public/${POLICY_ORG_SLUG}/policies/${slug}`
}

/** 장애/검증 실패 시 폴백으로 안내하는 TermsDesk 원문(렌더된 공개 페이지) URL. */
export function policyPublicUrl(slug: PolicySlug): string {
  return `${TERMSDESK_BASE_URL}/p/${POLICY_ORG_SLUG}/${slug}`
}

/**
 * TermsDesk 공개 정책 API 응답에서 UI 가 소비하는 부분집합.
 * 핵심 필드(슬러그·이름·본문·버전·해시)는 필수, 나머지 메타는 게시 상태에
 * 따라 비어 있을 수 있어 관대하게 받는다. (zod 미사용 — 수기 가드)
 */
export type PolicyDocument = {
  policySlug: string
  name: string
  type: string
  locale: string
  versionLabel: string
  contentHash: string
  body: string
  effectiveAt?: string | null
  publishedAt?: string | null
  changeSummary?: string | null
}

const REQUIRED_STRING_FIELDS = [
  'policySlug',
  'name',
  'type',
  'locale',
  'versionLabel',
  'contentHash',
  'body',
] as const

const OPTIONAL_STRING_FIELDS = ['effectiveAt', 'publishedAt', 'changeSummary'] as const

/**
 * 응답 스키마 가드. 외부 서비스 페이로드를 신뢰하지 않고 모양을 검증한 뒤
 * 알려진 필드만 추려 반환한다. 모양이 어긋나면 null (호출부가 에러로 표면화).
 */
export function parsePolicyDocument(raw: unknown): PolicyDocument | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, unknown>

  for (const field of REQUIRED_STRING_FIELDS) {
    const value = rec[field]
    if (typeof value !== 'string' || value === '') return null
  }
  for (const field of OPTIONAL_STRING_FIELDS) {
    const value = rec[field]
    if (value !== undefined && value !== null && typeof value !== 'string') return null
  }

  return {
    policySlug: rec.policySlug as string,
    name: rec.name as string,
    type: rec.type as string,
    locale: rec.locale as string,
    versionLabel: rec.versionLabel as string,
    contentHash: rec.contentHash as string,
    body: rec.body as string,
    effectiveAt: (rec.effectiveAt ?? null) as string | null,
    publishedAt: (rec.publishedAt ?? null) as string | null,
    changeSummary: (rec.changeSummary ?? null) as string | null,
  }
}

/** lib/api.ts 의 fetchText 와 동일한 타임아웃 규약 (멎은 외부 서비스가 UI 를 매달지 않게). */
const POLICY_TIMEOUT_MS = 15_000

export async function fetchPolicyDocument(
  slug: PolicySlug,
  signal?: AbortSignal
): Promise<PolicyDocument> {
  const ctrl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ctrl.abort()
  }, POLICY_TIMEOUT_MS)
  signal?.addEventListener('abort', () => ctrl.abort())
  try {
    const res = await fetch(policyApiUrl(slug), {
      headers: { accept: 'application/json' },
      signal: ctrl.signal,
    })
    if (!res.ok) throw new ApiError(`${res.status} ${res.statusText}`, res.status)
    const doc = parsePolicyDocument(await res.json())
    if (!doc) throw new Error('policy payload failed validation')
    return doc
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError' && timedOut) {
      throw new ApiError('timeout', 408)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/**
 * effectiveAt(자정 UTC 의 날짜성 타임스탬프)을 표시용으로. timeZone 을 UTC 로
 * 고정해 음수 오프셋 로캘에서 하루 밀리는 off-by-one 을 막는다.
 */
export function formatPolicyDate(value: string, lang: Lang): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

// ─────────── 본문 최소 파서 ───────────
// 본문은 마크다운일 수도, 한국어 조문(`제N조 (제목)` + 문단 + `- ` 불릿) 형식의
// 평문일 수도 있다. HTML 주입 없이 React 엘리먼트로 안전하게 렌더링하도록
// 문자열을 블록 구조로만 분해한다 (인라인 마크업은 의도적으로 다루지 않는
// 최소 파서 — 원문 그대로 텍스트 노드가 된다).

export type PolicyHeadingLevel = 2 | 3 | 4 | 5 | 6

export type PolicyBlock =
  | { kind: 'heading'; level: PolicyHeadingLevel; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'divider' }

const MD_HEADING_RE = /^(#{1,6})\s+(.+)$/
const DIVIDER_RE = /^(?:-{3,}|\*{3,}|_{3,})$/
const BULLET_RE = /^[-*+]\s+(.+)$/
const ORDERED_RE = /^\d{1,3}[.)]\s+(.+)$/
const ARTICLE_PREFIX_RE = /^제\d{1,4}조/

/** `제1조` 또는 `제1조 (목적)` 처럼 조문 표제만 단독으로 있는 줄. */
function isArticleHeadingLine(line: string): boolean {
  const article = ARTICLE_PREFIX_RE.exec(line)
  if (!article) return false
  const rest = line.slice(article[0].length).trim()
  if (rest === '') return true
  return rest.startsWith('(') && rest.endsWith(')')
}

/** 페이지 표제 아래에 들어가므로 마크다운 헤딩은 한 단계 낮춘다. */
function demoteHeadingLevel(hashCount: number): PolicyHeadingLevel {
  return Math.min(hashCount + 1, 6) as PolicyHeadingLevel
}

export function parsePolicyBody(body: string): PolicyBlock[] {
  const blocks: PolicyBlock[] = []
  let paragraphLines: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({ kind: 'paragraph', text: paragraphLines.join('\n') })
      paragraphLines = []
    }
  }

  const flushList = () => {
    if (list) {
      blocks.push({ kind: 'list', ordered: list.ordered, items: list.items })
      list = null
    }
  }

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (line === '') {
      flushParagraph()
      flushList()
      continue
    }

    const mdHeading = MD_HEADING_RE.exec(line)
    if (mdHeading) {
      flushParagraph()
      flushList()
      blocks.push({
        kind: 'heading',
        level: demoteHeadingLevel(mdHeading[1].length),
        text: mdHeading[2].trim(),
      })
      continue
    }

    if (DIVIDER_RE.test(line)) {
      flushParagraph()
      flushList()
      blocks.push({ kind: 'divider' })
      continue
    }

    const bullet = BULLET_RE.exec(line)
    if (bullet) {
      flushParagraph()
      if (list?.ordered) flushList()
      list ??= { ordered: false, items: [] }
      list.items.push(bullet[1].trim())
      continue
    }

    const ordered = ORDERED_RE.exec(line)
    if (ordered) {
      flushParagraph()
      if (list && !list.ordered) flushList()
      list ??= { ordered: true, items: [] }
      list.items.push(ordered[1].trim())
      continue
    }

    // 조문 표제는 블록의 첫 줄일 때만 헤딩으로 승격한다.
    // (문단 중간의 `제N조...` 인용 줄은 본문으로 남긴다.)
    if (paragraphLines.length === 0 && isArticleHeadingLine(line)) {
      flushList()
      blocks.push({ kind: 'heading', level: 2, text: line })
      continue
    }

    flushList()
    paragraphLines.push(line)
  }

  flushParagraph()
  flushList()

  return blocks
}
