import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CommandPalette } from '../../components/CommandPalette';
import { useStore } from '../../lib/store';
import { renderWithRouter, resetStore } from '../test-utils';

beforeEach(() => {
  resetStore();
});

describe('CommandPalette', () => {
  it('does not render when closed', () => {
    renderWithRouter(<CommandPalette />);
    expect(screen.queryByTestId('cmd-palette')).not.toBeInTheDocument();
  });

  it('renders all nav items when open', () => {
    useStore.setState({ cmdPaletteOpen: true });
    renderWithRouter(<CommandPalette />);
    expect(screen.getByTestId('cmd-palette')).toBeInTheDocument();
    expect(screen.getByText('소개')).toBeInTheDocument();
    expect(screen.getByText('AI Schema')).toBeInTheDocument();
  });

  it('filters by query', () => {
    useStore.setState({ cmdPaletteOpen: true });
    renderWithRouter(<CommandPalette />);
    const input = screen.getByPlaceholderText(/탭 검색/i);
    fireEvent.change(input, { target: { value: '시각' } });
    expect(screen.getByText('시각 회귀')).toBeInTheDocument();
    expect(screen.queryByText('소개')).not.toBeInTheDocument();
  });

  it('shows empty message when no match', () => {
    useStore.setState({ cmdPaletteOpen: true });
    renderWithRouter(<CommandPalette />);
    const input = screen.getByPlaceholderText(/탭 검색/i);
    fireEvent.change(input, { target: { value: 'definitely-no-match-xyz' } });
    expect(screen.getByText(/일치하는 탭이 없습니다/)).toBeInTheDocument();
  });

  it('navigates and closes on item click', () => {
    useStore.setState({ cmdPaletteOpen: true });
    renderWithRouter(<CommandPalette />);
    fireEvent.click(screen.getByText('대시보드'));
    expect(useStore.getState().cmdPaletteOpen).toBe(false);
  });
});
