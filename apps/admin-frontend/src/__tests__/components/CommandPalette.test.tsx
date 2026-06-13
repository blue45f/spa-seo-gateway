import { fireEvent, screen } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { CommandPalette } from '../../components/CommandPalette'
import { useStore } from '../../lib/store'
import { renderWithRouter, resetStore } from '../test-utils'

beforeEach(() => {
  resetStore()
})

/** 라우터 위치를 노출해 내비게이션 부수효과를 검증할 수 있게 하는 프로브. */
function LocationProbe() {
  return <span data-testid="loc">{useLocation().pathname}</span>
}

describe('CommandPalette', () => {
  it('does not render when closed', () => {
    renderWithRouter(<CommandPalette />)
    expect(screen.queryByTestId('cmd-palette')).not.toBeInTheDocument()
  })

  it('renders all nav items when open', () => {
    useStore.setState({ cmdPaletteOpen: true })
    renderWithRouter(<CommandPalette />)
    expect(screen.getByTestId('cmd-palette')).toBeInTheDocument()
    expect(screen.getByText('소개')).toBeInTheDocument()
    expect(screen.getByText('AI Schema')).toBeInTheDocument()
  })

  it('filters by query', () => {
    useStore.setState({ cmdPaletteOpen: true })
    renderWithRouter(<CommandPalette />)
    const input = screen.getByPlaceholderText(/탭 검색/i)
    fireEvent.change(input, { target: { value: '시각' } })
    expect(screen.getByText('시각 회귀')).toBeInTheDocument()
    expect(screen.queryByText('소개')).not.toBeInTheDocument()
  })

  it('shows empty message when no match', () => {
    useStore.setState({ cmdPaletteOpen: true })
    renderWithRouter(<CommandPalette />)
    const input = screen.getByPlaceholderText(/탭 검색/i)
    fireEvent.change(input, { target: { value: 'definitely-no-match-xyz' } })
    expect(screen.getByText(/일치하는 탭이 없습니다/)).toBeInTheDocument()
  })

  it('navigates and closes on item click', () => {
    useStore.setState({ cmdPaletteOpen: true })
    renderWithRouter(<CommandPalette />)
    fireEvent.click(screen.getByText('대시보드'))
    expect(useStore.getState().cmdPaletteOpen).toBe(false)
  })

  it('tracks the active option via ArrowDown and aria-activedescendant', () => {
    useStore.setState({ cmdPaletteOpen: true })
    renderWithRouter(<CommandPalette />)
    const input = screen.getByRole('combobox')
    const first = screen.getAllByRole('option')
    expect(first[0]).toHaveAttribute('aria-selected', 'true')
    expect(input).toHaveAttribute('aria-activedescendant', first[0]!.id)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const next = screen.getAllByRole('option')
    expect(next[0]).toHaveAttribute('aria-selected', 'false')
    expect(next[1]).toHaveAttribute('aria-selected', 'true')
    expect(input).toHaveAttribute('aria-activedescendant', next[1]!.id)
  })

  it('selects the active option on Enter (navigates + closes)', () => {
    useStore.setState({ cmdPaletteOpen: true })
    renderWithRouter(
      <>
        <CommandPalette />
        <LocationProbe />
      </>
    )
    const input = screen.getByRole('combobox')
    // index 0 = 소개('/'), ArrowDown → index 1 = 대시보드('/dashboard')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    // 닫힘뿐 아니라 실제 활성 옵션으로의 내비게이션까지 검증
    expect(screen.getByTestId('loc')).toHaveTextContent('/dashboard')
    expect(useStore.getState().cmdPaletteOpen).toBe(false)
  })

  it('Enter is a no-op when nothing matches', () => {
    useStore.setState({ cmdPaletteOpen: true })
    renderWithRouter(<CommandPalette />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'definitely-no-match-xyz' } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useStore.getState().cmdPaletteOpen).toBe(true)
  })
})
