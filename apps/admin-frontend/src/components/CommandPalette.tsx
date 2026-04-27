import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { navItemsForLang } from '../lib/nav';
import { useStore } from '../lib/store';

export function CommandPalette() {
  const open = useStore((s) => s.cmdPaletteOpen);
  const close = useStore((s) => s.closeCmd);
  const lang = useStore((s) => s.lang);
  const t = useStore((s) => s.t);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const items = useMemo(() => navItemsForLang(lang), [lang]);
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (n) =>
        n.label.toLowerCase().includes(q) ||
        n.id.toLowerCase().includes(q) ||
        (n.subtitle ?? '').toLowerCase().includes(q),
    );
  }, [items, query]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] bg-black/50 flex items-start justify-center pt-24 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      data-testid="cmd-palette"
    >
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('cmd.placeholder')}
          className="w-full px-4 py-3 text-sm border-b border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none"
        />
        <ul className="max-h-72 overflow-y-auto">
          {filtered.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-3"
                onClick={() => {
                  navigate(n.path);
                  close();
                }}
              >
                <span aria-hidden="true">{n.icon}</span>
                <span className="flex-1 text-sm">{n.label}</span>
                <span className="text-xs text-slate-500">{n.subtitle}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-sm text-center text-slate-500">{t('cmd.empty')}</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
