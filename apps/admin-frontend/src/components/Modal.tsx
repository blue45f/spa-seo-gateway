import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useId } from 'react'

import type { ReactNode } from 'react'

type ModalProps = {
  open: boolean
  onClose(): void
  title: ReactNode
  children: ReactNode
  /** 화면이 좁아도 모달 폭이 너무 좁아지지 않도록 max-w 클래스 지정 */
  size?: 'md' | 'lg' | 'xl'
}

const SIZE_CLASS: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
}

export function Modal({ open, onClose, title, children, size = 'lg' }: ModalProps) {
  const titleId = useId()

  // Radix Dialog 가 focus-trap / Escape / scroll-lock / 트리거 포커스 복원을 모두 처리.
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          data-testid="modal-backdrop"
          className="fixed inset-0 z-[70] bg-scrim flex items-start justify-center pt-12 px-4"
        />
        <Dialog.Content
          data-testid="modal"
          aria-labelledby={titleId}
          className={`fixed left-1/2 top-12 z-[70] -translate-x-1/2 bg-panel border border-line rounded-lg shadow-2xl w-full ${SIZE_CLASS[size]} max-h-[80vh] overflow-y-auto focus:outline-none`}
        >
          <div className="px-5 py-3 border-b border-line flex items-center justify-between">
            <Dialog.Title id={titleId} className="font-semibold">
              {title}
            </Dialog.Title>
            <Dialog.Close
              type="button"
              className="text-ink-subtle hover:text-ink rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
