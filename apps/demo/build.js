// 빌드 시점에 packages/admin-ui/public/index.html 을 데모 정적 디렉토리로 복사하고
// 데모 알림 배너를 삽입합니다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');
const src = resolve(root, 'packages/admin-ui/public/index.html');
const outDir = resolve(__dirname, 'public');
const out = resolve(outDir, 'index.html');

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

let html = readFileSync(src, 'utf8');

const banner = `
<div style="position:fixed;top:0;left:0;right:0;background:linear-gradient(90deg,#f59e0b,#ef4444);color:white;text-align:center;padding:8px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
  🎭 정적 데모 — 실제 봇 렌더링은 동작하지 않습니다.
  <a href="https://github.com/blue45f/spa-seo-gateway" target="_blank" style="color:white;text-decoration:underline;margin-left:8px">GitHub</a>
  ·
  <a href="https://www.npmjs.com/package/@heejun/spa-seo-gateway-core" target="_blank" style="color:white;text-decoration:underline;margin-left:4px">npm</a>
</div>
<style>body{padding-top:36px}</style>
`;
html = html
  .replace('<body class="bg-slate-50', `<body class="bg-slate-50${''}`)
  .replace('</head>', '</head>\n' + banner.replace('<style>body', '<style>') + '\n  ');
// 위 replace 가 어색하므로 좀 더 안전하게
html = readFileSync(src, 'utf8');
html = html.replace(
  /<body class="bg-slate-50 text-slate-900 min-h-screen">/,
  (m) => `${m}\n${banner}`,
);

writeFileSync(out, html, 'utf8');
console.log(`✓ demo built: ${out}`);
