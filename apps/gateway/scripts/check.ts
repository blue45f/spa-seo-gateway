/**
 * 단일 URL 을 헤드리스로 렌더해 결과/통계를 출력하는 CLI 진단 도구.
 *
 *   tsx scripts/check.ts <url> [--ua "Googlebot"] [--out output.html] [--stdout]
 *
 * 기본은 통계만 출력. 옵션:
 *   --stdout     렌더된 HTML 을 stdout 으로
 *   --out <file> 렌더된 HTML 을 파일로 저장
 *   --ua <ua>    User-Agent override (기본: Googlebot)
 *   --mobile     모바일 봇 UA 사용
 */
import { writeFileSync } from 'node:fs';
import { argv, exit, stdout } from 'node:process';
import { browserPool, matchRoute, render } from '@heejun/spa-seo-gateway-core';

const args = argv.slice(2);
const flags = new Set<string>();
const params = new Map<string, string>();
const positional: string[] = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i] ?? '';
  if (a.startsWith('--')) {
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      params.set(a.slice(2), next);
      i++;
    } else {
      flags.add(a.slice(2));
    }
  } else {
    positional.push(a);
  }
}

const url = positional[0];
if (!url) {
  console.error(
    'usage: tsx scripts/check.ts <url> [--ua "Googlebot"] [--out file] [--stdout] [--mobile]',
  );
  exit(2);
}

const ua =
  params.get('ua') ??
  (flags.has('mobile')
    ? 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    : 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');

console.error(`▶ rendering ${url}`);
console.error(`  UA: ${ua}`);

const route = matchRoute(url);
if (route) console.error(`  route override: ${JSON.stringify(route)}`);

const t0 = Date.now();
await browserPool.start();
console.error(`  pool ready in ${Date.now() - t0}ms`);

try {
  const t1 = Date.now();
  const entry = await render({ url, headers: { 'user-agent': ua }, route });
  const dt = Date.now() - t1;

  console.error(`✓ rendered in ${dt}ms`);
  console.error(`  status: ${entry.status}`);
  console.error(`  bytes : ${Buffer.byteLength(entry.body, 'utf8')}`);
  console.error(`  viewport: ${entry.headers['x-prerender-viewport']}`);

  const outFile = params.get('out');
  if (outFile) {
    writeFileSync(outFile, entry.body, 'utf8');
    console.error(`  saved to ${outFile}`);
  }
  if (flags.has('stdout')) stdout.write(entry.body);
} catch (e) {
  console.error(`✗ render failed:`, (e as Error).message);
  process.exitCode = 1;
} finally {
  await browserPool.stop();
}
