import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { navItemsForLang } from '../lib/nav';
import { useStore } from '../lib/store';
import { NavIcon } from './NavIcon';

export function CommandPalette() {
  const open = useStore((s) => s.cmdPaletteOpen);
  const close = useStore((s) => s.closeCmd);
  const lang = useStore((s) => s.lang);
  const mode = useStore((s) => s.publicInfo?.mode);
  const t = useStore((s) => s.t);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      // autoFocus 대체 — open 시 input 으로 포커스 이동
      inputRef.current?.focus();
    }
  }, [open]);

  const items = useMemo(() => navItemsForLang(lang, mode), [lang, mode]);
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
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop intentionally not interactive — close on backdrop click only
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handled by Modal/global shortcut; backdrop has no keyboard target
    <div
      className="fixed inset-0 z-[80] bg-scrim flex items-start justify-center pt-24 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      data-testid="cmd-palette"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('cmd.placeholder')}
        className="bg-panel border border-line rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
      >
        <input
          ref={inputRef}
          type="text"
          aria-label={t('cmd.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('cmd.placeholder')}
          className="w-full px-4 py-3 text-sm border-b border-line bg-transparent text-ink placeholder:text-ink-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
        />
        <ul className="max-h-72 overflow-y-auto">
          {filtered.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className="w-full text-left px-4 py-2 hover:bg-accent-soft flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                onClick={() => {
                  navigate(n.path);
                  close();
                }}
              >
                <span aria-hidden="true" className="flex text-ink-subtle">
                  <NavIcon id={n.id} className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm">{n.label}</span>
                <span className="text-xs text-ink-subtle">{n.subtitle}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-sm text-center text-ink-subtle">{t('cmd.empty')}</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
