# CI 자동화 & 머지 정책

이 문서는 `main` 브랜치 머지 흐름을 정의합니다. 모든 PR — 사람이 만든 것이든 Dependabot 이 만든 것이든 — 아래 동일한 정책을 거칩니다.

## 머지 전제조건 (3 개 required check)

`main` branch protection 은 다음 status check 가 **모두** 통과해야만 머지를 허용합니다.

| Check | 무엇을 검증 | Workflow / 출처 |
|--|--|--|
| **`Quality gate`** | `pnpm verify` — format, lint, typecheck, build, test, schema 생성 + admin-frontend a11y(axe) 게이트(critical/serious 위반 0) | `.github/workflows/ci.yml` |
| **`CodeRabbit`** | CodeRabbit 자동 분석이 critical issue 없다고 판정 (status check) | CodeRabbit App (외부) |
| **`CodeRabbit review gate`** | CodeRabbit 의 PR review state 가 `APPROVED`. `COMMENTED` / `CHANGES_REQUESTED` / stale review 모두 fail | `.github/workflows/coderabbit-gate.yml` |

추가 정책:
- `strict: true` — PR 브랜치가 `main` 최신과 동기여야 함 (out-of-date 차단). Dependabot 은 자동으로 rebase, 사람 PR 은 GitHub UI 의 "Update branch" 또는 `gh pr update-branch` 사용
- `enforce_admins: true` — 저장소 owner / admin 도 동일하게 위 정책 적용. 응급 시 임시 토글 패턴 필요 (아래 참고)
- `allow_force_pushes: false`, `allow_deletions: false` — `main` 자체에 대한 force-push / 삭제 차단

## CodeRabbit review gate 의 동작 원리

기존 `CodeRabbit` status check 는 CodeRabbit 이 *어떤 응답이든* success 를 보내면 통과합니다. 즉 CodeRabbit 이 단순 코멘트만 남겨도 머지 차단이 풀립니다. 이를 막기 위해 별도 gate workflow 가 다음을 강제합니다.

- **`APPROVED` state 만 통과** — `COMMENTED` / `CHANGES_REQUESTED` / `DISMISSED` / `PENDING` 모두 명시적 fail
- **최신 head SHA 에 대한 리뷰만 카운트** — 새 commit 푸시 시 gate 다시 red. 이전 commit 의 approval 이 자동 invalidated
- **봇 login 변경 대비** — `coderabbitai[bot]` / `coderabbitai` / `coderabbit-ai[bot]` / `coderabbit[bot]` 4 가지 변형 모두 허용
- **Draft PR 자동 skip** — Ready-for-review 전환 시 자동 재 트리거
- `pull_request` + `pull_request_review` 양쪽 이벤트 트리거 — review 가 들어오자마자 gate 갱신

소스: [`.github/workflows/coderabbit-gate.yml`](../.github/workflows/coderabbit-gate.yml)

## Dependabot auto-merge

매주 월요일 09:00 KST 에 Dependabot 이 npm 의존성 PR 을 생성하고, 매월 GitHub Actions 의존성 PR 을 생성합니다 ([`.github/dependabot.yml`](../.github/dependabot.yml)).

`.github/workflows/dependabot-auto-merge.yml` 가 생성된 PR 에 대해 자동으로 `gh pr merge --auto --squash --delete-branch` 활성화. 단 다음 조건일 때만:

- `update-type == version-update:semver-patch` — 모든 패치 업데이트
- `update-type == version-update:semver-minor` — 모든 마이너 업데이트
- `package-ecosystem == github_actions` — 액션 버전 (보통 안전한 alias 업데이트)
- `update-type == version-update:semver-major && dependency-type == direct:development` — devDep 의 major (개발 도구라 production 영향 적음)

위 조건에 해당하지 않는 **production dependency 의 major 업데이트는 수동 검토**. PR 자체는 만들어지지만 auto-merge 활성화 안 됨.

Auto-merge 활성화 후에도 위의 3 개 required check 를 통과해야 실제 머지됩니다 — Dependabot 도 사람과 똑같이 CodeRabbit APPROVED 가 필요.

## PR 흐름 (사람)

1. **브랜치 작성** — `git checkout -b <type>/<topic>` (예: `feat/cache-warmup`, `chore/deps-update`, `fix/audit-chain`)
2. **변경 + 로컬 verify** — `pnpm verify` 가 통과해야 함. lint warning 도 0 유지
3. **Push + PR 생성** — `gh pr create` 또는 GitHub UI. 템플릿 체크리스트 모두 채움
4. **CodeRabbit 리뷰 대기** — PR 생성 후 1–3 분 내 자동 리뷰. APPROVED / CHANGES_REQUESTED 결정
5. **review 응대** — `CHANGES_REQUESTED` 받으면 코멘트 반영 후 새 commit 푸시. gate 자동 재평가
6. **자동 머지 활성화 (선택)** — `gh pr merge <num> --squash --auto --delete-branch` → 모든 required check 통과 시 자동 머지
7. **수동 머지** — auto-merge 미활성 시 `gh pr merge --squash --delete-branch`

## 응급 우회 패턴 (`enforce_admins=true` 와 함께 사용)

운영 장애 등 즉시 main 에 hot-fix 가 필요한 경우:

```bash
# 1. 응급 토글
gh api repos/blue45f/spa-seo-gateway/branches/main/protection/enforce_admins \
  --method DELETE

# 2. 응급 작업 (직접 push 또는 strict 무시 머지)
git push origin main

# 3. 즉시 복구 — 토글 끄고 다시 켜기 권장
gh api repos/blue45f/spa-seo-gateway/branches/main/protection/enforce_admins \
  --method POST
```

이 절차는 audit log 에 남고, 변경 사유는 별도 incident 채널 / commit message 에 명시 권장.

## 새 required check 추가

새 CI workflow 가 생기면 branch protection 의 `contexts` 에 추가:

```bash
gh api repos/blue45f/spa-seo-gateway/branches/main/protection/required_status_checks \
  --method PATCH \
  --input - <<'EOF'
{
  "strict": true,
  "contexts": ["Quality gate", "CodeRabbit", "CodeRabbit review gate", "<new-check-name>"]
}
EOF
```

**중요**: workflow 의 job `name:` 이 곧 check context name. job name 을 바꾸면 기존 `contexts` 가 영원히 매치 안 되어 PR 머지가 영구 차단됩니다 (v1.12.2 작업에서 한 번 사고). job name 변경 시 반드시 `contexts` 도 함께 갱신.

## 관련 파일

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — `Quality gate` + `docker` job
- [`.github/workflows/coderabbit-gate.yml`](../.github/workflows/coderabbit-gate.yml) — APPROVED gate
- [`.github/workflows/dependabot-auto-merge.yml`](../.github/workflows/dependabot-auto-merge.yml) — Dependabot 자동 머지
- [`.github/dependabot.yml`](../.github/dependabot.yml) — 스케줄 / ecosystem
- [`.coderabbit.yaml`](../.coderabbit.yaml) — CodeRabbit 자체 설정 (KR, path filter)
- [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md) — PR 체크리스트
