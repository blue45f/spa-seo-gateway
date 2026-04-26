import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export async function runInit(_args: string[]): Promise<void> {
  console.clear();
  p.intro(pc.bgCyan(pc.black(' spa-seo-gateway · init ')));

  const cwd = process.cwd();
  const configPath = resolve(cwd, 'seo-gateway.config.json');
  if (existsSync(configPath)) {
    const overwrite = await p.confirm({
      message: `${pc.yellow('seo-gateway.config.json')} 가 이미 있습니다. 덮어쓸까요?`,
      initialValue: false,
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel('취소됨');
      return;
    }
  }

  const mode = await p.select({
    message: '운영 모드는?',
    options: [
      {
        value: 'render-only',
        label: 'render-only',
        hint: '단일 사이트, 가장 단순 (CDN 뒤에서 봇만 분기)',
      },
      { value: 'proxy', label: 'proxy', hint: '단일 사이트, 자체 리버스 프록시 (사람도 통과시킴)' },
      { value: 'cms', label: 'cms', hint: '한 조직이 여러 사이트 관리 (host 로 사이트 분기)' },
      { value: 'saas', label: 'saas', hint: '외부 고객 다중 테넌트 (apiKey 인증 + 빌링)' },
    ],
  });
  if (p.isCancel(mode)) {
    p.cancel('취소됨');
    process.exit(0);
  }

  let originUrl: string | symbol = '';
  if (mode === 'render-only' || mode === 'proxy') {
    originUrl = await p.text({
      message: 'SPA 의 origin URL?',
      placeholder: 'https://www.your-spa.example.com',
      validate: (v) => {
        if (!v) return '필수입니다';
        try {
          new URL(v);
        } catch {
          return '유효한 URL 이 아닙니다';
        }
        return undefined;
      },
    });
    if (p.isCancel(originUrl)) {
      p.cancel('취소됨');
      process.exit(0);
    }
  }

  const adminToken = await p.text({
    message: 'Admin 토큰 (Enter 로 자동 생성)',
    placeholder: '자동 생성됨',
    initialValue: '',
  });
  if (p.isCancel(adminToken)) {
    p.cancel('취소됨');
    process.exit(0);
  }
  const finalAdminToken = adminToken || `seogw_${randomBytes(24).toString('base64url')}`;

  const ttlChoice = await p.select({
    message: '기본 캐시 TTL 은?',
    options: [
      { value: 600_000, label: '10분', hint: '빠르게 변하는 사이트 (뉴스/홈)' },
      { value: 3_600_000, label: '1시간', hint: '중간 — 일반 마케팅 사이트' },
      { value: 21_600_000, label: '6시간', hint: '제품 카탈로그 등' },
      { value: 86_400_000, label: '24시간', hint: '기본 — 블로그/도큐먼트' },
      { value: 604_800_000, label: '7일', hint: '거의 정적' },
    ],
    initialValue: 86_400_000,
  });
  if (p.isCancel(ttlChoice)) {
    p.cancel('취소됨');
    process.exit(0);
  }

  const useRedis = await p.confirm({
    message: 'Redis 캐시를 활성화할까요? (멀티 노드 운영 시 권장)',
    initialValue: false,
  });
  if (p.isCancel(useRedis)) {
    p.cancel('취소됨');
    process.exit(0);
  }

  let redisUrl: string | symbol = '';
  if (useRedis) {
    redisUrl = await p.text({
      message: 'Redis URL',
      placeholder: 'redis://localhost:6379',
      initialValue: 'redis://localhost:6379',
    });
    if (p.isCancel(redisUrl)) {
      p.cancel('취소됨');
      process.exit(0);
    }
  }

  const blockTypes = await p.multiselect({
    message: '봇이 안 봐도 되는 리소스 (스페이스로 토글)',
    options: [
      { value: 'image', label: 'image', hint: '이미지 — 보통 차단 권장 (렌더 50% 빨라짐)' },
      { value: 'media', label: 'media', hint: '비디오/오디오' },
      { value: 'font', label: 'font', hint: '웹폰트 — 보통 차단 권장' },
      { value: 'stylesheet', label: 'stylesheet', hint: 'CSS — 차단 시 layout 깨질 수 있음 ⚠️' },
    ],
    initialValues: ['image', 'media', 'font'],
    required: false,
  });
  if (p.isCancel(blockTypes)) {
    p.cancel('취소됨');
    process.exit(0);
  }

  const enableHotReload = await p.confirm({
    message: 'Hot reload 활성화? (config 파일 변경 시 자동 적용)',
    initialValue: true,
  });
  if (p.isCancel(enableHotReload)) {
    p.cancel('취소됨');
    process.exit(0);
  }

  // ── 생성 ─────────────────────────────────────────────────
  const cfg: Record<string, unknown> = {
    $schema: './schema/seo-gateway.config.schema.json',
    mode,
    renderer: {
      poolMin: 2,
      poolMax: 8,
      waitUntil: 'networkidle2',
      blockResourceTypes: blockTypes,
    },
    cache: {
      memory: { ttlMs: ttlChoice },
      swrWindowMs: 3_600_000,
      ...(useRedis ? { redis: { enabled: true, url: redisUrl } } : {}),
    },
    routes: [],
    hotReload: !!enableHotReload,
  };
  if (typeof originUrl === 'string' && originUrl) cfg.originUrl = originUrl;

  writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');

  const envPath = resolve(cwd, '.env');
  const envContent = `# spa-seo-gateway env (생성 시각: ${new Date().toISOString()})
ADMIN_TOKEN=${finalAdminToken}
${useRedis ? 'REDIS_CACHE_ENABLED=true\n' : ''}LOG_PRETTY=true
`;
  if (!existsSync(envPath)) {
    writeFileSync(envPath, envContent, 'utf8');
  }

  p.note(
    [
      `${pc.bold('생성된 파일')}`,
      `  ${pc.cyan(configPath)}`,
      `  ${pc.cyan(envPath)} ${existsSync(envPath) ? pc.dim('(기존 보존)') : ''}`,
      '',
      `${pc.bold('Admin 토큰')} ${pc.dim('(저장 — 분실 시 .env 또는 keychain 에서 재발급)')}`,
      `  ${pc.green(finalAdminToken)}`,
      '',
      `${pc.bold('다음 단계')}`,
      `  ${pc.cyan('pnpm install')}`,
      `  ${pc.cyan('pnpm dev')}                ${pc.dim('# 또는 docker compose up -d')}`,
      `  ${pc.cyan(`open http://localhost:3000/admin/ui`)}`,
      '',
      `${pc.bold('CDN/Nginx 통합')}`,
      `  봇 트래픽을 게이트웨이로 라우팅하려면 docs/USAGE.md 의 Nginx/Caddy/Cloudflare 예시 참고.`,
    ].join('\n'),
    '✓ 셋업 완료',
  );

  p.outro(pc.green('Happy rendering 🚀'));
}
