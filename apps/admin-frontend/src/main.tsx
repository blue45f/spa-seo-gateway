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

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={detectBasename()}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
