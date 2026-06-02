import { useEffect, useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { NavIcon } from './NavIcon';

const STEPS = [
  {
    id: 'welcome',
    path: '/',
    titleKo: '환영합니다',
    titleEn: 'Welcome',
    bodyKo: '여기는 게이트웨이의 한눈에 보기. 모드/origin/uptime 을 확인합니다.',
    bodyEn: "A bird's eye view of the gateway: mode, origin, uptime.",
  },
  {
    id: 'routes',
    path: '/routes',
    titleKo: '라우트 오버라이드',
    titleEn: 'Route overrides',
    bodyKo: 'URL 패턴별로 캐시 TTL/wait/ignore 를 정합니다. 드래그로 순서 변경, ⌘S 로 저장.',
    bodyEn: 'Define cache TTL / wait / ignore per URL pattern. Drag to reorder, ⌘S to save.',
  },
  {
    id: 'cache',
    path: '/cache',
    titleKo: '캐시 관리',
    titleEn: 'Cache management',
    bodyKo: '배포 후엔 전체 초기화, 특정 페이지만 수정했으면 URL 무효화.',
    bodyEn: 'Clear all after deploy, or invalidate a single URL.',
  },
  {
    id: 'warm',
    path: '/warm',
    titleKo: '사전 워밍',
    titleEn: 'Pre-warming',
    bodyKo: 'sitemap.xml 입력 → 미리 캐시 채워서 cold path 제거.',
    bodyEn: 'Feed sitemap.xml → pre-fill the cache to eliminate cold paths.',
  },
  {
    id: 'test',
    path: '/test',
    titleKo: '렌더 테스트',
    titleEn: 'Render test',
    bodyKo: '단일 URL 즉시 렌더로 디버깅. 봇 UA 카탈로그 클릭하면 자동으로 채워짐.',
    bodyEn: 'Debug a single URL render immediately.',
  },
  {
    id: 'metrics',
    path: '/metrics',
    titleKo: '실시간 메트릭',
    titleEn: 'Live metrics',
    bodyKo: '5초마다 갱신. cache hit ratio, 에러 분류 확인.',
    bodyEn: 'Refreshes every 5s: cache hit ratio, error breakdown.',
  },
];

export function Tour() {
  const lang = useStore((s) => s.lang);
  const tourSeen = useStore((s) => s.tourSeen);
  const tourStep = useStore((s) => s.tourStep);
  const tourNext = useStore((s) => s.tourNext);
  const endTour = useStore((s) => s.endTour);
  const startTour = useStore((s) => s.startTour);
  const t = useStore((s) => s.t);
  const navigate = useNavigate();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // 첫 방문 시 자동 시작
  useEffect(() => {
    if (!tourSeen && tourStep === 0) {
      const timer = setTimeout(() => startTour(), 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [tourSeen, tourStep, startTour]);

  // 단계 전환 시 패널로 포커스 이동 (다이얼로그 접근성)
  // biome-ignore lint/correctness/useExhaustiveDependencies: refocus the dialog panel on each step change
  useEffect(() => {
    panelRef.current?.focus();
  }, [tourStep]);

  if (tourSeen || tourStep < 0 || tourStep >= STEPS.length) return null;
  const step = STEPS[tourStep];
  const title = lang === 'ko' ? step.titleKo : step.titleEn;
  const body = lang === 'ko' ? step.bodyKo : step.bodyEn;

  return (
    <div
      className="fixed inset-0 z-[90] bg-scrim-strong flex items-center justify-center p-4"
      data-testid="tour"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-panel border border-line rounded-xl shadow-2xl max-w-md w-full p-6 focus-visible:outline-none"
      >
        <div className="flex items-center gap-3 mb-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"
          >
            <NavIcon id={step.id} className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xs text-ink-subtle">
              {tourStep + 1} / {STEPS.length}
            </div>
            <h3 id={titleId} className="font-bold text-lg">
              {title}
            </h3>
          </div>
        </div>
        <p className="text-sm text-ink-muted">{body}</p>
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            className="text-sm text-ink-subtle hover:text-ink-muted rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={endTour}
          >
            {t('tour.skip')}
          </button>
          <button
            type="button"
            className="btn-primary ml-auto px-4 py-2 text-sm"
            onClick={() => {
              const next = tourStep + 1;
              if (next >= STEPS.length) {
                endTour();
                return;
              }
              tourNext();
              navigate(STEPS[next].path);
            }}
          >
            {tourStep < STEPS.length - 1 ? t('tour.next') : t('tour.start')}
          </button>
        </div>
      </div>
    </div>
  );
}
