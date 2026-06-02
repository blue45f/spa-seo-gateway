import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Modal } from '../../components/Modal';

function Harness({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        trigger
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit thing">
        <p>body content</p>
        <input type="text" data-testid="dialog-input" />
      </Modal>
    </>
  );
}

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  document.body.style.overflow = '';
});

describe('Modal', () => {
  it('does not render when closed', () => {
    render(
      <Modal open={false} onClose={() => undefined} title="x">
        child
      </Modal>,
    );
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('renders with role=dialog, aria-modal, aria-labelledby tied to the title', () => {
    render(<Harness />);
    const dialog = screen.getByTestId('modal');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const titleEl = document.getElementById(labelledBy!);
    expect(titleEl?.textContent).toBe('Edit thing');
  });

  it('locks body scroll while open and restores on close', () => {
    document.body.style.overflow = 'auto';
    const { rerender } = render(
      <Modal open onClose={() => undefined} title="x">
        y
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <Modal open={false} onClose={() => undefined} title="x">
        y
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('auto');
  });

  it('closes when Escape is pressed', () => {
    render(<Harness />);
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('closes when the backdrop is clicked but not when inner content is clicked', () => {
    render(<Harness />);
    // Click inner content — should stay open.
    fireEvent.click(screen.getByText('body content'));
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    // Click backdrop (the wrapper itself).
    fireEvent.click(screen.getByTestId('modal'));
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('close button is labelled and triggers onClose', () => {
    render(<Harness />);
    const closeBtn = screen.getByLabelText('Close dialog');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('traps Tab focus: from the last focusable it wraps to the first', () => {
    render(<Harness />);
    const closeBtn = screen.getByLabelText('Close dialog');
    const input = screen.getByTestId('dialog-input');
    // input is the last focusable; Tab should wrap to the close button (first).
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('traps Shift+Tab focus: from the first focusable it wraps to the last', () => {
    render(<Harness />);
    const closeBtn = screen.getByLabelText('Close dialog');
    const input = screen.getByTestId('dialog-input');
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);
    fireEvent.keyDown(closeBtn, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(input);
  });
});
