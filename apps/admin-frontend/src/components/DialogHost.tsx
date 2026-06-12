import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';
import { type DialogRequest, settleDialog, useDialogStore } from '../lib/dialog';
import { useStore } from '../lib/store';

/**
 * useDialog() 의 confirm/prompt 요청을 그리는 호스트 — 네이티브 <dialog> + showModal() 기반.
 * 포커스 트랩 / ESC 취소 / top-layer / 닫힘 시 트리거 포커스 복원은 플랫폼이 제공한다.
 * 요청마다 key 로 리마운트해 입력/에러 상태와 진입 트랜지션을 초기화한다.
 */
export function DialogHost() {
  const request = useDialogStore((s) => s.request);
  if (!request) return null;
  return <DialogModal key={request.id} request={request} />;
}

function DialogModal({ request }: { request: DialogRequest }) {
  const t = useStore((s) => s.t);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const errorId = useId();
  const [value, setValue] = useState(
    request.kind === 'prompt' ? (request.options.defaultValue ?? '') : '',
  );
  const [error, setError] = useState('');

  // mount 시 top-layer 진입 — showModal() 이 포커스 트랩 + inert 배경 + ESC(cancel) 를 켠다.
  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
  }, []);

  // close() 가 트리거 포커스 복원까지 끝낸 뒤 close 이벤트에서 Promise 를 settle 한다.
  function requestClose(returnValue: 'confirm' | 'cancel') {
    dialogRef.current?.close(returnValue);
  }

  function handleClose() {
    const confirmed = dialogRef.current?.returnValue === 'confirm';
    if (request.kind === 'confirm') settleDialog(confirmed);
    else settleDialog(confirmed ? value : null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (request.kind === 'prompt') {
      const message = request.options.validate?.(value);
      // 계약: 문자열 반환 = 실패. 빈 문자열도 실패로 보고 기본 안내 문구로 보완한다.
      if (typeof message === 'string') {
        setError(message || t('dialog.input.required'));
        return;
      }
    }
    requestClose('confirm');
  }

  const danger = request.kind === 'confirm' && request.options.danger;
  const { title, description, confirmLabel, cancelLabel } = request.options;
  // 라우트가 바뀌면 떠 있는 다이얼로그를 취소 — 떠난 페이지의 파괴적 액션이 이어지는 것을 막는다.
  const inRouter = useInRouterContext();

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled natively by <dialog> (cancel → close); the click handler only adds mouse-only backdrop dismiss
    <dialog
      ref={dialogRef}
      className="app-dialog m-auto w-full max-w-md rounded-lg border border-line bg-panel text-ink shadow-2xl p-0"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      data-testid="app-dialog"
      onClose={handleClose}
      onClick={(e) => {
        // padding 0 인 <dialog> 자신이 target 이면 ::backdrop 클릭 — 내용 클릭은 내부 요소가 target
        if (e.target === e.currentTarget) requestClose('cancel');
      }}
    >
      {inRouter ? <RouteChangeCanceller onRouteChange={() => requestClose('cancel')} /> : null}
      <form onSubmit={handleSubmit}>
        <div className="px-5 py-4 space-y-2">
          <h2 id={titleId} className="font-semibold text-ink">
            {title}
          </h2>
          {description ? (
            <p id={descId} className="text-sm text-ink-muted">
              {description}
            </p>
          ) : null}
          {request.kind === 'prompt' ? (
            <div className="space-y-1 pt-1">
              <input
                type="text"
                className="input w-full px-3 py-2 text-sm"
                value={value}
                placeholder={request.options.placeholder}
                aria-labelledby={titleId}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                data-testid="dialog-prompt-input"
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError('');
                }}
              />
              {error ? (
                <p id={errorId} role="alert" className="text-sm text-err">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {/* DOM 순서 취소 → 확인: showModal 의 초기 포커스가 파괴적 액션 대신 안전한 쪽에 앉는다 */}
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            className="btn-ghost px-3 py-2 text-sm"
            onClick={() => requestClose('cancel')}
          >
            {cancelLabel ?? t('btn.cancel')}
          </button>
          <button
            type="submit"
            className={`${danger ? 'btn-danger' : 'btn-primary'} px-3 py-2 text-sm font-medium`}
            data-testid="dialog-confirm"
          >
            {confirmLabel ?? t('dialog.ok')}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** 라우터 컨텍스트 안에서만 렌더 — location 이 처음 값에서 바뀌는 순간 한 번 알린다. */
function RouteChangeCanceller({ onRouteChange }: { onRouteChange: () => void }) {
  const location = useLocation();
  const initialKeyRef = useRef(location.key);
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (location.key !== initialKeyRef.current && !notifiedRef.current) {
      notifiedRef.current = true;
      onRouteChange();
    }
  });
  return null;
}
