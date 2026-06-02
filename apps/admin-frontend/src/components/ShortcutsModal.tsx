import { useEffect, useId, useRef } from 'react';
import { useStore } from '../lib/store';

export function ShortcutsModal() {
  const open = useStore((s) => s.shortcutsOpen);
  const close = useStore((s) => s.closeShortcuts);
  const t = useStore((s) => s.t);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop intentionally not interactive — close on backdrop click only
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handled globally; backdrop click is mouse-only
    <div
      className="fixed inset-0 z-[80] bg-scrim flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      data-testid="shortcuts-modal"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-panel border border-line rounded-lg shadow-2xl p-6 max-w-md focus-visible:outline-none"
      >
        <h3 id={titleId} className="font-semibold text-lg mb-3">
          {t('shortcuts.title')}
        </h3>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            <tr>
              <td className="py-2">
                <kbd className="px-2 py-0.5 bg-panel-2 border border-line rounded text-xs">
                  ⌘/Ctrl + K
                </kbd>
              </td>
              <td>Command palette</td>
            </tr>
            <tr>
              <td className="py-2">
                <kbd className="px-2 py-0.5 bg-panel-2 border border-line rounded text-xs">
                  ⌘/Ctrl + S
                </kbd>
              </td>
              <td>Save routes (on routes tab)</td>
            </tr>
            <tr>
              <td className="py-2">
                <kbd className="px-2 py-0.5 bg-panel-2 border border-line rounded text-xs">?</kbd>
              </td>
              <td>This help</td>
            </tr>
            <tr>
              <td className="py-2">
                <kbd className="px-2 py-0.5 bg-panel-2 border border-line rounded text-xs">Esc</kbd>
              </td>
              <td>Close modal</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-4 text-right">
          <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={close}>
            {t('btn.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
