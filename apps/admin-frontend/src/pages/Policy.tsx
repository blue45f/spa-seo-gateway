import { useQuery } from '@tanstack/react-query'
import { createElement } from 'react'

import { Skeleton } from '../components/Skeleton'
import {
  fetchPolicyDocument,
  formatPolicyDate,
  type PolicyBlock,
  type PolicySlug,
  parsePolicyBody,
  policyPublicUrl,
} from '../lib/policy'
import { useStore } from '../lib/store'

/** 신뢰 표면에 노출하는 content hash 축약 길이(앞 12자). */
const SHORT_HASH_LENGTH = 12

const LINK_CLASS =
  'link rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

function PolicyBody({ blocks }: { blocks: PolicyBlock[] }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-ink-muted">
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          // 헤더 chrome 이 h1, 페이지 표제가 h2 — 본문 헤딩은 h3 부터 시작.
          return createElement(
            `h${Math.min(block.level + 1, 6)}`,
            { key: index, className: 'pt-2 font-semibold text-ink' },
            block.text
          )
        }
        if (block.kind === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul'
          return (
            <ListTag
              key={index}
              className={`${block.ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-5`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ListTag>
          )
        }
        if (block.kind === 'divider') {
          return <hr key={index} className="border-line" />
        }
        return (
          <p key={index} className="whitespace-pre-line">
            {block.text}
          </p>
        )
      })}
    </div>
  )
}

/** TermsDesk 정본을 그대로 렌더하는 법적 고지 페이지 — /terms · /privacy 공용. */
export function Policy({ slug }: { slug: PolicySlug }) {
  const t = useStore((s) => s.t)
  const lang = useStore((s) => s.lang)

  const {
    data: doc = null,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    // slug 별 캐시 — /terms ↔ /privacy 전환 시 서로의 문서를 보여주지 않는다.
    queryKey: ['policy', slug],
    queryFn: ({ signal }) => fetchPolicyDocument(slug, signal),
  })

  const titleKey = slug === 'privacy-policy' ? 'policy.privacy.title' : 'policy.terms.title'
  const externalUrl = policyPublicUrl(slug)
  // 종전 동작 재현: in-flight 중에는 스켈레톤(재시도 fetch 포함). 재시도 중에는 stale 에러
  // 표면을 감추고 로딩을 보여준다(종전 retry 가 doc/failed 를 리셋하고 로딩을 보인 것과 동치).
  const loading = isFetching
  const failed = isError && !isFetching

  return (
    <article className="max-w-3xl space-y-6" data-testid="page-policy">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{doc?.name ?? t(titleKey)}</h2>

      {loading ? (
        <div className="space-y-3" data-testid="policy-loading">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ) : null}

      {failed ? (
        <div role="alert" className="alert alert--err space-y-3 p-4 text-sm">
          <p>{t('policy.error')}</p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="btn-primary px-3 py-1.5 text-sm font-medium"
              onClick={() => void refetch()}
            >
              {t('policy.retry')}
            </button>
            <a href={externalUrl} target="_blank" rel="noreferrer" className={LINK_CLASS}>
              {t('policy.source')} ↗
            </a>
          </div>
        </div>
      ) : null}

      {doc ? (
        <>
          <PolicyBody blocks={parsePolicyBody(doc.body)} />

          {/* 신뢰 표면 — TermsDesk 게시 메타(버전·시행일·해시)와 원문 링크 */}
          <footer className="panel flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4 text-xs">
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              <div className="flex items-baseline gap-1.5">
                <dt className="text-ink-subtle">{t('policy.version')}</dt>
                <dd className="font-medium text-ink">{doc.versionLabel}</dd>
              </div>
              {doc.effectiveAt ? (
                <div className="flex items-baseline gap-1.5">
                  <dt className="text-ink-subtle">{t('policy.effectiveAt')}</dt>
                  <dd className="font-medium text-ink">
                    {formatPolicyDate(doc.effectiveAt, lang)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-baseline gap-1.5">
                <dt className="text-ink-subtle">{t('policy.hash')}</dt>
                <dd>
                  <code className="font-mono text-ink" title={doc.contentHash}>
                    {doc.contentHash.slice(0, SHORT_HASH_LENGTH)}
                  </code>
                </dd>
              </div>
            </dl>
            <a href={externalUrl} target="_blank" rel="noreferrer" className={LINK_CLASS}>
              {t('policy.source')} ↗
            </a>
          </footer>
        </>
      ) : null}
    </article>
  )
}
