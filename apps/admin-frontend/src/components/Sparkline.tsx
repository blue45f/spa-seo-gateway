/**
 * Sparkline — 콘솔 수치 옆에 두는 아주 작은 추세선.
 *
 * 장식이 아니라 "이 값이 최근 어디서 왔는가"를 한 눈에 보여주는 계기 보조선이다.
 * 데이터의 진실은 옆의 mono 수치 / 아래 표가 운반하므로 SVG 자체는 aria-hidden.
 * stroke 한 줄 + currentColor 만 사용 — gradient/glass/채움 없음(DESIGN.md 금지 패턴 회피).
 * 색은 호출부의 text-* 유틸리티(text-ink-subtle, text-accent, text-ok …)가 정한다.
 */
type SparklineProps = {
  /** 시간순 표본(오래된→최신). 2개 미만이면 렌더하지 않는다. */
  values: number[]
  width?: number
  height?: number
  /** 마지막 점에 작은 도트로 "지금" 위치를 표시. */
  marker?: boolean
  className?: string
}

export function Sparkline({
  values,
  width = 72,
  height = 22,
  marker = true,
  className,
}: SparklineProps) {
  const pts = values.filter(Number.isFinite)
  if (pts.length < 2) return null

  const pad = 2
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1 // 평평한 시계열이면 중앙선으로 눕힌다
  const stepX = (width - pad * 2) / (pts.length - 1)

  const xy = pts.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (1 - (v - min) / span) * (height - pad * 2)
    return [x, y] as const
  })
  const d = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const last = xy[xy.length - 1]
  const lineLen = Math.round(width * 1.6) // 그리기-리빌용 대략 길이(여유 있게)

  return (
    <svg
      className={`spark ${className ?? ''}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
        style={{ strokeDasharray: lineLen, strokeDashoffset: lineLen }}
      />
      {marker && last ? <circle cx={last[0]} cy={last[1]} r={1.9} fill="currentColor" /> : null}
    </svg>
  )
}
