import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiSchema } from '../../pages/AiSchema';
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

describe('AiSchema page', () => {
  it('shows setup snippets for both adapters', () => {
    renderWithRouter(<AiSchema />);
    expect(screen.getByText('Anthropic Claude')).toBeInTheDocument();
    expect(screen.getByText(/OpenAI \/ Groq \/ Ollama/)).toBeInTheDocument();
  });

  it('renders suggestions returned from adapter', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          suggestions: [
            {
              type: 'Article',
              jsonLd: { '@context': 'https://schema.org', '@type': 'Article' },
              confidence: 0.92,
              rationale: 'clearly an article',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const user = userEvent.setup();
    renderWithRouter(<AiSchema />);
    await user.type(screen.getByPlaceholderText(/blog\/post/), 'https://x/y');
    await user.click(screen.getByText('추론 실행'));
    await waitFor(() => expect(screen.getByText('Article')).toBeInTheDocument());
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('clearly an article')).toBeInTheDocument();
  });
});
