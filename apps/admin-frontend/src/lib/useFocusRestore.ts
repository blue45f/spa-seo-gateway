import { useEffect, useRef } from 'react'

/**
 * `open` 이 false→true 로 전이될 때 현재 포커스 요소를 기억하고,
 * 닫힐 때(또는 unmount) 그 요소로 포커스를 되돌린다.
 *
 * 캡처는 open 전이 시점에만 일어나므로(deps=[open], open 유지 중에는 재실행 안 됨),
 * 다이얼로그 내부 요소가 아니라 다이얼로그를 연 트리거가 기록된다.
 */
export function useFocusRestore(open: boolean): void {
  const prevRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined
    prevRef.current = document.activeElement as HTMLElement | null
    return () => {
      prevRef.current?.focus?.()
    }
  }, [open])
}
