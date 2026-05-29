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

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
