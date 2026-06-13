import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from '../../components/ErrorBoundary'

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom!')
  return <span>safe child</span>
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  // React 가 발생시키는 componentDidCatch 로그 + console.error 호출을 흡수.
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('safe child')).toBeInTheDocument()
  })

  it('catches a child error and shows fallback with the error message', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    )
    const fallback = screen.getByTestId('error-boundary')
    expect(fallback).toBeInTheDocument()
    expect(fallback).toHaveAttribute('role', 'alert')
    expect(screen.getByText(/boom!/)).toBeInTheDocument()
  })

  it('retry button clears the error so the next render can succeed', () => {
    function Toggle() {
      // 첫 번째 render 에서는 throw, 이후엔 안전.
      // useState 사용 불가 — boundary 가 그 트리 자체를 폐기하기 때문.
      // 대신 module-level flag 으로 컨트롤.
      if (flag.shouldThrow) throw new Error('still broken')
      return <span>recovered</span>
    }
    const flag = { shouldThrow: true }
    render(
      <ErrorBoundary>
        <Toggle />
      </ErrorBoundary>
    )
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    flag.shouldThrow = false
    fireEvent.click(screen.getByText(/Retry/))
    expect(screen.getByText('recovered')).toBeInTheDocument()
  })

  it('supports a custom fallback render prop', () => {
    render(
      <ErrorBoundary fallback={(err) => <p data-testid="custom-fb">caught: {err.message}</p>}>
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByTestId('custom-fb')).toHaveTextContent('caught: boom!')
  })
})
