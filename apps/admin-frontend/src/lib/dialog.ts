/**
 * globalThis.confirm / globalThis.prompt 대체 — Promise 기반 인앱 다이얼로그 요청 채널.
 * 이 앱의 오버레이 컨벤션(CommandPalette/Toast = zustand 스토어 + App 레벨 호스트)을 따라
 * Context Provider 대신 전용 스토어 + <DialogHost /> 조합으로 동작한다.
 */
import { create } from 'zustand'

export type ConfirmDialogOptions = {
  title: string
  description?: string
  /** 확인 버튼 라벨 — 기본 t('dialog.ok') */
  confirmLabel?: string
  /** 취소 버튼 라벨 — 기본 t('btn.cancel') */
  cancelLabel?: string
  /** 삭제류 파괴적 액션 — 확인 버튼을 btn-danger 로 */
  danger?: boolean
}

export type PromptDialogOptions = {
  title: string
  description?: string
  defaultValue?: string
  placeholder?: string
  /** 에러 메시지(string) 반환 시 닫지 않고 인라인 표시. null/undefined 면 통과. */
  validate?(value: string): string | null | undefined
  confirmLabel?: string
  cancelLabel?: string
}

export type DialogRequest =
  | { id: number; kind: 'confirm'; options: ConfirmDialogOptions; resolve(result: boolean): void }
  | {
      id: number
      kind: 'prompt'
      options: PromptDialogOptions
      resolve(result: string | null): void
    }

type DialogState = { request: DialogRequest | null }

export const useDialogStore = create<DialogState>(() => ({ request: null }))

let seq = 0

function resolveAsCancelled(req: DialogRequest) {
  if (req.kind === 'confirm') req.resolve(false)
  else req.resolve(null)
}

/** 한 번에 다이얼로그 1개 — 새 요청이 오면 이전 요청은 취소로 정리 (모달이라 UI 상 발생 불가). */
function enqueue(request: DialogRequest) {
  const prev = useDialogStore.getState().request
  if (prev) resolveAsCancelled(prev)
  useDialogStore.setState({ request })
}

/** globalThis.confirm 대체 — 확인이면 true, 취소/ESC/백드롭이면 false. */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    enqueue({ id: ++seq, kind: 'confirm', options, resolve })
  })
}

/** globalThis.prompt 대체 — 확인이면 입력값(string), 취소/ESC/백드롭이면 null. */
export function promptDialog(options: PromptDialogOptions): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    enqueue({ id: ++seq, kind: 'prompt', options, resolve })
  })
}

/** DialogHost 전용 — 현재 요청을 결과로 resolve 하고 닫는다. */
export function settleDialog(result: boolean | string | null) {
  const req = useDialogStore.getState().request
  if (!req) return
  if (req.kind === 'confirm') req.resolve(result === true)
  else req.resolve(typeof result === 'string' ? result : null)
  useDialogStore.setState({ request: null })
}

/** 페이지에서 confirm/prompt 를 호출하는 훅 — App 에 <DialogHost /> 가 마운트되어 있어야 표시된다. */
export function useDialog() {
  return { confirm: confirmDialog, prompt: promptDialog } as const
}
