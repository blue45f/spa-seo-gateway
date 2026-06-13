import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { DialogHost } from '../../components/DialogHost'
import { confirmDialog, promptDialog, useDialogStore } from '../../lib/dialog'
import { resetStore } from '../test-utils'

function getDialog(): HTMLDialogElement {
  return screen.getByTestId('app-dialog') as HTMLDialogElement
}

beforeEach(() => {
  resetStore() // lang=ko 강제 — 기본 라벨(확인/취소) 검증용
  useDialogStore.setState({ request: null })
})

describe('DialogHost', () => {
  it('renders nothing without a pending request', () => {
    render(<DialogHost />)
    expect(screen.queryByTestId('app-dialog')).not.toBeInTheDocument()
  })

  it('confirm: opens a native modal dialog with title/description and a11y wiring', async () => {
    render(<DialogHost />)
    let result: Promise<boolean> = Promise.resolve(false)
    act(() => {
      result = confirmDialog({
        title: '캐시 전체를 삭제할까요?',
        description: '되돌릴 수 없습니다.',
      })
    })
    const dialog = getDialog()
    expect(dialog.open).toBe(true) // showModal() 경유 — 포커스 트랩/ESC 는 플랫폼 제공
    expect(screen.getByText('캐시 전체를 삭제할까요?')).toBeInTheDocument()
    expect(screen.getByText('되돌릴 수 없습니다.')).toBeInTheDocument()
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(document.getElementById(labelledBy ?? '')?.textContent).toBe('캐시 전체를 삭제할까요?')
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe('되돌릴 수 없습니다.')

    fireEvent.click(screen.getByTestId('dialog-confirm'))
    await expect(result).resolves.toBe(true)
    expect(screen.queryByTestId('app-dialog')).not.toBeInTheDocument()
  })

  it('confirm: default labels come from i18n (확인/취소) and cancel resolves false', async () => {
    render(<DialogHost />)
    let result: Promise<boolean> = Promise.resolve(true)
    act(() => {
      result = confirmDialog({ title: '제목' })
    })
    expect(screen.getByText('확인')).toBeInTheDocument()
    fireEvent.click(screen.getByText('취소'))
    await expect(result).resolves.toBe(false)
    expect(screen.queryByTestId('app-dialog')).not.toBeInTheDocument()
  })

  it('confirm: danger renders the confirm button as btn-danger', () => {
    render(<DialogHost />)
    act(() => {
      void confirmDialog({ title: '삭제할까요?', confirmLabel: '삭제', danger: true })
    })
    expect(screen.getByTestId('dialog-confirm').className).toContain('btn-danger')
  })

  it('confirm: native close (ESC path) resolves false', async () => {
    render(<DialogHost />)
    let result: Promise<boolean> = Promise.resolve(true)
    act(() => {
      result = confirmDialog({ title: '제목' })
    })
    // ESC 는 네이티브 cancel → close. returnValue 없는 close() 가 같은 경로다.
    act(() => {
      getDialog().close()
    })
    await expect(result).resolves.toBe(false)
  })

  it('confirm: backdrop click cancels, inner content click does not', async () => {
    render(<DialogHost />)
    let result: Promise<boolean> = Promise.resolve(true)
    act(() => {
      result = confirmDialog({ title: '제목', description: '본문' })
    })
    // 내용 클릭 — target 이 내부 요소라 닫히지 않는다
    fireEvent.click(screen.getByText('본문'))
    expect(screen.getByTestId('app-dialog')).toBeInTheDocument()
    // <dialog> 자신이 target = ::backdrop 클릭
    fireEvent.click(getDialog())
    await expect(result).resolves.toBe(false)
  })

  it('prompt: returns the typed value on confirm', async () => {
    render(<DialogHost />)
    let result: Promise<string | null> = Promise.resolve(null)
    act(() => {
      result = promptDialog({
        title: 'URL 무효화',
        defaultValue: 'https://old.example.com',
        placeholder: 'https://...',
      })
    })
    const input = screen.getByTestId('dialog-prompt-input') as HTMLInputElement
    expect(input.value).toBe('https://old.example.com')
    expect(input.placeholder).toBe('https://...')
    // 입력 필드의 접근 가능한 이름 = 다이얼로그 제목 (aria-labelledby)
    expect(screen.getByRole('textbox', { name: 'URL 무효화' })).toBe(input)
    fireEvent.change(input, { target: { value: 'https://www.example.com/posts/1' } })
    fireEvent.click(screen.getByTestId('dialog-confirm'))
    await expect(result).resolves.toBe('https://www.example.com/posts/1')
  })

  it('prompt: cancel resolves null', async () => {
    render(<DialogHost />)
    let result: Promise<string | null> = Promise.resolve('x')
    act(() => {
      result = promptDialog({ title: 'URL 무효화' })
    })
    fireEvent.click(screen.getByText('취소'))
    await expect(result).resolves.toBeNull()
  })

  it('prompt: validate blocks submit with an inline error until the value passes', async () => {
    render(<DialogHost />)
    let result: Promise<string | null> = Promise.resolve(null)
    act(() => {
      result = promptDialog({
        title: 'URL 무효화',
        validate: (v) => (v.trim() ? null : '값을 입력해 주세요.'),
      })
    })
    fireEvent.click(screen.getByTestId('dialog-confirm'))
    // 에러는 role=alert + aria-describedby 로 입력과 연결, 다이얼로그는 열린 채 유지
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('값을 입력해 주세요.')
    const input = screen.getByTestId('dialog-prompt-input')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toBe(alert.id)
    expect(screen.getByTestId('app-dialog')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'https://ok.example.com' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument() // 입력 시 에러 해제
    fireEvent.click(screen.getByTestId('dialog-confirm'))
    await expect(result).resolves.toBe('https://ok.example.com')
  })

  it('prompt: an empty-string validate message still blocks, with the default required text', () => {
    render(<DialogHost />)
    act(() => {
      void promptDialog({ title: 'URL 무효화', validate: () => '' })
    })
    fireEvent.click(screen.getByTestId('dialog-confirm'))
    // 계약: 문자열 반환 = 실패. '' 는 기본 안내 문구로 보완된다.
    expect(screen.getByRole('alert')).toHaveTextContent('값을 입력해 주세요.')
    expect(screen.getByTestId('app-dialog')).toBeInTheDocument()
  })

  it('cancels the pending dialog when the route changes', async () => {
    function NavigateAway() {
      const navigate = useNavigate()
      return (
        <button type="button" data-testid="go-elsewhere" onClick={() => navigate('/elsewhere')}>
          이동
        </button>
      )
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <DialogHost />
        <NavigateAway />
      </MemoryRouter>
    )
    let result: Promise<boolean> = Promise.resolve(true)
    act(() => {
      result = confirmDialog({ title: '사이트를 삭제할까요?', danger: true })
    })
    expect(screen.getByTestId('app-dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('go-elsewhere'))
    // 페이지를 떠나면 떠 있던 파괴적 확인은 취소로 정리된다
    await expect(result).resolves.toBe(false)
    expect(screen.queryByTestId('app-dialog')).not.toBeInTheDocument()
  })

  it('replaces a pending request: the previous promise settles as cancelled', async () => {
    render(<DialogHost />)
    let first: Promise<boolean> = Promise.resolve(true)
    let second: Promise<boolean> = Promise.resolve(false)
    act(() => {
      first = confirmDialog({ title: '첫번째' })
    })
    act(() => {
      second = confirmDialog({ title: '두번째' })
    })
    await expect(first).resolves.toBe(false)
    expect(screen.getByText('두번째')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('dialog-confirm'))
    await expect(second).resolves.toBe(true)
  })
})
