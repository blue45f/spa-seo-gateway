/// <reference types="vite/client" />
declare module '*.css'

interface ImportMetaEnv {
  /** SurveyDesk 백엔드 URL. 미설정(기본)이면 피드백 위젯을 렌더하지 않는다. */
  readonly VITE_SURVEYDESK_URL?: string
  /** ChangelogDesk 백엔드 URL. 미설정(기본)이면 변경 이력 위젯을 렌더하지 않는다. */
  readonly VITE_CHANGELOGDESK_URL?: string
  /** ChangelogDesk 테넌트 퍼블리시 키(pk_…). 미설정 시 'pk_demo'. */
  readonly VITE_CHANGELOGDESK_PK?: string
  /** NotifyDesk 백엔드 URL. 미설정(기본)이면 알림 벨 위젯을 렌더하지 않는다. */
  readonly VITE_NOTIFYDESK_URL?: string
  /** NotifyDesk 테넌트 퍼블리시 키(pk_…). 미설정 시 'pk_demo'. */
  readonly VITE_NOTIFYDESK_PK?: string
  /** SearchDesk 백엔드 URL. 미설정(기본)이면 ⌘⇧K 검색 팔레트를 렌더하지 않는다. */
  readonly VITE_SEARCHDESK_URL?: string
  /** SearchDesk 테넌트 퍼블리시 키(pk_…). 미설정 시 'pk_demo'. */
  readonly VITE_SEARCHDESK_PK?: string
  /** desk-platform 문의(Inquiry) 백엔드 URL. 미설정 시 prod 기본값(desk-platform.vercel.app). */
  readonly VITE_DESK_PLATFORM_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
