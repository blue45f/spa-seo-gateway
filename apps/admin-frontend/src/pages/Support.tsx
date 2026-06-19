import { CheckCircle2, Inbox, MessageSquarePlus, RotateCcw, Send } from 'lucide-react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'

import { EmptyState } from '../components/EmptyState'
import {
  INQUIRY_CATEGORIES,
  INQUIRY_CATEGORY_HINTS,
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  type Inquiry,
  type InquiryCategory,
  type InquiryStatus,
  listInquiries,
  submitInquiry,
} from '../lib/inquiryApi'

const TITLE_MAX = 120
const BODY_MAX = 4000
const NAME_MAX = 80

/** 진행도에 따라 상태 뱃지를 앱 .badge 토큰에 매핑한다. */
const statusBadgeClass: Record<InquiryStatus, string> = {
  new: 'badge--ok',
  in_progress: 'badge--warn',
  resolved: 'badge--neutral',
  closed: 'badge--neutral',
}

function StatusBadge({ status }: { status: InquiryStatus }) {
  const label = INQUIRY_STATUS_LABELS[status] ?? status
  return <span className={`badge ${statusBadgeClass[status] ?? 'badge--neutral'}`}>{label}</span>
}

/** ISO 날짜를 간단한 상대 표기로. 1주 이상은 YYYY.MM.DD 절대 표기로 폴백. */
function shortRelativeDate(iso: string): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const diffMs = Date.now() - then.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return then.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function InquiryCard({ inquiry }: { inquiry: Inquiry }) {
  return (
    <article className="panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge badge--neutral">
          {INQUIRY_CATEGORY_LABELS[inquiry.category] ?? inquiry.category}
        </span>
        <StatusBadge status={inquiry.status} />
        <span className="ml-auto text-xs text-ink-subtle">
          {shortRelativeDate(inquiry.createdAt)}
        </span>
      </div>
      <h3 className="mt-2.5 text-sm font-semibold text-ink">{inquiry.title}</h3>
      <p className="mt-1 line-clamp-3 text-sm leading-6 text-ink-muted">{inquiry.body}</p>
      <p className="mt-2.5 text-xs text-ink-subtle">{inquiry.authorName?.trim() || '익명'}</p>
    </article>
  )
}

type BoardState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; items: Inquiry[] }

