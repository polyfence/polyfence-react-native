# Consistency Checks

`consistency-checks.yaml` lists declarative drift checks. Entrypoint `scripts/consistency-check.sh` runs `scripts/consistency-check.ts` via `npx tsx`.

```bash
bash scripts/consistency-check.sh --local-only
```

## Seed checks

| id | intent |
| --- | --- |
| bootstrap-files-not-tracked | Guardrail paths remain untracked |
| package-readme-version-sync | package semver echoed across README / doc/API_SURFACE.md / SECURITY / doc/TELEMETRY.md |
| tsc-clean | TypeScript compile hygiene |
| ios-podspec-version-declared | Podspec declares `s.version` for CocoaPods releases |
| privacy-md-zero-pii-headline | `PRIVACY.md` keeps the template zero-PII headline |
| package-json-spdx-license | `package.json` declares MIT SPDX |
| readme-links-polyfence-core-origin | README links the polyfence-core GitHub origin |

## Phase 3

`package-readme-version-sync` now also requires the semver in `doc/API_SURFACE.md` (API doc title alignment). Privacy + SPDX + upstream links close README drift classes the version script does not cover.

Install hook via `cp scripts/pre-push-checks.sh .git/hooks/pre-push`.
