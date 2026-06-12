import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogHost } from '../../components/DialogHost';
import { useDialogStore } from '../../lib/dialog';
import { useStore } from '../../lib/store';
import { Cache } from '../../pages/Cache';
import { mockJsonFetch, renderWithRouter, resetStore } from '../test-utils';

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetStore();
  useDialogStore.setState({ request: null });
  useStore.setState({ authed: true, adminEnabled: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Cache page', () => {
  it('renders both forms', () => {
    renderWithRouter(<Cache />);
    expect(screen.getByPlaceholderText(/example.com\/posts/)).toBeInTheDocument();
    expect(screen.getByText(/전체 초기화/)).toBeInTheDocument();
  });

  it('invalidates a single URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, key: 'cache:abc' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;
    const user = userEvent.setup();
    renderWithRouter(<Cache />);
    await user.type(screen.getByPlaceholderText(/example.com\/posts/), 'https://x.com/y');
    await user.click(screen.getByText('URL 무효화'));
    expect(fetchMock).toHaveBeenCalled();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.url).toBe('https://x.com/y');
  });

  it('surfaces an API error to the global banner and an error toast', async () => {
    // 공유 catch 계약: errorMessage -> setGlobalError + pushToast(kind:'error')
    globalThis.fetch = mockJsonFetch({ error: 'boom' }, 500);
    const user = userEvent.setup();
    renderWithRouter(<Cache />);
    await user.type(screen.getByPlaceholderText(/example.com\/posts/), 'https://x.com/y');
    await user.click(screen.getByText('URL 무효화'));
    await waitFor(() => expect(useStore.getState().globalError).toBe('boom'));
    const toasts = useStore.getState().toasts;
    expect(toasts.some((t) => t.kind === 'error' && t.message === 'boom')).toBe(true);
  });

  it('clear all opens the in-app confirm dialog; cancel sends no request', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    renderWithRouter(
      <>
        <Cache />
        <DialogHost />
      </>,
    );
    fireEvent.click(screen.getByText('전체 초기화'));
    const dialog = await screen.findByTestId('app-dialog');
    expect(screen.getByText('캐시 전체를 삭제할까요?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByText('취소'));
    await waitFor(() => expect(screen.queryByTestId('app-dialog')).not.toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clear all clears caches after dialog confirm', async () => {
    globalThis.fetch = mockJsonFetch({ ok: true, cleared: 2 });
    renderWithRouter(
      <>
        <Cache />
        <DialogHost />
      </>,
    );
    fireEvent.click(screen.getByText('전체 초기화'));
    const dialog = await screen.findByTestId('app-dialog');
    // danger 확인 버튼 라벨은 페이지 버튼과 동일한 t('btn.clear-all')
    fireEvent.click(within(dialog).getByTestId('dialog-confirm'));
    await waitFor(() =>
      expect(useStore.getState().toasts.some((t) => t.message === '캐시 전체 삭제됨')).toBe(true),
    );
  });
});
