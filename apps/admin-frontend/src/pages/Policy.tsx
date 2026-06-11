import { createElement, useEffect, useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import {
  fetchPolicyDocument,
  formatPolicyDate,
  type PolicyBlock,
  type PolicyDocument,
  type PolicySlug,
  parsePolicyBody,
  policyPublicUrl,
} from '../lib/policy';
import { useStore } from '../lib/store';

/** 신뢰 표면에 노출하는 content hash 축약 길이(앞 12자). */
const SHORT_HASH_LENGTH = 12;

const LINK_CLASS =
  'link rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

function PolicyBody({ blocks }: { blocks: PolicyBlock[] }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-ink-muted">
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          // 헤더 chrome 이 h1, 페이지 표제가 h2 — 본문 헤딩은 h3 부터 시작.
          return createElement(
            `h${Math.min(block.level + 1, 6)}`,
            { key: index, className: 'pt-2 font-semibold text-ink' },
            block.text,
          );
        }
        if (block.kind === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag
              // biome-ignore lint/suspicious/noArrayIndexKey: 정적 문서 블록은 재정렬되지 않는다
              key={index}
              className={`${block.ordered ? 'list-decimal' : 'list-disc'} space-y-1 pl-5`}
            >
              {block.items.map((item, itemIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: 정적 문서 블록은 재정렬되지 않는다
                <li key={itemIndex}>{item}</li>
              ))}
            </ListTag>
          );
        }
        if (block.kind === 'divider') {
          // biome-ignore lint/suspicious/noArrayIndexKey: 정적 문서 블록은 재정렬되지 않는다
          return <hr key={index} className="border-line" />;
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: 정적 문서 블록은 재정렬되지 않는다
          <p key={index} className="whitespace-pre-line">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

/** TermsDesk 정본을 그대로 렌더하는 법적 고지 페이지 — /terms · /privacy 공용. */
export function Policy({ slug }: { slug: PolicySlug }) {
  const t = useStore((s) => s.t);
  const lang = useStore((s) => s.lang);
  const [doc, setDoc] = useState<PolicyDocument | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt 는 재시도(재fetch) 트리거 전용
  useEffect(() => {
    const ctrl = new AbortController();
    setDoc(null);
    setFailed(false);
    fetchPolicyDocument(slug, ctrl.signal)
      .then((d) => setDoc(d))
      .catch(() => {
        if (!ctrl.signal.aborted) setFailed(true);
      });
    return () => ctrl.abort();
  }, [slug, attempt]);

  const titleKey = slug === 'privacy-policy' ? 'policy.privacy.title' : 'policy.terms.title';
  const externalUrl = policyPublicUrl(slug);
  const loading = !doc && !failed;

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
              onClick={() => setAttempt((n) => n + 1)}
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
  );
}