function InquiryBoard() {
  const [state, setState] = useState<BoardState>({ phase: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  // 목록 조회. set-state-in-effect를 피하기 위해 상태 변경은 모두 비동기 콜백에서만 한다.
  useEffect(() => {
    const controller = new AbortController()
    listInquiries(20, 0)
      .then((list) => {
        if (controller.signal.aborted) return
        setState({ phase: 'ready', items: list.items })
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setState({
          phase: 'error',
          message: cause instanceof Error ? cause.message : '문의 목록을 불러오지 못했습니다.',
        })
      })
    return () => controller.abort()
  }, [reloadKey])

  const loading = state.phase === 'loading'
  const reload = () => {
    setState({ phase: 'loading' })
    setReloadKey((value) => value + 1)
  }

  return (
    <section className="space-y-4" aria-labelledby="support-board-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="support-board-heading" className="text-lg font-semibold tracking-tight text-ink">
          최근 문의
        </h2>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          새로고침
        </button>
      </div>

      <div aria-live="polite" aria-busy={loading}>
        {state.phase === 'loading' ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((key) => (
              <li key={key} className="panel skeleton-pulse h-32" />
            ))}
          </ul>
        ) : state.phase === 'error' ? (
          <div className="alert alert--err space-y-3">
            <p className="font-medium">{state.message}</p>
            <button
              type="button"
              onClick={reload}
              className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              다시 시도
            </button>
          </div>
        ) : state.items.length === 0 ? (
          <div className="panel">
            <EmptyState
              title="아직 등록된 문의가 없습니다"
              hint="첫 문의를 남겨 주세요. 등록된 문의는 이 게시판에 공개로 표시됩니다."
            />
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {state.items.map((inquiry) => (
              <li key={inquiry.id}>
                <InquiryCard inquiry={inquiry} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export function Support() {
  const fieldId = useId()
  const [category, setCategory] = useState<InquiryCategory>('usage')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [website, setWebsite] = useState('') // 허니팟 — 사람은 채우지 않는다.
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  // 새 문의를 등록하면 게시판을 다시 불러오기 위한 키.
  const [boardKey, setBoardKey] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // 라우트 진입 시 페이지 제목으로 포커스를 옮긴다(스크린리더 컨텍스트 + 키보드 시작점).
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const validate = (): string | null => {
    if (!title.trim()) return '제목을 입력해 주세요.'
    if (title.trim().length > TITLE_MAX) return `제목은 ${TITLE_MAX}자 이하로 입력해 주세요.`
    if (!body.trim()) return '내용을 입력해 주세요.'
    if (body.trim().length > BODY_MAX) return `내용은 ${BODY_MAX}자 이하로 입력해 주세요.`
    if (authorName.trim().length > NAME_MAX) return `이름은 ${NAME_MAX}자 이하로 입력해 주세요.`
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      return '올바른 이메일 형식을 입력해 주세요.'
    }
    return null
  }

  const resetForm = () => {
    setTitle('')
    setBody('')
    setAuthorName('')
    setContactEmail('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitted(false)

    // 허니팟이 채워졌으면 봇으로 간주하고 조용히 성공 처리한다(서버 호출 없이).
    if (website.trim()) {
      setSubmitted(true)
      resetForm()
      return
    }

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      await submitInquiry({
        category,
        title: title.trim(),
        body: body.trim(),
        authorName: authorName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
      })
      setSubmitted(true)
      resetForm()
      setBoardKey((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '문의 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-6" data-testid="page-support">
      <div className="bg-accent-soft border border-line rounded-xl p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">문의 · /support</p>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-1 text-xl font-semibold tracking-tight text-ink focus:outline-none"
        >
          무엇을 도와드릴까요?
        </h2>
        <p className="mt-2 max-w-2xl text-ink-muted">
          제휴·버그·의견·이용 문의를 남겨 주세요. 접수된 문의는 아래 게시판에 공개로 표시되며,
          운영자가 확인 후 상태를 업데이트합니다. 전화·이메일 대신 이 게시판으로 문의를
          통합했습니다.
        </p>
      </div>

      {submitted ? (
        <div role="status" className="panel flex items-start gap-3 p-5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">문의가 접수되었습니다.</p>
            <p className="mt-1 text-sm leading-6 text-ink-muted">
              아래 게시판에서 등록된 문의를 확인할 수 있습니다. 운영자가 확인 후 상태를
              업데이트합니다.
            </p>
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="btn-ghost mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
              문의 더 남기기
            </button>
          </div>
        </div>
      ) : (
        <form className="panel space-y-5 p-5" onSubmit={handleSubmit} noValidate>
          <div>
            <h3 className="text-sm font-semibold text-ink">문의 남기기</h3>
            <p className="mt-1 text-xs text-ink-subtle">
              카테고리를 고르고 제목과 내용을 작성하세요. 이름·이메일은 선택 사항입니다.
            </p>
          </div>

          <fieldset>
            <legend className="text-xs font-medium text-ink-muted">카테고리</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {INQUIRY_CATEGORIES.map((value) => {
                const selected = value === category
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    title={INQUIRY_CATEGORY_HINTS[value]}
                    onClick={() => setCategory(value)}
                    className={
                      selected
                        ? 'btn-primary px-3 py-1.5 text-xs font-medium'
                        : 'btn-ghost px-3 py-1.5 text-xs font-medium'
                    }
                  >
                    {INQUIRY_CATEGORY_LABELS[value]}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-ink-subtle">{INQUIRY_CATEGORY_HINTS[category]}</p>
          </fieldset>

          <label htmlFor={`${fieldId}-title`} className="block">
            <span className="flex items-center justify-between text-xs font-medium text-ink-muted">
              제목
              <span className="text-ink-subtle">
                {title.length}/{TITLE_MAX}
              </span>
            </span>
            <input
              id={`${fieldId}-title`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={TITLE_MAX}
              required
              placeholder="문의 제목을 한 줄로 적어 주세요"
              className="input mt-1.5 h-10 w-full px-3 text-sm"
            />
          </label>

          <label htmlFor={`${fieldId}-body`} className="block">
            <span className="flex items-center justify-between text-xs font-medium text-ink-muted">
              내용
              <span className="text-ink-subtle">
                {body.length}/{BODY_MAX}
              </span>
            </span>
            <textarea
              id={`${fieldId}-body`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={BODY_MAX}
              required
              rows={6}
              placeholder="문의 내용을 자세히 적어 주세요. 버그 신고라면 재현 방법과 환경을 함께 알려 주시면 빠르게 확인할 수 있습니다."
              className="input mt-1.5 w-full resize-y px-3 py-2.5 text-sm leading-6"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor={`${fieldId}-name`} className="block">
              <span className="text-xs font-medium text-ink-muted">
                이름 <span className="text-ink-subtle">(선택)</span>
              </span>
              <input
                id={`${fieldId}-name`}
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                maxLength={NAME_MAX}
                autoComplete="name"
                placeholder="게시판에 표시될 이름"
                className="input mt-1.5 h-10 w-full px-3 text-sm"
              />
            </label>
            <label htmlFor={`${fieldId}-email`} className="block">
              <span className="text-xs font-medium text-ink-muted">
                이메일 <span className="text-ink-subtle">(선택)</span>
              </span>
              <input
                id={`${fieldId}-email`}
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                autoComplete="email"
                placeholder="답변 받을 이메일 (비공개)"
                className="input mt-1.5 h-10 w-full px-3 text-sm"
              />
            </label>
          </div>

          {/* 허니팟: 스크린리더·일반 사용자에게 숨김. 봇이 채우면 무음 처리. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor={`${fieldId}-website`}>웹사이트(입력하지 마세요)</label>
            <input
              id={`${fieldId}-website`}
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          {/* 검증/제출 에러는 aria-live로 announce. */}
          <p role="alert" aria-live="assertive" className="min-h-0">
            {error ? (
              <span className="alert alert--err block text-xs font-medium">{error}</span>
            ) : null}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary inline-flex h-10 items-center justify-center gap-1.5 px-4 text-sm font-medium"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {submitting ? '접수 중…' : '문의 접수'}
            </button>
            <span className="text-xs text-ink-subtle">이메일은 비공개로 운영자만 확인합니다.</span>
          </div>
        </form>
      )}

      <div className="flex items-center gap-2 border-t border-line pt-3 text-xs font-medium text-ink-subtle">
        <Inbox className="h-3.5 w-3.5" aria-hidden="true" />
        공개 게시판
      </div>
      <InquiryBoard key={boardKey} />
    </section>
  )
}
