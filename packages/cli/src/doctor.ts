import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import * as p from '@clack/prompts';
import pc from 'picocolors';

type Check = { label: string; ok: boolean; detail?: string; fix?: string };

async function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

function commandExists(cmd: string): { ok: boolean; version?: string } {
  try {
    const v = execSync(`${cmd} --version`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return { ok: true, version: v };
  } catch {
    return { ok: false };
  }
}

export async function runDoctor(): Promise<void> {
  console.clear();
  p.intro(pc.bgCyan(pc.black(' spa-seo-gateway · doctor ')));

  const s = p.spinner();
  s.start('환경 점검 중...');

  const checks: Check[] = [];

  // Node 버전
  const major = Number(process.versions.node.split('.')[0]);
  checks.push({
    label: 'Node.js',
    ok: major >= 20,
    detail: `v${process.versions.node}`,
    fix: major < 20 ? '20+ 설치 (24 LTS 권장)' : undefined,
  });

  // pnpm
  const pnpm = commandExists('pnpm');
  checks.push({
    label: 'pnpm',
    ok: pnpm.ok,
    detail: pnpm.version,
    fix: pnpm.ok ? undefined : 'corepack enable && corepack prepare pnpm@9 --activate',
  });

  // chromium 후보
  const chromiumPaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    process.env.PUPPETEER_EXECUTABLE_PATH,
  ].filter(Boolean) as string[];
  const chromium = chromiumPaths.find((p) => existsSync(p));
  checks.push({
    label: 'Chromium / Chrome',
    ok: !!chromium,
    detail: chromium ?? '(자동 다운로드됨 — puppeteer 가 처리)',
    fix: chromium ? undefined : 'npx puppeteer browsers install chromium 또는 시스템 Chrome 설치',
  });

  // 포트 3000
  const port3000 = await checkPort(3000);
  checks.push({
    label: 'Port 3000',
    ok: port3000,
    detail: port3000 ? '사용 가능' : '이미 사용 중',
    fix: port3000 ? undefined : 'PORT=3001 등으로 변경, 또는 점유 중인 프로세스 종료',
  });

  // 설정 파일
  const cfgFiles = ['seo-gateway.config.json', '.seo-gateway.json'];
  const found = cfgFiles.find((f) => existsSync(f));
  checks.push({
    label: '설정 파일',
    ok: !!found,
    detail: found ?? '(없음 — env 만으로도 동작)',
    fix: found ? undefined : 'spa-seo-gateway init 으로 인터랙티브 생성',
  });

  // .env
  checks.push({
    label: '.env 파일',
    ok: existsSync('.env'),
    detail: existsSync('.env') ? '있음' : '(없음 — env 변수 없이도 동작)',
  });

  // ADMIN_TOKEN
  checks.push({
    label: 'ADMIN_TOKEN',
    ok: !!process.env.ADMIN_TOKEN,
    detail: process.env.ADMIN_TOKEN ? '설정됨' : '(없음 — admin UI/API 비활성)',
    fix: process.env.ADMIN_TOKEN ? undefined : '.env 에 ADMIN_TOKEN=...',
  });

  // Audit HMAC (v1.5+) — 변조 검출 활성화 여부
  const auditSecret = process.env.AUDIT_WEBHOOK_SECRET ?? process.env.HMAC_SECRET;
  checks.push({
    label: 'Audit HMAC',
    ok: !!auditSecret,
    detail: auditSecret ? '서명 활성 — 변조 검출 가능' : '(없음 — 감사 로그는 hash chain 만)',
    fix: auditSecret ? undefined : '.env 에 AUDIT_WEBHOOK_SECRET=... 추가하면 HMAC 서명 활성',
  });

  // ANTHROPIC_API_KEY (v1.6+) — AI schema 어댑터
  checks.push({
    label: 'Anthropic API key',
    ok: !!process.env.ANTHROPIC_API_KEY,
    detail: process.env.ANTHROPIC_API_KEY
      ? '설정됨 — AI schema 어댑터 사용 가능'
      : '(없음 — AI schema 추론 비활성)',
    fix: process.env.ANTHROPIC_API_KEY
      ? undefined
      : '@heejun/spa-seo-gateway-anthropic 사용 시 .env 에 ANTHROPIC_API_KEY=sk-ant-...',
  });

  s.stop('점검 완료');

  const failed = checks.filter((c) => !c.ok).length;
  const lines = checks.map((c) => {
    const icon = c.ok ? pc.green('✓') : pc.yellow('⚠');
    const detail = c.detail ? pc.dim(`  ${c.detail}`) : '';
    const fix = c.fix ? `\n     ${pc.dim('→')} ${pc.yellow(c.fix)}` : '';
    return `${icon} ${c.label}${detail}${fix}`;
  });
  p.note(
    lines.join('\n'),
    `결과 ${failed === 0 ? pc.green('모두 정상') : pc.yellow(`${failed}건 주의`)}`,
  );

  p.outro(failed === 0 ? pc.green('🚀 시작 준비 완료') : pc.yellow('⚠️  일부 권장 항목이 미충족됨'));
}
