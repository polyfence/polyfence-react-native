# Consistency Checks

`consistency-checks.yaml` lists declarative drift checks. Entrypoint `scripts/consistency-check.sh` runs `scripts/consistency-check.ts` via `npx tsx`.

```bash
bash scripts/consistency-check.sh --local-only
```

## Seed checks

| id | intent |
| --- | --- |
| bootstrap-files-not-tracked | Guardrail paths remain untracked |
| package-readme-version-sync | package semver echoed across README / SECURITY / doc/TELEMETRY.md |
| tsc-clean | TypeScript compile hygiene |
| ios-podspec-version-declared | Podspec declares `s.version` for CocoaPods releases |

Note: full-repo ESLint (`npm run lint`) still traverses the example app toolchain and is intentionally **not** wired here until that surfaces stays green under one command without fragile skips.

Install hook via `cp scripts/pre-push-checks.sh .git/hooks/pre-push`.
