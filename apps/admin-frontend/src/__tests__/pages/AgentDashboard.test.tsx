import { act, fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AgentDashboard } from '../../pages/AgentDashboard'
import { renderWithRouter, resetStore } from '../test-utils'

beforeEach(() => {
  resetStore()
})

describe('AgentDashboard page', () => {
  it('renders agent console, safety, and observability panels', () => {
    renderWithRouter(<AgentDashboard />)

    expect(screen.getByText('Google Antigravity Agent Console')).toBeInTheDocument()
    expect(screen.getByText('Active Run')).toBeInTheDocument()
    expect(screen.getByText('Agent Config')).toBeInTheDocument()

    fireEvent.click(screen.getByText('안전 정책'))
    expect(screen.getByText('Declarative Access Control Policies')).toBeInTheDocument()

    fireEvent.click(screen.getByText('관측 모니터'))
    expect(screen.getByText('Prompt Tokens')).toBeInTheDocument()
  })

  it('sends a message and renders the simulated agent response', async () => {
    vi.useFakeTimers()
    try {
      renderWithRouter(<AgentDashboard />)

      fireEvent.change(screen.getByPlaceholderText('에이전트에게 챗 메시지를 전송하세요...'), {
        target: { value: 'SEO 상태 점검' },
      })
      fireEvent.click(screen.getByRole('button', { name: '메시지 전송' }))

      expect(screen.getByText('SEO 상태 점검')).toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_400)
      })
      expect(screen.getByText(/요청하신 SEO 최적화 분석을 완료했습니다/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('adds an MCP server and toggles exclusive safety policies', () => {
    renderWithRouter(<AgentDashboard />)

    fireEvent.click(screen.getByText('MCP 연동'))
    fireEvent.change(screen.getByLabelText('Server Name'), {
      target: { value: 'robots-checker' },
    })
    fireEvent.change(screen.getByLabelText('Target Command / SSE Url'), {
      target: { value: 'node mcp/robots.js' },
    })
    fireEvent.click(screen.getByRole('button', { name: /register mcp server/i }))
    expect(screen.getByText('robots-checker')).toBeInTheDocument()

    fireEvent.click(screen.getByText('안전 정책'))
    const denyAll = screen.getByLabelText('Toggle deny_all()')
    const confirmRunCommand = screen.getByLabelText('Toggle confirm_run_command()')

    expect(confirmRunCommand).toHaveClass('bg-indigo-600')
    fireEvent.click(denyAll)
    expect(denyAll).toHaveClass('bg-indigo-600')
    expect(confirmRunCommand).not.toHaveClass('bg-indigo-600')
  })
})
