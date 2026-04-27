import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RenderTest } from '../../pages/RenderTest';
import { useStore } from '../../lib/store';
import { renderWithRouter, resetStore } from '../test-utils';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetStore();
  useStore.setState({ authed: true, adminEnabled: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('RenderTest page', () => {
  it('shows bot UA quick-fill buttons', () => {
    renderWithRouter(<RenderTest />);
    expect(screen.getByText(/Googlebot \(데스크톱\)/)).toBeInTheDocument();
    expect(screen.getByText(/Bingbot/)).toBeInTheDocument();
  });

  it('clicking a UA fills the input', async () => {
    const user = userEvent.setup();
    renderWithRouter(<RenderTest />);
    await user.click(screen.getByText('Bingbot'));
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const filled = inputs.find((i) => i.value.includes('bingbot'));
    expect(filled).toBeDefined();
  });

  it('runs render and shows status + duration + bytes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          status: 200,
          durationMs: 543,
          bytes: 2048,
          headers: { 'x-cache': 'MISS', 'x-prerendered': 'true' },
          bodyPreview: '<html><body>hello</body></html>',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const user = userEvent.setup();
    renderWithRouter(<RenderTest />);
    await user.type(screen.getByPlaceholderText(/blog\/post/), 'https://x.com/y');
    await user.click(screen.getByText('렌더 실행'));

    await waitFor(() => expect(screen.getByText('200')).toBeInTheDocument());
    expect(screen.getByText('543ms')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByText('MISS')).toBeInTheDocument();
  });
});
