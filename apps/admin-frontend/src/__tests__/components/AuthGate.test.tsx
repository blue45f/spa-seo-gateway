import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthGate } from '../../components/AuthGate';
import { useStore } from '../../lib/store';
import { renderWithRouter, resetStore } from '../test-utils';

beforeEach(() => {
  resetStore();
});

describe('AuthGate', () => {
  it('renders children when authed', () => {
    useStore.setState({ authed: true, adminEnabled: true });
    renderWithRouter(
      <AuthGate>
        <div data-testid="protected">secret</div>
      </AuthGate>,
    );
    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });

  it('shows admin-disabled banner when adminEnabled=false', () => {
    useStore.setState({ adminEnabled: false });
    renderWithRouter(
      <AuthGate>
        <div data-testid="protected">secret</div>
      </AuthGate>,
    );
    expect(screen.getByText('admin disabled')).toBeInTheDocument();
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });

  it('shows auth-required banner when not authed', () => {
    useStore.setState({ adminEnabled: true, authed: false });
    renderWithRouter(
      <AuthGate>
        <div data-testid="protected">secret</div>
      </AuthGate>,
    );
    expect(screen.getByText(/인증이 필요한 페이지/)).toBeInTheDocument();
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });
});
