// 데모 빌드 — admin-frontend 의 Vite 산출물 (packages/admin-ui/public/) 을
// apps/demo/public/ 로 복사한 뒤 데모 알림 배너를 주입.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

const adminDistDir = resolve(root, 'packages/admin-ui/public');
const outDir = resolve(__dirname, 'public');

if (!existsSync(adminDistDir) || !existsSync(resolve(adminDistDir, 'index.html'))) {
  console.error('✗ admin-frontend 빌드 산출물이 없습니다:', adminDistDir);
  console.error('  먼저 `pnpm --filter @spa-seo-gateway/admin-frontend run build` 를 실행하세요.');
  process.exit(1);
}

// outDir 정리 후 재생성 (오래된 hash 자산 누적 방지)
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// admin-frontend 산출물 통째 복사
cpSync(adminDistDir, outDir, { recursive: true, force: true });

// Vite 가 base: '/admin/ui/' 로 빌드했으므로 데모 (배포 root '/') 에 맞게 base 를 '/' 로 재작성.
const indexPath = resolve(outDir, 'index.html');
let html = readFileSync(indexPath, 'utf8');
html = html.replace(/\/admin\/ui\//g, '/');

// 데모 알림 배너 주입.
const banner = `
<div style="position:fixed;top:0;left:0;right:0;background:linear-gradient(90deg,#f59e0b,#ef4444);color:white;text-align:center;padding:8px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
  🎭 정적 데모 — 실제 봇 렌더링/admin API 는 동작하지 않습니다.
  <a href="https://github.com/blue45f/spa-seo-gateway" target="_blank" rel="noreferrer" style="color:white;text-decoration:underline;margin-left:8px">GitHub</a>
  ·
  <a href="https://www.npmjs.com/package/@heejun/spa-seo-gateway-core" target="_blank" rel="noreferrer" style="color:white;text-decoration:underline;margin-left:4px">npm</a>
</div>
<style>body { padding-top: 36px; }</style>
`;
html = html.replace(/<\/head>/, `${banner}\n  </head>`);

writeFileSync(indexPath, html, 'utf8');

console.log(`✓ demo built: ${outDir}`);
