import { useStore } from '../lib/store';

export function ShortcutsModal() {
  const open = useStore((s) => s.shortcutsOpen);
  const close = useStore((s) => s.closeShortcuts);
  const t = useStore((s) => s.t);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      data-testid="shortcuts-modal"
    >
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl p-6 max-w-md">
        <h3 className="font-semibold text-lg mb-3">키보드 단축키 / Shortcuts</h3>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr>
              <td className="py-2">
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">
                  ⌘/Ctrl + K
                </kbd>
              </td>
              <td>Command palette</td>
            </tr>
            <tr>
              <td className="py-2">
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">
                  ⌘/Ctrl + S
                </kbd>
              </td>
              <td>Save routes (on routes tab)</td>
            </tr>
            <tr>
              <td className="py-2">
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">?</kbd>
              </td>
              <td>This help</td>
            </tr>
            <tr>
              <td className="py-2">
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">
                  Esc
                </kbd>
              </td>
              <td>Close modal</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-4 text-right">
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded bg-slate-900 text-white hover:bg-slate-700"
            onClick={close}
          >
            {t('btn.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
