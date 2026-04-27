import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Library } from '../../pages/Library';
import { renderWithRouter, resetStore } from '../test-utils';

beforeEach(() => {
  resetStore();
});

describe('Library page', () => {
  it('renders all 5 scenario blocks', () => {
    renderWithRouter(<Library />);
    expect(screen.getByText(/시나리오 1/)).toBeInTheDocument();
    expect(screen.getByText(/시나리오 2/)).toBeInTheDocument();
    expect(screen.getByText(/시나리오 3/)).toBeInTheDocument();
    expect(screen.getByText(/시나리오 4/)).toBeInTheDocument();
    expect(screen.getByText(/시나리오 5/)).toBeInTheDocument();
  });

  it('mentions install commands for new packages', () => {
    renderWithRouter(<Library />);
    const html = document.body.innerHTML;
    expect(html).toContain('@heejun/spa-seo-gateway-anthropic');
    expect(html).toContain('@heejun/spa-seo-gateway-openai');
    expect(html).toContain('@heejun/spa-seo-gateway-multi-tenant');
    expect(html).toContain('@heejun/spa-seo-gateway-cms');
  });
});
