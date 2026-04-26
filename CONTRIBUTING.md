# Contributing

기여 환영합니다! 작은 PR 도 좋고, 의견 / 버그 리포트도 환영입니다.

## 개발 환경

```bash
# Node 20+ 권장 (24 LTS)
git clone https://github.com/blue45f/spa-seo-gateway
cd spa-seo-gateway
pnpm install        # husky 자동 활성화
pnpm dev            # tsx watch (apps/gateway)
```

## 작업 흐름

1. 이슈를 먼저 확인 — 중복 회피
2. 브랜치 생성: `git checkout -b feat/short-name`
3. 코드 + 테스트 추가
4. `pnpm test` / `pnpm typecheck` / `pnpm lint` 통과
5. PR 생성 — 작은 단위로 자주

husky 가 commit/push 단계에서 자동으로 typecheck + build + test 검증합니다.

## 코드 스타일

- TypeScript strict, Biome 포맷터 (자동 적용)
- 문서/주석은 한국어 OK, 코드 식별자는 영어
- 함수에 주석은 *왜* 필요한 경우에만 (이름이 *무엇을* 설명하므로)

## 새 기능 추가 시 체크

- [ ] 단위 테스트 (`tests/*.test.ts`)
- [ ] 환경변수 새로 생기면 `CONFIGURATION.md` 업데이트
- [ ] 어드민 API 새로 생기면 admin-ui 의 API 탭에 추가
- [ ] CHANGELOG.md 에 한 줄

## 브랜치 / 커밋

- `main`: 항상 배포 가능 상태
- 커밋 메시지 prefix: `feat:` / `fix:` / `refactor:` / `chore:` / `docs:` / `test:`
- 본문에 한국어 OK

## 이슈 / 버그 리포트

다음을 포함:
- spa-seo-gateway 버전 (`package.json` 또는 `npm view @heejun/spa-seo-gateway-core version`)
- Node 버전 (`node -v`)
- 운영 모드 (`GATEWAY_MODE`)
- 재현 가능한 최소 사례
- 로그 (가능하면 LOG_LEVEL=debug)

## 보안 이슈

[SECURITY.md](SECURITY.md) 의 가이드를 따라 비공개 보고.
