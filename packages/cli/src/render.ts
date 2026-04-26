import { writeFileSync } from 'node:fs';
import * as p from '@clack/prompts';
import pc from 'picocolors';

type Args = { url?: string; out?: string; ua?: string; mobile?: boolean; stdout?: boolean };

function parse(rest: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a) continue;
    if (a === '--mobile') out.mobile = true;
    else if (a === '--stdout') out.stdout = true;
    else if (a === '--out') out.out = rest[++i];
    else if (a === '--ua') out.ua = rest[++i];
    else if (!a.startsWith('--')) out.url = a;
  }
  return out;
}

export async function runRender(rest: string[]): Promise<void> {
  const a = parse(rest);
  if (!a.url) {
    console.error(
      pc.red('URL 이 필요합니다.'),
      pc.dim('\n  예시: ssg render https://www.example.com/ --out result.html'),
    );
    process.exitCode = 2;
    return;
  }

  p.intro(pc.bgCyan(pc.black(' spa-seo-gateway · render ')));

  // Lazy import: core 가 puppeteer 같은 무거운 의존성을 끌어와서, 서브명령에서만 로드.
  const s = p.spinner();
  s.start('브라우저 풀 시작 중 (chromium 첫 실행 시 시간 소요)');

  const core = await import('@heejun/spa-seo-gateway-core').catch((e) => {
    s.stop('실패');
    console.error(pc.red('@heejun/spa-seo-gateway-core 로드 실패:'), e.message);
    console.error(pc.dim('npm i @heejun/spa-seo-gateway-core 가 필요할 수 있습니다.'));
    process.exit(1);
  });
  await core.browserPool.start();
  s.stop('풀 준비됨');

  const ua =
    a.ua ??
    (a.mobile
      ? 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      : 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');

  const t0 = Date.now();
  s.start(`렌더 중 — ${pc.cyan(a.url)}`);
  try {
    const route = core.matchRoute(a.url);
    const entry = await core.render({ url: a.url, headers: { 'user-agent': ua }, route });
    const dt = Date.now() - t0;
    s.stop(`완료 (${dt}ms)`);

    p.note(
      [
        `${pc.bold('URL')}        ${a.url}`,
        `${pc.bold('Status')}     ${entry.status}`,
        `${pc.bold('Bytes')}      ${Buffer.byteLength(entry.body, 'utf8').toLocaleString()}`,
        `${pc.bold('Viewport')}   ${entry.headers['x-prerender-viewport']}`,
        `${pc.bold('UA')}         ${pc.dim(ua.slice(0, 80))}${ua.length > 80 ? pc.dim('...') : ''}`,
        ...(route ? [`${pc.bold('Route')}      ${route.pattern}`] : []),
        ...(entry.headers['x-prerender-quality']
          ? [`${pc.bold('Quality')}    ${pc.yellow(entry.headers['x-prerender-quality'])}`]
          : []),
      ].join('\n'),
      '결과',
    );

    if (a.out) {
      writeFileSync(a.out, entry.body, 'utf8');
      console.log(pc.green(`✓ 저장: ${a.out}`));
    }
    if (a.stdout) {
      process.stdout.write(entry.body);
    }
  } catch (e) {
    s.stop(pc.red('실패'));
    console.error(pc.red('렌더 오류:'), (e as Error).message);
    process.exitCode = 1;
  } finally {
    await core.browserPool.stop();
  }
  p.outro('');
}
