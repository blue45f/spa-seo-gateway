import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ShortcutsModal } from '../../components/ShortcutsModal';
import { useStore } from '../../lib/store';
import { resetStore } from '../test-utils';

beforeEach(() => {
  resetStore();
});

describe('ShortcutsModal', () => {
  it('renders nothing when closed', () => {
    render(<ShortcutsModal />);
    expect(screen.queryByTestId('shortcuts-modal')).not.toBeInTheDocument();
  });

  it('shows the shortcuts when open and closes via the button', () => {
    useStore.setState({ shortcutsOpen: true });
    render(<ShortcutsModal />);
    expect(screen.getByTestId('shortcuts-modal')).toBeInTheDocument();
    expect(screen.getByText('Command palette')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(useStore.getState().shortcutsOpen).toBe(false);
  });
});
