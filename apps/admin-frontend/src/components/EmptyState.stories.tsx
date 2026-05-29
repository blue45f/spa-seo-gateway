import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './EmptyState';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Centered empty state — a quiet mark, the condition, and an optional next-step hint. Tokens only; used by Dashboard, Sites, Tenants, and the audit log.',
      },
    },
  },
  args: { title: '아직 추적된 호스트가 없습니다' },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { hint: '봇 요청이 오리진 호스트로 라우팅되면 상태가 집계됩니다.' },
};

export const TitleOnly: Story = {
  args: { hint: undefined },
};
