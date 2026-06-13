import { useState } from 'react'

import { Modal } from './Modal'

import type { Meta, StoryObj } from '@storybook/react'

const meta = {
  title: 'Components/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Reusable overlay dialog. Used by Routes / Sites / Tenants pages to host detail editors. Closes on Escape or backdrop click.',
      },
    },
  },
  args: {
    open: true,
    title: 'Edit route',
    size: 'lg',
    onClose: () => {},
    children: (
      <p className="text-sm text-ink-muted">
        Modal body content goes here. Tailwind dark mode applies automatically.
      </p>
    ),
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['md', 'lg', 'xl'] },
    open: { control: 'boolean' },
  },
} satisfies Meta<typeof Modal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Medium: Story = { args: { size: 'md', title: 'Confirm delete' } }

export const ExtraLarge: Story = {
  args: {
    size: 'xl',
    title: 'Edit site',
    children: (
      <div className="space-y-3 text-sm">
        <p>Larger modals are used for the routes editor and site/tenant detail forms.</p>
        <pre className="panel-inset p-3 text-xs">
          {`{
  "pattern": "^/products/[0-9]+",
  "ttlMs": 60000,
  "waitUntil": "networkidle0"
}`}
        </pre>
      </div>
    ),
  },
}

export const Closed: Story = {
  args: { open: false },
  parameters: {
    docs: { description: { story: 'When `open` is false the modal renders nothing.' } },
  },
}

/**
 * Interactive open/close — wraps Modal in a state container so the close button
 * actually toggles visibility.
 */
export const Interactive: Story = {
  render: (args) => {
    function Wrapper() {
      const [open, setOpen] = useState(true)
      return (
        <div className="p-8">
          <button
            type="button"
            className="btn-primary px-3 py-2 text-sm"
            onClick={() => setOpen(true)}
          >
            Open modal
          </button>
          <Modal {...args} open={open} onClose={() => setOpen(false)} />
        </div>
      )
    }
    return <Wrapper />
  },
}
