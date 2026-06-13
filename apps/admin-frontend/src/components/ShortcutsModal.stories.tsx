import { useEffect } from 'react'

import { useStore } from '../lib/store'

import { ShortcutsModal } from './ShortcutsModal'

import type { Meta, StoryObj } from '@storybook/react'

function SeedOpen({ open }: { open: boolean }) {
  useEffect(() => {
    useStore.setState({ shortcutsOpen: open })
    return () => {
      useStore.setState({ shortcutsOpen: false })
    }
  }, [open])
  return null
}

const meta = {
  title: 'Components/ShortcutsModal',
  component: ShortcutsModal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Static keyboard-shortcut help dialog. Opened with `?` from anywhere in the admin UI; reads its open state from the Zustand store.',
      },
    },
  },
} satisfies Meta<typeof ShortcutsModal>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  render: () => (
    <>
      <SeedOpen open />
      <ShortcutsModal />
    </>
  ),
}

export const Closed: Story = {
  render: () => (
    <div className="p-8 text-sm text-ink-subtle">
      <SeedOpen open={false} />
      Modal renders nothing when `shortcutsOpen` is false.
      <ShortcutsModal />
    </div>
  ),
}
