import { QueryClient } from '@tanstack/react-query'

/**
 * react-query 기본값을 기존 fetch-on-mount 동작에 정확히 맞춘다.
 *
 * 이 앱의 종전 페이지들은 "마운트 시 1회 fetch + 수동 새로고침 버튼" 모델이었다.
 * react-query 의 공격적 기본값(윈도우 포커스/재연결 refetch, 자동 retry, staleTime 0
 * 으로 인한 백그라운드 갱신)을 그대로 두면 stale 데이터·깜빡임·중복 요청이 새로 생겨
 * 사용자 가시 동작이 달라진다. 그래서 다음을 끈다:
 *
 * - refetchOnWindowFocus / refetchOnReconnect: 종전엔 없던 자동 refetch → off
 * - retry: 종전엔 1회 실패하면 곧장 에러 표면화 → off (0회 재시도)
 * - staleTime Infinity: 캐시를 절대 자동으로 stale 표시하지 않음 → 백그라운드 refetch 없음.
 *   명시적 새로고침(refetch)·뮤테이션 후 invalidate 만 갱신을 유발한다.
 *
 * Metrics 의 5s 폴링처럼 능동 갱신이 필요한 화면은 해당 useQuery 에서 refetchInterval 로
 * 개별 지정한다(전역 기본값을 깨지 않으면서 기존 동작 재현).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/** 앱 전역 단일 인스턴스 — 테스트는 createQueryClient() 로 매번 새 인스턴스를 쓴다. */
export const queryClient = createQueryClient()
