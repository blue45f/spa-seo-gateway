import type { ReactNode } from 'react';
import { useEffect } from 'react';

type ModalProps = {
  open: boolean;
  onClose(): void;
  title: ReactNode;
  children: ReactNode;
  /** 화면이 좁아도 모달 폭이 너무 좁아지지 않도록 max-w 클래스 지정 */
  size?: 'md' | 'lg' | 'xl';
};

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
};

export function Modal({ open, onClose, title, children, size = 'lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="modal"
      className="fixed inset-0 z-[70] bg-black/50 flex items-start justify-center pt-12 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-lg shadow-2xl w-full ${SIZE_CLASS[size]} max-h-[80vh] overflow-y-auto`}
      >
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="font-semibold">{title}</div>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xl leading-none"
            onClick={onClose}
            aria-label="close"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
