import { useEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'

import { useStore } from '../lib/store'

import { Sidebar } from './Sidebar'

import type { Meta, StoryObj } from '@storybook/react'

function SeedAuth({ authed }: { authed: boolean }) {
  useEffect(() => {
    useStore.setState({ authed })
  }, [authed])
  return null
}

const meta = {
  title: 'Components/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Primary navigation. The visible items depend on the gateway `publicMode` — CMS adds Sites, SaaS adds Tenants. Pulls auth/lang/theme state from the Zustand store.',
      },
    },
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <div className="flex min-h-screen">
          <Story />
          <div className="flex-1 p-6 text-sm text-ink-subtle">
            Content area (Storybook preview — Sidebar is on the left).
          </div>
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof Sidebar>

export default meta
type Story = StoryObj<typeof meta>

export const RenderOnly: Story = {
  render: () => (
    <>
      <SeedAuth authed />
      <Sidebar publicMode="render-only" />
    </>
  ),
}

export const CmsMode: Story = {
  render: () => (
    <>
      <SeedAuth authed />
      <Sidebar publicMode="cms" />
    </>
  ),
  parameters: {
    docs: { description: { story: 'CMS mode exposes the Sites tab in the nav.' } },
  },
}

export const SaasMode: Story = {
  render: () => (
    <>
      <SeedAuth authed />
      <Sidebar publicMode="saas" />
    </>
  ),
  parameters: {
    docs: { description: { story: 'SaaS mode exposes the Tenants tab in the nav.' } },
  },
}

export const Unauthenticated: Story = {
  render: () => (
    <>
      <SeedAuth authed={false} />
      <Sidebar publicMode="render-only" />
    </>
  ),
}
