import { useRouteAnnouncer } from '../lib/useRouteAnnouncer'

/**
 * SPA 라우트 전환을 스크린리더에 알리는 visually-hidden live region.
 *
 * 화면에는 보이지 않지만(sr-only) aria-live="polite" 라서, 라우트가 바뀔 때마다
 * useRouteAnnouncer 가 채운 안내 문구를 보조 기술이 읽어 준다. 포커스 이동 및
 * document.title 갱신도 같은 훅이 수행한다 (부수효과).
 *
 * Layout 의 chrome 레이어에 한 번만 마운트한다. 기존 화면 스타일에는 영향이 없다.
 */
export function RouteAnnouncer() {
  const message = useRouteAnnouncer()
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="route-announcer"
    >
      {message}
    </p>
  )
}
