import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Metrics } from '../../pages/Metrics';
import { useStore } from '../../lib/store';
import { mockTextFetch, renderWithRouter, resetStore } from '../test-utils';

const PROM = `# HELP gateway_cache_events_total ...
gateway_cache_events_total{event="hit"} 90
gateway_cache_events_total{event="miss"} 10
gateway_inflight_renders 2
`;

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetStore();
  useStore.setState({ authed: true, adminEnabled: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Metrics page', () => {
  it('parses /metrics text and shows cards', async () => {
    globalThis.fetch = mockTextFetch(PROM);
    renderWithRouter(<Metrics />);
    await waitFor(() => expect(screen.getByTestId('page-metrics')).toBeInTheDocument());
    expect(screen.getByText('90.0%')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
