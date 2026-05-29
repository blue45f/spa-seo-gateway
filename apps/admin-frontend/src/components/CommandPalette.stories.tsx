import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useStore } from '../lib/store';
import { CommandPalette } from './CommandPalette';

function SeedOpen({ open }: { open: boolean }) {
  useEffect(() => {
    useStore.setState({ cmdPaletteOpen: open });
    return () => {
      useStore.setState({ cmdPaletteOpen: false });
    };
  }, [open]);
  return null;
}

const meta = {
  title: 'Components/CommandPalette',
  component: CommandPalette,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Cmd+K nav launcher. Filters the global nav items by label/id/subtitle and navigates on selection. Requires React Router context.',
      },
    },
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  render: () => (
    <>
      <SeedOpen open />
      <CommandPalette />
    </>
  ),
};

export const Closed: Story = {
  render: () => (
    <div className="p-8 text-sm text-ink-subtle">
      <SeedOpen open={false} />
      Palette renders nothing when `cmdPaletteOpen` is false.
      <CommandPalette />
    </div>
  ),
};
