import { useEffect } from 'react'

import { useStore } from '../lib/store'

import { LoginForm } from './LoginForm'

import type { Meta, StoryObj } from '@storybook/react'

function SeedAuth({ authed }: { authed: boolean }) {
  useEffect(() => {
    useStore.setState({ authed })
  }, [authed])
  return null
}

const meta = {
  title: 'Components/LoginForm',
  component: LoginForm,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Header-embedded login. Posts the admin token to `/admin/api/login`. Disables the submit button while the field is empty or a request is in flight.',
      },
    },
  },
} satisfies Meta<typeof LoginForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="p-6 bg-panel">
      <SeedAuth authed={false} />
      <LoginForm />
    </div>
  ),
}

/**
 * In production the submit button is disabled until the token is non-empty.
 * This story documents that initial state: the button shows the `.btn-primary:disabled` state.
 */
export const DisabledInitially: Story = {
  render: () => (
    <div className="p-6 bg-panel">
      <SeedAuth authed={false} />
      <p className="text-xs text-ink-subtle mb-3">
        Type into the field to enable the submit button.
      </p>
      <LoginForm />
    </div>
  ),
}
