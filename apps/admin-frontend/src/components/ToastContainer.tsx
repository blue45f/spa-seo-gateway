import { useStore } from '../lib/store';

const KIND_BG: Record<string, string> = {
  success: 'bg-emerald-600',
  error: 'bg-red-600',
  warn: 'bg-amber-500',
  info: 'bg-slate-700',
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
          className={`toast-enter ${KIND_BG[t.kind] ?? 'bg-slate-700'} text-white text-sm rounded-lg px-4 py-2 shadow-lg flex items-center gap-2 min-w-[220px]`}
        >
          <span aria-hidden="true">{t.icon}</span>
          <span className="flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => removeToast(t.id)}
            className="opacity-70 hover:opacity-100"
            aria-label="dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
