import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { MobileMenu } from '../../components/MobileMenu'
import { useStore } from '../../lib/store'
import { resetStore } from '../test-utils'

beforeEach(() => {
  resetStore()
})

describe('MobileMenu', () => {
  it('renders a toggle button that controls the sidebar', () => {
    render(<MobileMenu />)
    const btn = screen.getByRole('button', { name: /menu/i })
    expect(btn).toHaveAttribute('aria-controls', 'primary-sidebar')
  })

  it('reflects and toggles the sidebar open state', () => {
    useStore.setState({ sidebarOpen: false })
    render(<MobileMenu />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(btn)
    expect(useStore.getState().sidebarOpen).toBe(true)
  })
})
