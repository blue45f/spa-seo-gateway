import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Help } from '../../pages/Help';
import { renderWithRouter, resetStore } from '../test-utils';

beforeEach(() => {
  resetStore();
});

describe('Help page', () => {
  it('renders all FAQ entries', () => {
    renderWithRouter(<Help />);
    expect(screen.getByText(/Visual diff baseline/)).toBeInTheDocument();
    expect(screen.getByText(/AI Schema 가 501 응답/)).toBeInTheDocument();
    expect(screen.getByText(/풀이 가득 차서 요청이 큐잉/)).toBeInTheDocument();
  });

  it('links to migration guide', () => {
    renderWithRouter(<Help />);
    expect(screen.getByText(/마이그레이션/)).toBeInTheDocument();
  });
});
