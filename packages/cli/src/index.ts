#!/usr/bin/env node
/**
 * spa-seo-gateway CLI — init / doctor / render
 *
 *   npx @heejun/spa-seo-gateway-cli init
 *   npx @heejun/spa-seo-gateway-cli doctor
 *   npx @heejun/spa-seo-gateway-cli render <url>
 */
import pc from 'picocolors';
import { runDoctor } from './doctor.js';
import { runInit } from './init.js';
import { runRender } from './render.js';

const HELP = `
${pc.bold('spa-seo-gateway')} ${pc.dim('— SPA SEO 게이트웨이 CLI')}

${pc.bold('USAGE')}
  ${pc.cyan('spa-seo-gateway')} <command> [options]
  ${pc.dim('또는 alias:')} ${pc.cyan('ssg')} <command>

${pc.bold('COMMANDS')}
  ${pc.green('init')}         인터랙티브 초기 설정 (seo-gateway.config.json 생성)
  ${pc.green('doctor')}       환경 진단 (Node / chromium / 포트 / 디스크)
  ${pc.green('render')} <url> 단발 렌더링 (서버 없이 stdout / 파일로 출력)
  ${pc.green('help')}         이 도움말

${pc.bold('EXAMPLES')}
  ${pc.dim('# 새 프로젝트 셋업')}
  ${pc.cyan('npx @heejun/spa-seo-gateway-cli init')}

  ${pc.dim('# 환경 점검')}
  ${pc.cyan('ssg doctor')}

  ${pc.dim('# URL 한 개 렌더해서 파일 저장')}
  ${pc.cyan('ssg render https://www.example.com/ --out result.html')}

${pc.bold('LINKS')}
  Docs:    https://github.com/blue45f/spa-seo-gateway
  Issues:  https://github.com/blue45f/spa-seo-gateway/issues
`;

async function main() {
  const [, , cmd, ...rest] = process.argv;
  switch (cmd) {
    case 'init':
      await runInit(rest);
      break;
    case 'doctor':
      await runDoctor();
      break;
    case 'render':
      await runRender(rest);
      break;
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP);
      break;
    default:
      console.error(pc.red(`알 수 없는 명령: ${cmd}`));
      console.log(HELP);
      process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(pc.red('실패:'), err.message);
  process.exit(1);
});
