# @heejun/spa-seo-gateway-cli

`spa-seo-gateway` 의 인터랙티브 CLI. 새 프로젝트 셋업, 환경 진단, 단발 렌더를 한 명령으로.

## 설치 / 실행

```bash
# npm 한 번 실행
npx @heejun/spa-seo-gateway-cli init

# 또는 글로벌 설치
npm i -g @heejun/spa-seo-gateway-cli
spa-seo-gateway init     # 풀 명령
ssg init                 # alias
```

## 명령

### `init`

인터랙티브 셋업. `seo-gateway.config.json` + `.env` 생성. 토큰 자동 생성.

```bash
npx @heejun/spa-seo-gateway-cli init
```

질문 항목:
- 운영 모드 (render-only / proxy / cms / saas)
- Origin URL
- Admin 토큰 (Enter → 자동 생성)
- 캐시 TTL (10분 / 1시간 / 6시간 / 24시간 / 7일)
- Redis 활성 여부 + URL
- 차단 리소스 타입 (image/media/font/stylesheet)
- Hot reload 활성

### `doctor`

환경 점검 — Node 버전 / pnpm / chromium / 포트 / 설정 / 토큰.

```bash
ssg doctor
```

각 항목에 대해 ✓ 정상 또는 ⚠ 권장 수정안 출력.

### `render <url> [options]`

단발 렌더. 서버 실행 없이 한 URL 만 렌더링.

```bash
ssg render https://www.example.com/ --out result.html
ssg render https://www.example.com/m --mobile
ssg render https://www.example.com/ --ua "bingbot/2.0"
ssg render https://www.example.com/ --stdout > out.html
```

옵션:
- `--out <file>`: 결과 HTML 을 파일로 저장
- `--stdout`: 결과 HTML 을 stdout 으로 출력
- `--ua <ua>`: User-Agent 지정 (기본 Googlebot)
- `--mobile`: 모바일 Googlebot UA 사용

## 라이선스

MIT
