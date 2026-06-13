import { useEffect } from 'react'

import { useStore } from '../lib/store'

import { ToastContainer } from './ToastContainer'

import type { Meta, StoryObj } from '@storybook/react'

/**
 * Helper — replaces the live toast list with a fixed set so the story is deterministic.
 */
function SeedToasts({
  items,
}: {
  items: Array<{ kind: 'success' | 'error' | 'warn' | 'info'; message: string }>
}) {
  useEffect(() => {
    // ToastContainer derives the icon from `kind` (lucide CircleCheck/CircleX/…),
    // so seeded toasts only need id/kind/message.
    useStore.setState({
      toasts: items.map((it, idx) => ({
        id: idx + 1,
        kind: it.kind,
        message: it.message,
      })),
    })
    return () => {
      useStore.setState({ toasts: [] })
    }
  }, [items])
  return null
}

const meta = {
  title: 'Components/ToastContainer',
  component: ToastContainer,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Fixed-position toast stack. Each toast is colored by `kind` (success/error/warn/info) and is dismissed via the × button.',
      },
    },
  },
} satisfies Meta<typeof ToastContainer>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  render: () => (
    <div className="min-h-screen relative p-6 text-sm text-ink-subtle">
      <SeedToasts items={[]} />
      No toasts visible — store is empty.
      <ToastContainer />
    </div>
  ),
}

export const SingleSuccess: Story = {
  render: () => (
    <div className="min-h-screen relative">
      <SeedToasts items={[{ kind: 'success', message: 'Saved routes (3 changed)' }]} />
      <ToastContainer />
    </div>
  ),
}

export const AllKinds: Story = {
  render: () => (
    <div className="min-h-screen relative">
      <SeedToasts
        items={[
          { kind: 'success', message: 'Saved routes' },
          { kind: 'info', message: 'Cache warming queued' },
          { kind: 'warn', message: 'Slow render: 4.2s' },
          { kind: 'error', message: 'Render failed: timeout' },
        ]}
      />
      <ToastContainer />
    </div>
  ),
}
