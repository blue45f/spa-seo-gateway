import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NavIcon } from '../../components/NavIcon'

describe('NavIcon', () => {
  it('renders an aria-hidden svg for a known nav id, forwarding className', () => {
    const { container } = render(<NavIcon id="dashboard" className="h-4 w-4" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveClass('h-4')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('falls back to an icon for an unknown id', () => {
    const { container } = render(<NavIcon id="does-not-exist" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
