import type { ReactNode } from 'react';
import { useStore } from '../lib/store';

/** 인증 필요 페이지에서 미인증 시 안내 + 로그인 입력 박스(헤더에 이미 있음) 활성을 안내. */
export function AuthGate({ children }: { children: ReactNode }) {
  const authed = useStore((s) => s.authed);
  const adminEnabled = useStore((s) => s.adminEnabled);
  const t = useStore((s) => s.t);

  if (!adminEnabled) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950 dark:border-amber-900 border border-amber-200 rounded p-4 text-sm">
        <strong>admin disabled</strong> — 환경변수 <code>ADMIN_TOKEN</code> 을 설정하고 게이트웨이를 재시작하세요.
      </div>
    );
  }
  if (!authed) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950 dark:border-amber-900 border border-amber-200 rounded p-4 text-sm">
        {t('auth.required')}
      </div>
    );
  }
  return <>{children}</>;
}
