/**
 * Instrument-panel motion helpers — restrained, reduced-motion-safe.
 *
 * 콘솔 수치가 "계기처럼 살아있게" 보이도록 하는 최소 단위의 훅 모음.
 * 전부 prefers-reduced-motion 을 존중하고, 첫 렌더(=SSR/테스트)에서는 항상
 * 최종 값을 그대로 그린다 — 애니메이션은 그 위의 enhancement 일 뿐이다.
 */
import { useEffect, useRef, useState } from 'react'

/** ease-out-quart — DESIGN.md 의 표준 감속 곡선과 동일(140–220ms 대역). */
function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4
}

/**
 * prefers-reduced-motion 구독. matchMedia 미지원 환경(테스트/SSR)에서는
 * "모션 허용 안 함"으로 본다 — 그러면 모든 수치가 곧장 최종 값으로 렌더된다.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof globalThis.matchMedia !== 'function') return true
    return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof globalThis.matchMedia !== 'function') return undefined
    const mq = globalThis.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/**
 * 목표 숫자로 부드럽게 카운트업 — 변경분에만 반응한다.
 *
 * - 첫 렌더와 reduced-motion 사용자: 곧장 `value` 반환(애니메이션 없음).
 * - 이후 `value` 가 바뀌면 이전 값 → 새 값으로 ease-out-quart 보간.
 * - 반환은 항상 number; 표시 문자열 포맷은 호출부의 기존 포맷터가 담당한다
 *   (그래서 정지 상태의 출력 문자열이 종전과 100% 동일).
 */
export function useCountUp(value: number, durationMs = 520): number {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    // 모션을 끈 경우(또는 비유한 값): 보간 없이 즉시 확정.
    if (reduced || !Number.isFinite(value)) {
      setDisplay(value)
      fromRef.current = value
      return undefined
    }
    const from = fromRef.current
    if (from === value) return undefined

    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs)
      const eased = easeOutQuart(p)
      setDisplay(from + (value - from) * eased)
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      // 중단되면 최종 값을 출발점으로 확정해 다음 변경의 기준을 맞춘다.
      fromRef.current = value
    }
  }, [value, durationMs, reduced])

  return reduced ? value : display
}
