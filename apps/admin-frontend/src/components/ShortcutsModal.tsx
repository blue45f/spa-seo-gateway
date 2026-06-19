import * as Dialog from '@radix-ui/react-dialog'
import { useId } from 'react'

import { useStore } from '../lib/store'

export function ShortcutsModal() {
  const open = useStore((s) => s.shortcutsOpen)
  const close = useStore((s) => s.closeShortcuts)
  const t = useStore((s) => s.t)
  const titleId = useId()

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) close()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-scrim flex items-center justify-center" />
        <Dialog.Content
          data-testid="shortcuts-modal"
          aria-labelledby={titleId}
          className="fixed left-1/2 top-1/2 z-[80] -translate-x-1/2 -translate-y-1/2 bg-panel border border-line rounded-lg shadow-2xl p-6 max-w-md focus-visible:outline-none"
        >
          <Dialog.Title id={titleId} className="font-semibold text-lg mb-3">
            {t('shortcuts.title')}
          </Dialog.Title>
          <table className="w-full text-sm">
            {/* header row gives the key/action table a programmatic structure (WCAG 1.3.1 /
                Sonar S5256); kept visually quiet with subtle ink-subtle labels. */}
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium text-ink-subtle">
                <th scope="col" className="pb-2 font-medium">
                  {t('shortcuts.col.key')}
                </th>
                <th scope="col" className="pb-2 font-medium">
                  {t('shortcuts.col.action')}
                </th>
              </tr>
            </thead>
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
                  <kbd className="px-2 py-0.5 bg-panel-2 border border-line rounded text-xs">
                    Esc
                  </kbd>
                </td>
                <td>Close modal</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 text-right">
            <Dialog.Close asChild>
              <button type="button" className="btn-primary px-3 py-1.5 text-sm">
                {t('btn.close')}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
