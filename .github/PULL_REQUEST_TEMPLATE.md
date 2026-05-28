<!-- 제목은 Conventional Commits 규칙을 따릅니다. 예: feat(core): add render timeout policy -->

## 변경 사항 요약

<!-- 무엇을, 왜 바꿨는지 1~3줄 -->

## 변경 종류

- [ ] feat
- [ ] fix
- [ ] docs
- [ ] refactor
- [ ] test
- [ ] chore

## 영향 범위

- [ ] packages/core
- [ ] packages/admin-ui
- [ ] packages/multi-tenant
- [ ] packages/cms
- [ ] apps/gateway
- [ ] apps/admin-frontend
- [ ] 루트 인프라(CI, scripts, config)
- [ ] 문서

## 체크리스트

- [ ] `pnpm run verify` 통과
- [ ] `CodeRabbit review gate` 통과
- [ ] config/schema 변경 시 `pnpm run schema:gen` 반영
- [ ] gateway runtime 변경 시 캐시/렌더링 실패 경로 확인
- [ ] admin API 변경 시 admin frontend 영향 확인

## 스크린샷 / 데모

<!-- UI 변경 시 첨부 -->
