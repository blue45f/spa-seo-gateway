import { useStore } from '../lib/store';

const KIND_BG: Record<string, string> = {
  success: 'bg-ok-bg text-ok-fg border border-ok',
  error: 'bg-err-bg text-err-fg border border-err',
  warn: 'bg-warn-bg text-warn-fg border border-warn',
  info: 'bg-accent-soft text-ink border border-accent',
};

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] space-y-2"
      role="status"
      aria-live="polite"
      data-testid="toast-container"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`toast-enter ${KIND_BG[t.kind] ?? 'bg-accent-soft text-ink border border-accent'} text-sm rounded-lg px-4 py-2 shadow-lg flex items-center gap-2 min-w-[220px]`}
        >
          <span aria-hidden="true">{t.icon}</span>
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => removeToast(t.id)}
            className="opacity-70 hover:opacity-100 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
