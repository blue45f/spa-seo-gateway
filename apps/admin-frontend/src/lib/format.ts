/** 사용자에게 보일 수치 포맷터 모음 — 모든 페이지가 공유. */

export function formatUptime(sec?: number): string {
  if (!sec) return '...';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d ? `${d}d` : '', h ? `${h}h` : '', `${m}m`].filter(Boolean).join(' ');
}

export function lighthouseScoreColor(score?: number | null): string {
  if (score == null) return 'text-slate-400';
  if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function methodPillClass(method: string): string {
  return (
    {
      GET: 'bg-emerald-100 text-emerald-800',
      POST: 'bg-blue-100 text-blue-800 dark:text-indigo-300',
      PUT: 'bg-amber-100 text-amber-800',
      DELETE: 'bg-red-100 text-red-800',
      PATCH: 'bg-purple-100 text-purple-800',
    }[method] ?? 'bg-slate-100'
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
