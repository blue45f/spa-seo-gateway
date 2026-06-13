/**
 * Figure — 계기판 수치 한 개.
 *
 * 숫자를 목표값으로 카운트업하고(useCountUp), 값이 바뀌면 한 박자 옅게 강조한다.
 * 정지 상태의 출력 문자열은 전적으로 `format(value)` 가 결정하므로 종전 표기와 동일.
 * reduced-motion 사용자에겐 카운트업/강조 모두 비활성(useCountUp + .figure-pulse 가드).
 */
import { useEffect, useRef, useState } from 'react'

import { useCountUp } from '../lib/useInstrument'

type FigureProps = {
  /** 카운트업 목표 숫자. */
  value: number
  /** 화면 표기 포맷터. 보간 중에는 중간 숫자가, 정지 시 정확히 format(value) 가 나온다. */
  format: (n: number) => string
  className?: string
}

export function Figure({ value, format, className }: FigureProps) {
  const display = useCountUp(value)
  const [pulse, setPulse] = useState(false)
  const prev = useRef(value)

  // 값이 실제로 바뀐 갱신에서만 강조 클래스를 한 사이클 부여.
  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    setPulse(true)
    const id = setTimeout(() => setPulse(false), 560)
    return () => clearTimeout(id)
  }, [value])

  return (
    <span className={`${pulse ? 'figure-pulse' : ''} ${className ?? ''}`}>{format(display)}</span>
  )
}
