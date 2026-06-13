import { NAV_ITEMS } from '../lib/nav'

import { NavIcon } from './NavIcon'

import type { Meta, StoryObj } from '@storybook/react'

const meta = {
  title: 'Components/NavIcon',
  component: NavIcon,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Maps a nav item id to a cohesive lucide line icon (keyed by id, shared by the Sidebar and command palette).',
      },
    },
  },
  args: { id: 'dashboard', className: 'h-6 w-6' },
} satisfies Meta<typeof NavIcon>

export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = {}

/** Every nav id and the icon it resolves to. */
export const AllNavIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4 text-ink">
      {NAV_ITEMS.map((n) => (
        <div key={n.id} className="flex w-16 flex-col items-center gap-1 text-center">
          <NavIcon id={n.id} className="h-6 w-6" />
          <span className="text-[10px] text-ink-subtle">{n.id}</span>
        </div>
      ))}
    </div>
  ),
}
