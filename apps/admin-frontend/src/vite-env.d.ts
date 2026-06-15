/// <reference types="vite/client" />
declare module '*.css'

interface ImportMetaEnv {
  /** SurveyDesk 백엔드 URL. 미설정(기본)이면 피드백 위젯을 렌더하지 않는다. */
  readonly VITE_SURVEYDESK_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
