import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';

const STEPS = [
  { path: '/', titleKo: '환영합니다 👋', titleEn: 'Welcome 👋', bodyKo: '여기는 게이트웨이의 한눈에 보기. 모드/origin/uptime 을 확인합니다.', bodyEn: 'A bird\'s eye view of the gateway — mode, origin, uptime.' },
  { path: '/routes', titleKo: '라우트 오버라이드 🛣️', titleEn: 'Route overrides 🛣️', bodyKo: 'URL 패턴별로 캐시 TTL/wait/ignore 를 정합니다. 드래그로 순서 변경, ⌘S 로 저장.', bodyEn: 'Define cache TTL / wait / ignore per URL pattern. Drag to reorder, ⌘S to save.' },
  { path: '/cache', titleKo: '캐시 관리 🗄️', titleEn: 'Cache management 🗄️', bodyKo: '배포 후엔 전체 초기화, 특정 페이지만 수정했으면 URL 무효화.', bodyEn: 'Clear all after deploy, or invalidate a single URL.' },
  { path: '/warm', titleKo: '사전 워밍 🔥', titleEn: 'Pre-warming 🔥', bodyKo: 'sitemap.xml 입력 → 미리 캐시 채워서 cold path 제거.', bodyEn: 'Feed sitemap.xml → pre-fill the cache to eliminate cold paths.' },
  { path: '/test', titleKo: '렌더 테스트 🧪', titleEn: 'Render test 🧪', bodyKo: '단일 URL 즉시 렌더로 디버깅. 봇 UA 카탈로그 클릭하면 자동으로 채워짐.', bodyEn: 'Debug a single URL render immediately.' },
  { path: '/metrics', titleKo: '실시간 메트릭 📈', titleEn: 'Live metrics 📈', bodyKo: '5초마다 갱신. cache hit ratio, 에러 분류 확인.', bodyEn: 'Refreshes every 5s — cache hit ratio, error breakdown.' },
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

  // 첫 방문 시 자동 시작
  useEffect(() => {
    if (!tourSeen && tourStep === 0) {
      const timer = setTimeout(() => startTour(), 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [tourSeen, tourStep, startTour]);

  if (tourSeen || tourStep < 0 || tourStep >= STEPS.length) return null;
  const step = STEPS[tourStep];
  const title = lang === 'ko' ? step.titleKo : step.titleEn;
  const body = lang === 'ko' ? step.bodyKo : step.bodyEn;

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4"
      data-testid="tour"
    >
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          {tourStep + 1} / {STEPS.length}
        </div>
        <h3 className="font-bold text-lg mb-2">{title}</h3>
        <p className="text-sm text-slate-700 dark:text-slate-200">{body}</p>
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            onClick={endTour}
          >
            {t('tour.skip')}
          </button>
          <button
            type="button"
            className="ml-auto px-4 py-2 rounded bg-slate-900 dark:bg-indigo-600 text-white text-sm hover:bg-slate-700"
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
