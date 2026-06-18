/**
 * DeskCloud — 네이티브 SDK 연동의 단일 진입점.
 * ──────────────────────────────────────────────────────────────────────────
 * 공개 npm 패키지 `@heejun/deskcloud` 의 브라우저(pk_) 클라이언트만 사용한다.
 * 절대 `@heejun/deskcloud/server`(sk_ 서버 전용)를 import 하지 않는다 — sk_ 가
 * 클라이언트 번들에 들어가면 안 되기 때문(공개 키 pk_ 만 브라우저 노출 안전).
 *
 * 각 Desk 는 해당 `VITE_<DESK>DESK_URL` 이 설정됐을 때만 활성화된다(미설정 = 비활성).
 * 미설정 시 앱의 기존 1차(first-party) 기능으로 자연 폴백한다(되돌림 가능).
 * 퍼블리시 키(pk_)는 브라우저 노출이 안전하며, 미지정 시 `pk_demo` 로 폴백한다.
 *
 * 위젯(외부 CSS·번들)을 마운트하지 않는다 — 데이터만 SDK 로 받아 앱 컴포넌트·토큰으로 렌더한다.
 */
import {
  createChangelogClient,
  createNotifyClient,
  createSearchClient,
  type ChangelogClient,
  type NotifyClient,
  type SearchClient,
} from '@heejun/deskcloud'

const env = import.meta.env

/** pk_ 키 헬퍼 — 미설정 시 데모 키로 폴백(브라우저 노출 안전). */
function pk(value: string | undefined): string {
  return value && value.trim().length > 0 ? value : 'pk_demo'
}

/** ChangelogDesk — 변경 이력. URL 이 있을 때만 클라이언트를 만든다. */
export function getChangelogDesk(): ChangelogClient | null {
  const endpoint = env.VITE_CHANGELOGDESK_URL
  if (!endpoint) return null
  return createChangelogClient({ endpoint, publishableKey: pk(env.VITE_CHANGELOGDESK_PK) })
}

/** NotifyDesk — 인앱 알림 인박스. URL 이 있을 때만 클라이언트를 만든다. */
export function getNotifyDesk(): NotifyClient | null {
  const endpoint = env.VITE_NOTIFYDESK_URL
  if (!endpoint) return null
  return createNotifyClient({ endpoint, publishableKey: pk(env.VITE_NOTIFYDESK_PK) })
}

/** SearchDesk — 호스티드 풀텍스트 검색. URL 이 있을 때만 클라이언트를 만든다. */
export function getSearchDesk(): SearchClient | null {
  const endpoint = env.VITE_SEARCHDESK_URL
  if (!endpoint) return null
  return createSearchClient({ endpoint, publishableKey: pk(env.VITE_SEARCHDESK_PK) })
}

/** 익명 식별자 — ChangelogDesk 의 미읽음/읽음 추적에 쓰는 디바이스 anonId. */
const ANON_KEY = 'spa-seo-gateway:deskcloud:anonId'
let anonMemory: string | null = null

function randomId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function getAnonId(): string {
  if (typeof localStorage !== 'undefined') {
    try {
      const existing = localStorage.getItem(ANON_KEY)
      if (existing) return existing
      const created = randomId()
      localStorage.setItem(ANON_KEY, created)
      return created
    } catch {
      /* 스토리지 차단(시크릿/샌드박스) → 메모리 폴백 */
    }
  }
  if (!anonMemory) anonMemory = randomId()
  return anonMemory
}
