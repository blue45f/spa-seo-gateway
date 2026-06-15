import { useState } from 'react'

import { useDialog } from '../lib/dialog'

import { DialogHost } from './DialogHost'

import type { Meta, StoryObj } from '@storybook/react'

const meta = {
  title: 'Components/DialogHost',
  component: DialogHost,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'In-app replacement for globalThis.confirm/globalThis.prompt, built on the native <dialog> + showModal(). ' +
          'Promise-based via useDialog(); Escape / backdrop click cancel, focus trap and focus restore are platform-provided.',
      },
    },
  },
} satisfies Meta<typeof DialogHost>

export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const { confirm, prompt } = useDialog()
  const [last, setLast] = useState('—')
  return (
    <div className="p-8 space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary px-3 py-2 text-sm"
          onClick={async () => {
            const ok = await confirm({
              title: 'Clear all caches?',
              description: 'Subsequent requests will start cold.',
              confirmLabel: 'Clear all',
            })
            setLast(`confirm → ${ok}`)
          }}
        >
          confirm
        </button>
        <button
          type="button"
          className="btn-danger px-3 py-2 text-sm"
          onClick={async () => {
            const ok = await confirm({
              title: 'Delete this site?',
              description: 'The action is permanent and clears its cache namespace.',
              confirmLabel: 'Delete',
              danger: true,
            })
            setLast(`danger confirm → ${ok}`)
          }}
        >
          danger confirm
        </button>
        <button
          type="button"
          className="btn-ghost px-3 py-2 text-sm"
          onClick={async () => {
            const url = await prompt({
              title: 'Invalidate URL',
              description: 'URL to invalidate',
              placeholder: 'https://www.example.com/posts/1',
              validate: (v) => (v.trim() ? null : 'Please enter a value.'),
            })
            setLast(`prompt → ${url === null ? 'null' : JSON.stringify(url)}`)
          }}
        >
          prompt
        </button>
      </div>
      <p className="text-sm text-ink-muted">
        last result: <span className="font-mono">{last}</span>
      </p>
      <DialogHost />
    </div>
  )
}

export const Interactive: Story = {
  render: () => <Demo />,
}
