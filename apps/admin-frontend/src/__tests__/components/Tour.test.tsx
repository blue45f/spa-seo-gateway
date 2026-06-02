import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Tour } from '../../components/Tour';
import { useStore } from '../../lib/store';
import { renderWithRouter, resetStore } from '../test-utils';

beforeEach(() => {
  resetStore();
});

describe('Tour', () => {
  it('renders nothing once the tour has been seen', () => {
    useStore.setState({ tourSeen: true, tourStep: -1 });
    renderWithRouter(<Tour />);
    expect(screen.queryByTestId('tour')).not.toBeInTheDocument();
  });

  it('shows the first step when active and ends on skip', () => {
    useStore.setState({ tourSeen: false, tourStep: 0 });
    renderWithRouter(<Tour />);
    expect(screen.getByTestId('tour')).toBeInTheDocument();
    expect(screen.getByTestId('tour')).toHaveTextContent('1 / 6');
    // first button is "skip"
    fireEvent.click(screen.getAllByRole('button')[0]!);
    expect(useStore.getState().tourSeen).toBe(true);
  });

  it('ends the tour on Escape', () => {
    useStore.setState({ tourSeen: false, tourStep: 0 });
    renderWithRouter(<Tour />);
    expect(screen.getByTestId('tour')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useStore.getState().tourSeen).toBe(true);
    expect(screen.queryByTestId('tour')).not.toBeInTheDocument();
  });
});
