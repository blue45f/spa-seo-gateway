import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import type { ScopedRoute } from '../lib/types';
import { RoutesEditor } from './RoutesEditor';

const SAMPLE: ScopedRoute[] = [
  {
    pattern: '^/products/[0-9]+',
    ttlMs: 60_000,
    waitUntil: 'networkidle0',
    waitSelector: '[data-loaded]',
    waitMs: 500,
    ignore: false,
  },
  {
    pattern: '^/blog/.*',
    ttlMs: 300_000,
    waitUntil: 'domcontentloaded',
    waitMs: 200,
    ignore: false,
  },
  {
    pattern: '^/admin/.*',
    ignore: true,
  },
];

const meta = {
  title: 'Components/RoutesEditor',
  component: RoutesEditor,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Shared controlled-component editor for global / per-site / per-tenant routes. Supports drag reorder, filtering, add/remove and inline editing of every field.',
      },
    },
  },
  argTypes: {
    reorderable: { control: 'boolean' },
  },
} satisfies Meta<typeof RoutesEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Renders the editor with a local `useState` so changes round-trip during demos. */
function Stateful({
  initial,
  reorderable = true,
}: {
  initial: ScopedRoute[];
  reorderable?: boolean;
}) {
  const [routes, setRoutes] = useState(initial);
  return (
    <div className="space-y-3">
      <RoutesEditor routes={routes} onChange={setRoutes} reorderable={reorderable} />
      <details className="text-xs text-ink-subtle">
        <summary>current value (JSON)</summary>
        <pre className="mt-2 panel-inset p-2 overflow-x-auto">
          {JSON.stringify(routes, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export const Default: Story = {
  render: () => <Stateful initial={SAMPLE} />,
};

export const Empty: Story = {
  render: () => <Stateful initial={[]} />,
  parameters: {
    docs: {
      description: { story: 'Empty list — the editor shows the `routes.empty` placeholder.' },
    },
  },
};

export const ReorderDisabled: Story = {
  render: () => <Stateful initial={SAMPLE} reorderable={false} />,
  parameters: {
    docs: {
      description: { story: 'Pass `reorderable={false}` to disable drag-and-drop reordering.' },
    },
  },
};

export const SingleRow: Story = {
  render: () => (
    <Stateful
      initial={[
        {
          pattern: '^/$',
          ttlMs: 30_000,
          waitUntil: 'load',
        },
      ]}
    />
  ),
};
