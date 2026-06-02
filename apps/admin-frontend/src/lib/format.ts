/** 사용자에게 보일 수치 포맷터 모음 — 모든 페이지가 공유. */

export function formatUptime(sec?: number): string {
  if (!sec) return '...';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d ? `${d}d` : '', h ? `${h}h` : '', `${m}m`].filter(Boolean).join(' ');
}

export function lighthouseScoreColor(score?: number | null): string {
  if (score == null) return 'text-ink-subtle';
  if (score >= 90) return 'text-ok-fg';
  if (score >= 50) return 'text-warn-fg';
  return 'text-err-fg';
}

/** Lighthouse 점수 밴드 — 색과 같은 임계값을 공유해 색/라벨이 어긋나지 않게 한다. */
export function lighthouseScoreBand(score?: number | null): 'good' | 'needs' | 'poor' | null {
  if (score == null) return null;
  if (score >= 90) return 'good';
  if (score >= 50) return 'needs';
  return 'poor';
}

/** 0-1 확신도(confidence)를 상태 토큰으로 — 수치 옆 색 신호 전용. */
export function confidenceColor(c: number): string {
  if (c >= 0.9) return 'text-ok-fg';
  if (c >= 0.5) return 'text-warn-fg';
  return 'text-err-fg';
}

export function methodPillClass(method: string): string {
  return (
    {
      GET: 'bg-ok-bg text-ok-fg',
      POST: 'bg-accent-soft text-accent',
      PUT: 'bg-warn-bg text-warn-fg',
      DELETE: 'bg-err-bg text-err-fg',
      PATCH: 'bg-panel-2 text-ink-muted',
    }[method] ?? 'bg-panel-2 text-ink-subtle'
  );
}

export function bytesToHuman(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}
