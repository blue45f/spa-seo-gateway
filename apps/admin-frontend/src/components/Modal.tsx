import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

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
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Escape 키로 닫기 — open 일 때만 등록.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // body scroll 잠금 + 이전 focus 복원.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // 다이얼로그 자체에 포커스 — 키보드 사용자에게 진입점 제공.
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      // 모달 닫힐 때 트리거 요소로 포커스 복원.
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape key is handled by a window-level listener (see effect above); backdrop click is mouse-only
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="modal"
      className="fixed inset-0 z-[70] bg-scrim flex items-start justify-center pt-12 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`bg-panel border border-line rounded-lg shadow-2xl w-full ${SIZE_CLASS[size]} max-h-[80vh] overflow-y-auto focus:outline-none`}
      >
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <div id={titleId} className="font-semibold">
            {title}
          </div>
          <button
            type="button"
            className="text-ink-subtle hover:text-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
