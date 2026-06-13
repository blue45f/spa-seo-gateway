import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Modal } from '../../components/Modal'

function Harness({ initialOpen = true }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
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
  )
}

beforeEach(() => {
  document.body.style.overflow = ''
})

afterEach(() => {
  document.body.style.overflow = ''
})

describe('Modal', () => {
  it('does not render when closed', () => {
    render(
      <Modal open={false} onClose={() => undefined} title="x">
        child
      </Modal>
    )
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })

  it('renders with role=dialog and aria-labelledby tied to the title (on the Content)', () => {
    render(<Harness />)
    const dialog = screen.getByTestId('modal')
    expect(dialog).toHaveAttribute('role', 'dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    const titleEl = document.getElementById(labelledBy!)
    expect(titleEl?.textContent).toBe('Edit thing')
  })

  it('renders the backdrop overlay alongside the dialog content', () => {
    render(<Harness />)
    // Radix Portal mounts an Overlay sibling of the Content; backdrop classes/testid live there.
    expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument()
    expect(screen.getByTestId('modal')).toBeInTheDocument()
  })

  it('locks body scroll while open and restores on close (react-remove-scroll)', () => {
    // react-remove-scroll blocks page interaction by setting body pointer-events: none
    // while the modal is open, and clears it on unmount.
    const { rerender } = render(
      <Modal open onClose={() => undefined} title="x">
        y
      </Modal>
    )
    expect(document.body.style.pointerEvents).toBe('none')
    rerender(
      <Modal open={false} onClose={() => undefined} title="x">
        y
      </Modal>
    )
    expect(document.body.style.pointerEvents).not.toBe('none')
  })

  it('closes when Escape is pressed', () => {
    render(<Harness />)
    expect(screen.getByTestId('modal')).toBeInTheDocument()
    // Radix DismissableLayer listens at the document level.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })

  it('stays open when inner content is clicked', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('body content'))
    expect(screen.getByTestId('modal')).toBeInTheDocument()
  })

  it('close button is labelled and triggers onClose', () => {
    render(<Harness />)
    const closeBtn = screen.getByLabelText('Close dialog')
    fireEvent.click(closeBtn)
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })

  it('traps focus inside the dialog content on open', () => {
    render(<Harness />)
    const content = screen.getByTestId('modal')
    // Radix's focus scope moves initial focus into the Content and keeps it contained.
    expect(content.contains(document.activeElement)).toBe(true)
  })

  it('keeps focus within the content when focus is requested back to the trigger', () => {
    render(<Harness />)
    const content = screen.getByTestId('modal')
    const input = screen.getByTestId('dialog-input')
    // Focusing an element inside the content keeps focus contained there.
    input.focus()
    expect(document.activeElement).toBe(input)
    expect(content.contains(document.activeElement)).toBe(true)
  })
})
