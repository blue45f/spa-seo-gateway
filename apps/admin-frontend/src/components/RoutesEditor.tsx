import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import type { ScopedRoute } from '../lib/types';

/**
 * Routes 편집 테이블 (controlled component).
 *
 * - 글로벌 routes (Routes 페이지) / 사이트별 routes (SiteDetail) / 테넌트별 routes (TenantDetail) 가 공유.
 * - 본 컴포넌트는 저장 버튼을 갖지 않고 onChange 로 부모에게 변경을 위임.
 * - 드래그 리오더, 패턴 필터, 추가/삭제, 셀 단위 인라인 편집 지원.
 */
export type RoutesEditorProps = {
  routes: ScopedRoute[];
  onChange(next: ScopedRoute[]): void;
  /** 컬럼 헤더에서 사용할 라벨. i18n key 가 아닌 화면 문자열 그대로. */
  labels?: {
    pattern?: string;
    ttl?: string;
    waitUntil?: string;
    waitSelector?: string;
    waitMs?: string;
    ignore?: string;
    actions?: string;
  };
  /** 드래그 리오더 활성화 여부 (기본 true) */
  reorderable?: boolean;
};

export function RoutesEditor({
  routes,
  onChange,
  labels,
  reorderable = true,
}: RoutesEditorProps) {
  const t = useStore((s) => s.t);
  const pushToast = useStore((s) => s.pushToast);
  const [filter, setFilter] = useState('');
  const [dragSrc, setDragSrc] = useState<number | null>(null);

  const L = {
    pattern: labels?.pattern ?? t('routes.col.pattern'),
    ttl: labels?.ttl ?? t('routes.col.ttl'),
    waitUntil: labels?.waitUntil ?? t('routes.col.waitUntil'),
    waitSelector: labels?.waitSelector ?? t('routes.col.waitSelector'),
    waitMs: labels?.waitMs ?? t('routes.col.waitMs'),
    ignore: labels?.ignore ?? t('routes.col.ignore'),
    actions: labels?.actions ?? '',
  };

  function update(i: number, patch: Partial<ScopedRoute>) {
    onChange(routes.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function add() {
    onChange([
      ...routes,
      {
        pattern: '',
        ttlMs: undefined,
        waitUntil: undefined,
        waitSelector: undefined,
        waitMs: undefined,
        ignore: false,
      },
    ]);
  }

  function remove(i: number) {
    onChange(routes.filter((_, idx) => idx !== i));
  }

  function onDrop(dst: number) {
    if (!reorderable) return;
    if (dragSrc === null || dragSrc === dst) return;
    const arr = routes.slice();
    const [moved] = arr.splice(dragSrc, 1);
    arr.splice(dst, 0, moved);
    onChange(arr);
    pushToast(`라우트 순서 변경 (${dragSrc + 1} → ${dst + 1})`, 'info');
    setDragSrc(null);
  }

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return routes.map((r, i) => ({ row: r, idx: i }));
    return routes
      .map((r, i) => ({ row: r, idx: i }))
      .filter(
        ({ row }) =>
          (row.pattern || '').toLowerCase().includes(q) ||
          (row.waitSelector || '').toLowerCase().includes(q),
      );
  }, [routes, filter]);

  return (
    <div className="space-y-3" data-testid="routes-editor">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          className="flex-1 min-w-48 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-sm"
          placeholder={t('routes.filter.placeholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          className="px-3 py-2 rounded bg-slate-900 dark:bg-indigo-600 text-white text-sm"
          onClick={add}
        >
          {t('btn.add')}
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">{t('routes.empty')}</p>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left w-8">#</th>
                <th className="px-3 py-2 text-left">{L.pattern}</th>
                <th className="px-3 py-2 text-left w-24">{L.ttl}</th>
                <th className="px-3 py-2 text-left w-32">{L.waitUntil}</th>
                <th className="px-3 py-2 text-left">{L.waitSelector}</th>
                <th className="px-3 py-2 text-left w-20">{L.waitMs}</th>
                <th className="px-3 py-2 text-center w-16">{L.ignore}</th>
                <th className="px-3 py-2 text-right w-20">{L.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(({ row: r, idx: i }) => (
                <tr
                  key={`${i}-${r.pattern}`}
                  className={`drag-row ${dragSrc === i ? 'dragging' : ''}`}
                  draggable={reorderable}
                  onDragStart={(e) => {
                    setDragSrc(i);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    e.currentTarget.classList.add('drag-over');
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove('drag-over');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('drag-over');
                    onDrop(i);
                  }}
                  onDragEnd={() => setDragSrc(null)}
                >
                  <td className="px-3 py-2 text-slate-400 select-none">{i + 1}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                      value={r.pattern}
                      onChange={(e) => update(i, { pattern: e.target.value })}
                      placeholder="^/products/[0-9]+"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-xs"
                      value={r.ttlMs ?? ''}
                      onChange={(e) =>
                        update(i, {
                          ttlMs: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-xs"
                      value={r.waitUntil ?? ''}
                      onChange={(e) =>
                        update(i, {
                          waitUntil:
                            (e.target.value as ScopedRoute['waitUntil']) || undefined,
                        })
                      }
                    >
                      <option value="">(default)</option>
                      <option value="load">load</option>
                      <option value="domcontentloaded">domcontentloaded</option>
                      <option value="networkidle0">networkidle0</option>
                      <option value="networkidle2">networkidle2</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-xs"
                      value={r.waitSelector ?? ''}
                      onChange={(e) => update(i, { waitSelector: e.target.value || undefined })}
                      placeholder="[data-loaded]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-xs"
                      value={r.waitMs ?? ''}
                      onChange={(e) =>
                        update(i, {
                          waitMs: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!r.ignore}
                      onChange={(e) => update(i, { ignore: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-800 text-xs"
                      onClick={() => remove(i)}
                    >
                      {t('btn.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
