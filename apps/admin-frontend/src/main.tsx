import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles.css';

/**
 * 런타임 basename 추론.
 * - 게이트웨이 임베드: URL 이 /admin/ui 로 시작 → basename '/admin/ui'
 * - 정적 데모 / 다른 호스팅: 그 외 → '/'
 */
function detectBasename(): string {
  if (typeof window === 'undefined') return '/admin/ui';
  return window.location.pathname.startsWith('/admin/ui') ? '/admin/ui' : '/';
}

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

const basename = detectBasename();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // SW 는 basename 아래에서 함께 서빙된다 — 임베드는 /admin/ui/sw.js, 데모는 /sw.js.
  // 등록 경로의 디렉토리가 곧 scope 가 되므로 두 모드 모두 자동 정합.
  navigator.serviceWorker.register(`${basename === '/' ? '' : basename}/sw.js`).catch(() => {});
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
