import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardGridSkeleton, DetailSkeleton, Skeleton } from '../../components/Skeleton';

describe('Skeleton', () => {
  it('renders a generic block with role=status', () => {
    render(<Skeleton className="h-4 w-20" />);
    const el = screen.getByTestId('skeleton');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('role', 'status');
    expect(el).toHaveAttribute('aria-label', 'loading');
    expect(el.className).toMatch(/h-4/);
    expect(el.className).toMatch(/w-20/);
  });

  it('uses the provided custom label for SR users', () => {
    render(<Skeleton label="Loading dashboard…" />);
    expect(screen.getByLabelText('Loading dashboard…')).toBeInTheDocument();
  });
});

describe('CardGridSkeleton', () => {
  it('renders the default 3 placeholder cards', () => {
    render(<CardGridSkeleton />);
    const grid = screen.getByTestId('card-grid-skeleton');
    expect(grid).toBeInTheDocument();
    // 각 카드 내부에 3 개씩 skeleton (label/value/detail).
    expect(screen.getAllByTestId('skeleton')).toHaveLength(9);
  });

  it('honors a custom count', () => {
    render(<CardGridSkeleton count={2} />);
    expect(screen.getAllByTestId('skeleton')).toHaveLength(6);
  });
});

describe('DetailSkeleton', () => {
  it('renders a title bar plus the requested field rows', () => {
    render(<DetailSkeleton rows={3} />);
    expect(screen.getByTestId('detail-skeleton')).toBeInTheDocument();
    // 1 title bar + 3 field rows
    expect(screen.getAllByTestId('skeleton')).toHaveLength(4);
  });
});
