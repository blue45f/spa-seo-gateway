import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { api, ApiError } from '../lib/api';
import { useStore } from '../lib/store';
import type { RouteOverride } from '../lib/types';

export function RoutesPage() {
  return (
    <AuthGate>
      <RoutesBody />
    </AuthGate>
  );
}

function RoutesBody() {
  const t = useStore((s) => s.t);
  const setError = useStore((s) => s.setGlobalError);
  const pushToast = useStore((s) => s.pushToast);
  const [routes, setRoutes] = useState<RouteOverride[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragSrc, setDragSrc] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ ok: true; routes: RouteOverride[] }>('GET', '/admin/api/routes');
      setRoutes(
        (r.routes ?? []).map((x) => ({
          pattern: x.pattern || '',
          ttlMs: x.ttlMs ?? null,
          waitUntil: x.waitUntil ?? '',
          waitSelector: x.waitSelector ?? '',
          waitMs: x.waitMs ?? null,
          ignore: x.ignore ?? false,
        })),
      );
      setError('');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (persist: boolean) => {
      try {
        const cleaned = routes
          .filter((r) => r.pattern)
          .map((r) => ({
            pattern: r.pattern,
            ...(r.ttlMs ? { ttlMs: Number(r.ttlMs) } : {}),
            ...(r.waitUntil ? { waitUntil: r.waitUntil } : {}),
            ...(r.waitSelector ? { waitSelector: r.waitSelector } : {}),
            ...(r.waitMs ? { waitMs: Number(r.waitMs) } : {}),
            ...(r.ignore ? { ignore: true } : {}),
          }));
        await api('PUT', '/admin/api/routes', { routes: cleaned, persist });
        pushToast(persist ? t('btn.save-disk') : t('btn.save-memory'), 'success');
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : (e as Error).message;
        setError(msg);
        pushToast(msg, 'error');
      }
    },
    [routes, pushToast, setError, t],
  );

  // ⌘/Ctrl + S 단축키
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save(false);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [save]);

  function update(i: number, patch: Partial<RouteOverride>) {
    setRoutes((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function add() {
    setRoutes((rs) => [
      ...rs,
      {
        pattern: '',
        ttlMs: null,
        waitUntil: '',
        waitSelector: '',
        waitMs: null,
        ignore: false,
      },
    ]);
  }
  function remove(i: number) {
    setRoutes((rs) => rs.filter((_, idx) => idx !== i));
  }

  function onDrop(dst: number) {
    if (dragSrc === null || dragSrc === dst) return;
    setRoutes((rs) => {
      const arr = rs.slice();
      const [moved] = arr.splice(dragSrc, 1);
      arr.splice(dst, 0, moved);
      return arr;
    });
    pushToast(`라우트 순서 변경 (${dragSrc + 1} → ${dst + 1})`, 'info');
    setDragSrc(null);
  }

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return routes;
    return routes.filter(
      (r) =>
        (r.pattern || '').toLowerCase().includes(q) ||
        (r.waitSelector || '').toLowerCase().includes(q),
    );
  }, [routes, filter]);

  return (
    <section className="space-y-4" data-testid="page-routes">
      <div className="bg-blue-50 dark:bg-indigo-950 dark:border-indigo-900 border border-blue-200 rounded-lg p-4 text-sm">
        <h3 className="font-semibold text-blue-900 dark:text-indigo-200 mb-1">{t('routes.title')}</h3>
        <p className="text-blue-800 dark:text-indigo-300">{t('routes.intro')}</p>
      </div>

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
          className="px-3 py-2 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm"
          onClick={load}
          disabled={loading}
        >
          {t('btn.refresh')}
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded bg-slate-900 dark:bg-indigo-600 text-white text-sm"
          onClick={add}
        >
          {t('btn.add')}
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
          onClick={() => save(false)}
        >
          {t('btn.save-memory')}
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-sm"
          onClick={() => save(true)}
          title="seo-gateway.config.json 에 영구 저장"
        >
          {t('btn.save-disk')}
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
                <th className="px-3 py-2 text-left">{t('routes.col.pattern')}</th>
                <th className="px-3 py-2 text-left w-24">{t('routes.col.ttl')}</th>
                <th className="px-3 py-2 text-left w-32">{t('routes.col.waitUntil')}</th>
                <th className="px-3 py-2 text-left">{t('routes.col.waitSelector')}</th>
                <th className="px-3 py-2 text-left w-20">{t('routes.col.waitMs')}</th>
                <th className="px-3 py-2 text-center w-16">{t('routes.col.ignore')}</th>
                <th className="px-3 py-2 text-right w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((r) => {
                const i = routes.indexOf(r);
                return (
                  <tr
                    key={`${i}-${r.pattern}`}
                    className={`drag-row ${dragSrc === i ? 'dragging' : ''}`}
                    draggable
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
                    <td className="px-3 py-2 text-slate-400 cursor-grab select-none">{i + 1}</td>
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
                          update(i, { ttlMs: e.target.value ? Number(e.target.value) : null })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-xs"
                        value={r.waitUntil ?? ''}
                        onChange={(e) =>
                          update(i, { waitUntil: e.target.value as RouteOverride['waitUntil'] })
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
                        onChange={(e) => update(i, { waitSelector: e.target.value })}
                        placeholder="[data-loaded]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-xs"
                        value={r.waitMs ?? ''}
                        onChange={(e) =>
                          update(i, { waitMs: e.target.value ? Number(e.target.value) : null })
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
