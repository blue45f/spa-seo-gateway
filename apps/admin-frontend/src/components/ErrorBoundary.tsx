import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * 페이지 단위 React 에러 바운더리.
 *
 * Admin SPA 의 모든 라우트는 Layout 의 <Outlet> 안에서 렌더됩니다 — 그 외부를 ErrorBoundary 로
 * 감싸면 한 페이지의 런타임 에러로 전체 콘솔이 white-screen 으로 죽는 사고를 막을 수 있습니다.
 *
 * - production 에서는 사용자에게 친화적인 fallback + reload 버튼.
 * - dev 에서는 stack 까지 노출.
 */
type Props = {
  children: ReactNode
  /** 선택: 커스텀 fallback. 미지정 시 기본 fallback 사용. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 콘솔에만 보고. 외부 reporter (Sentry 등) 는 의도적으로 의존성 추가 안 함.
    console.error('[admin-ui] uncaught render error', error, info.componentStack)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset)
      return (
        <div
          role="alert"
          data-testid="error-boundary"
          className="alert alert--err p-5 text-sm space-y-3"
        >
          <div>
            <strong>
              페이지를 그리는 중 오류가 발생했습니다 / Something broke while rendering this page.
            </strong>
            <p className="mt-1 font-mono text-xs break-words">{this.state.error.message}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="btn-primary px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              다시 시도 / Retry
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') globalThis.location.reload()
              }}
              className="btn-ghost px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              새로고침 / Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
