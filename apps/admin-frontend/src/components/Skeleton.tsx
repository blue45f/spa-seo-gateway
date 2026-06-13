import type { CSSProperties } from 'react'

/**
 * 로딩 스켈레톤 — 단순 회색 placeholder.
 * prefers-reduced-motion 사용자에게는 styles.css 에서 pulse 애니메이션을 제거합니다.
 */
type SkeletonProps = {
  /** Tailwind width 클래스 또는 임의의 width. 기본 w-full */
  className?: string
  style?: CSSProperties
  /** 사용자가 SR 로 읽었을 때 안내할 라벨. 기본 'loading' */
  label?: string
}

export function Skeleton({ className = '', style, label = 'loading' }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      data-testid="skeleton"
      style={style}
      className={`skeleton-pulse rounded bg-line ${className}`}
    />
  )
}

/** Dashboard 카드 3개 placeholder (반응형으로 동일 그리드 사용). */
export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="card-grid-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel p-5 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

/** Detail-page placeholder — a panel with a heading and a few field rows. */
export function DetailSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="panel p-5 space-y-3" data-testid="detail-skeleton">
      <Skeleton className="h-4 w-40" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  )
}
