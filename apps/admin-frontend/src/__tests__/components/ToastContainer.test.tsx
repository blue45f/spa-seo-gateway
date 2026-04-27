import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ToastContainer } from '../../components/ToastContainer';
import { useStore } from '../../lib/store';
import { renderWithRouter, resetStore } from '../test-utils';

beforeEach(() => {
  resetStore();
});

describe('ToastContainer', () => {
  it('renders nothing when no toasts', () => {
    renderWithRouter(<ToastContainer />);
    const container = screen.getByTestId('toast-container');
    expect(container.children).toHaveLength(0);
  });

  it('renders pushed toasts', () => {
    useStore.setState({
      toasts: [
        { id: 1, message: '첫 알림', kind: 'success', icon: '✓' },
        { id: 2, message: '에러 알림', kind: 'error', icon: '✗' },
      ],
    });
    renderWithRouter(<ToastContainer />);
    expect(screen.getByText('첫 알림')).toBeInTheDocument();
    expect(screen.getByText('에러 알림')).toBeInTheDocument();
  });

  it('removes a toast on dismiss click', () => {
    useStore.setState({
      toasts: [{ id: 1, message: '제거 대상', kind: 'info', icon: 'ℹ️' }],
    });
    renderWithRouter(<ToastContainer />);
    fireEvent.click(screen.getByLabelText('dismiss'));
    expect(useStore.getState().toasts).toHaveLength(0);
  });
});
