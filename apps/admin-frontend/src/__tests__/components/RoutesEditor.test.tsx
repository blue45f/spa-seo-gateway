import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { RoutesEditor } from '../../components/RoutesEditor';
import type { ScopedRoute } from '../../lib/types';
import { renderWithRouter, resetStore } from '../test-utils';

function ControlledEditor({ initial = [] as ScopedRoute[] }) {
  const [routes, setRoutes] = useState<ScopedRoute[]>(initial);
  return (
    <>
      <RoutesEditor routes={routes} onChange={setRoutes} />
      <pre data-testid="state">{JSON.stringify(routes)}</pre>
    </>
  );
}

beforeEach(() => {
  resetStore();
});

describe('RoutesEditor', () => {
  it('renders the empty state when no routes', () => {
    renderWithRouter(<ControlledEditor />);
    // Empty hint from i18n key 'routes.empty'
    expect(screen.getByTestId('routes-editor')).toBeInTheDocument();
    // i18n fallback / translated key — i18n.ts 가 매핑하지 못해도 key 그대로 나옵니다.
    // 행 자체가 없으므로 row 가 없음을 보장.
    expect(screen.queryByRole('row')).toBeNull();
  });

  it('add button appends a new empty route', () => {
    renderWithRouter(<ControlledEditor />);
    // Add 버튼 — i18n key 'btn.add' (translate가 key 를 그대로 fall-through 할 수 있음).
    const addBtn = screen.getAllByRole('button').find((b) => /add|추가/i.test(b.textContent ?? ''));
    expect(addBtn).toBeTruthy();
    fireEvent.click(addBtn!);
    const state = JSON.parse(screen.getByTestId('state').textContent || '[]');
    expect(state).toHaveLength(1);
    expect(state[0].pattern).toBe('');
  });

  it('updating pattern input updates the row', () => {
    renderWithRouter(
      <ControlledEditor initial={[{ pattern: '^/old', ignore: false }]} />,
    );
    const patternInput = screen.getByDisplayValue('^/old') as HTMLInputElement;
    fireEvent.change(patternInput, { target: { value: '^/new' } });
    const state = JSON.parse(screen.getByTestId('state').textContent || '[]');
    expect(state[0].pattern).toBe('^/new');
  });

  it('delete button removes the row', () => {
    renderWithRouter(
      <ControlledEditor
        initial={[
          { pattern: '^/a' },
          { pattern: '^/b' },
        ]}
      />,
    );
    // 첫 번째 row 의 delete 버튼 클릭. delete 라벨 i18n key 'btn.delete'.
    const deleteBtns = screen
      .getAllByRole('button')
      .filter((b) => /delete|삭제/i.test(b.textContent ?? ''));
    expect(deleteBtns.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(deleteBtns[0]!);
    const state = JSON.parse(screen.getByTestId('state').textContent || '[]');
    expect(state).toHaveLength(1);
    expect(state[0].pattern).toBe('^/b');
  });

  it('filter input narrows visible rows', () => {
    renderWithRouter(
      <ControlledEditor
        initial={[
          { pattern: '^/products/.+' },
          { pattern: '^/blog/.+' },
        ]}
      />,
    );
    expect(screen.getByDisplayValue('^/products/.+')).toBeInTheDocument();
    expect(screen.getByDisplayValue('^/blog/.+')).toBeInTheDocument();
    const filter = screen.getByPlaceholderText(/filter|패턴/i) as HTMLInputElement;
    fireEvent.change(filter, { target: { value: 'blog' } });
    expect(screen.queryByDisplayValue('^/products/.+')).toBeNull();
    expect(screen.getByDisplayValue('^/blog/.+')).toBeInTheDocument();
  });

  it('ignore checkbox toggles the row.ignore flag', () => {
    renderWithRouter(<ControlledEditor initial={[{ pattern: '^/x' }]} />);
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    const state = JSON.parse(screen.getByTestId('state').textContent || '[]');
    expect(state[0].ignore).toBe(true);
  });
});
