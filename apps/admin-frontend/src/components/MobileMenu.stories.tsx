import type { Meta, StoryObj } from '@storybook/react';
import { MobileMenu } from './MobileMenu';

const meta = {
  title: 'Components/MobileMenu',
  component: MobileMenu,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Small floating hamburger button shown only on viewports < md. Toggles the sidebar slide-in on mobile.',
      },
    },
    viewport: { defaultViewport: 'mobile1' },
  },
} satisfies Meta<typeof MobileMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="relative min-h-[200px] bg-panel-2">
      <MobileMenu />
      <div className="p-12 text-sm text-ink-muted">
        The hamburger is `fixed top-3 left-3 z-50` — visible only at viewports under `md`.
      </div>
    </div>
  ),
};
