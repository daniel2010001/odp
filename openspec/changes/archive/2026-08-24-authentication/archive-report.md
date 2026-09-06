# Archive Report: authentication

**Change**: authentication
**Archived**: 2026-08-24
**Artifact store**: hybrid (repo-local `openspec/` + Engram `sdd/authentication/*`)
**Schema**: spec-driven
**Status**: CLOSED

## Change Summary

Add username/password login to the ODP portal (SvelteKit 5 frontend) through a server-side proxy that runs the validated 6-step CKAN 2.11.5 flow (`user/login` → `user_show` → CSRF token → `api_token_create`) and returns a CKAN JWT stored in localStorage. Zero CKAN/backend changes. Delivers: `/auth/login` page + proxy, `/auth/logout` (server-side revoke), authenticated `/dashboard` with client guard, header `UserMenu` replacing the "Iniciar Sesión" placeholder, localStorage session persistence, `isSuperAdmin` derived from `user.sysadmin`, in-memory login rate limiting, and `CKAN_INTERNAL_URL` env wiring.

## Final State (at close)

Final-state facts below are the terminal record of the cycle and outrank intermediate snapshots (`apply-progress`, `verify-report`) wherever they disagree.

| Aspect | Final state |
|--------|-------------|
| Status | **CLOSED** — fully planned, implemented, verified, archived |
| Verification verdict | **PASS** — verify-report admitted by `gentle-ai sdd-verify-validate` (valid: true, verdict pass). Evidence revision `sha256:d6ce8e2c0532b749018da59871439dd8816accfa562083b792b68675f453e4fa`. |
| Requirements / Scenarios | 9/9 requirements, 14/14 scenarios compliant, 0 blockers, 0 CRITICAL findings |
| Tests | **87 passed (13 files)**, `pnpm test` exit 0 |
| Type-check gate | `pnpm check` → 0 errors (4 pre-existing warnings unrelated to the change) |
| Build gate | `pnpm build` → exit 0 |
| Lint | Biome clean on all changed files (17 changed source/test files) |
| Tasks | 21/21 complete. Persisted `tasks.md` (archived) has every task checked `[x]` including Phase 5 (5.1–5.3). |
| TDD compliance | 6/6 checks passed (RED/GREEN/triangulation/safety nets recorded per WU in apply-progress) |
| Coverage | Not available — no coverage tool configured (`@vitest/coverage-*` not installed) |

### Remediation closed during the cycle

- One verify CRITICAL ("Anonymous header" scenario untested) was closed by `src/routes/layout-header.test.ts` (renders root layout anonymous + authenticated states, asserts `Iniciar Sesión` link → `/auth/login` and `UserMenu` when authed) plus a deterministic `window.matchMedia` stub added to `src/test-setup.ts`. Fix landed on branch `fix/auth-verify-anon-header` (commit `8f41ac0 test(auth): cover anonymous header link in layout`, PR #10) and is reflected in the final verify-report.

### Known limitations (non-blocking, documented)

- **Live CKAN round-trip** (real login against a live CKAN dev instance) remains deferred to manual/integration verification; unit verification uses mocked `fetch`. All runtime harnesses (curl in dev, manual browser login) were not executed — no live CKAN dev instance in the environment.
- **Token accumulation on repeated login** deferred (see Follow-ups, item 4).

## Delivery State

Chained PRs **stacked-to-main**, all **OPEN** (created, not yet merged), per delivery strategy resolved at session start (`chained PRs stacked-to-main`, 400-line budget risk High → chained delivery):

| PR | Branch → Target | Scope | Status |
|----|----------------|-------|--------|
| #5 | foundation → `main` | Work unit 1: types, lazy `apiKey`, store persistence, zod schema, test infra (`chore(test)` prerequisite) | OPEN |
| #6 | server auth helper → #5 branch | Work unit 2: `src/lib/server/ckan-auth.ts` 6-step flow + tests | OPEN |
| #7 | routes + client API → #6 branch | Work unit 3: login/logout routes, `auth-server.ts`, `src/lib/api/auth.ts` + tests | OPEN |
| #8 | UI → #7 branch | Work unit 4: login page, dashboard, `UserMenu`, layout wiring + tests | OPEN |
| #9 | env/docs → #8 branch | Work unit 5: `.env.example` `CKAN_INTERNAL_URL`, README docs | OPEN |
| #10 | verify remediation → #9 branch (`feat/auth-05-env`) | `layout-header.test.ts` + `matchMedia` stub (closes the anonymous-header CRITICAL) | OPEN |

PR URLs: `https://github.com/daniel2010001/odp/pull/{5,6,7,8,9,10}`.

Work-unit branches: `feat/auth-01-foundation` → `feat/auth-02-server` → `feat/auth-03-routes` → `feat/auth-04-ui` → `feat/auth-05-env`; remediation branch `fix/auth-verify-anon-header` (current checkout at archive time).

## Spec Sync (delta → main)

Main spec for domain `authentication` did not exist. Per archive convention the delta spec is a full spec and was copied verbatim:

| Domain | Action | Requirements | Scenarios |
|--------|--------|--------------|-----------|
| `authentication` | Created | 9 | 14 |

- `openspec/specs/authentication/spec.md`

## Archive Contents

Change folder moved to `openspec/changes/archive/2026-08-24-authentication/` containing:

- `proposal.md` ✅
- `specs/authentication/spec.md` ✅ (9 requirements / 14 scenarios)
- `design.md` ✅
- `tasks.md` ✅ (21/21 tasks complete, no unchecked implementation tasks)
- `apply-progress.md` ✅ (WU1–WU5, commits, TDD evidence, 13 deviations)
- `verify-report.md` ✅ (admitted bytes, evidence revision `d6ce8e2c…`)
- `archive-report.md` ✅ (this report)

Active changes directory no longer contains `authentication`.

## Engram Traceability (observation IDs)

| Artifact | Topic key | Observation ID |
|----------|-----------|----------------|
| Proposal | `sdd/authentication/proposal` | #198 |
| Design | `sdd/authentication/design` | #199 |
| Spec | `sdd/authentication/spec` | #200 |
| Tasks | `sdd/authentication/tasks` | #201 |
| Apply progress | `sdd/authentication/apply-progress` | #202 |
| Verify report | `sdd/authentication/verify-report` | #204 |
| Archive report | `sdd/authentication/archive-report` | this artifact |

## Follow-ups (out of scope — documented, not closed)

1. **odp-docker compose** (external repo) must add `CKAN_INTERNAL_URL` at deploy time — prod `http://ckan:5000`, dev `http://ckan-dev:5000`. External repo NOT edited; wiring documented in README (Autenticación section) and design.md. (apply-progress deviation 13.)
2. **Recommend `ckan.auth.create_user_via_api=false`** on CKAN to enforce PRD RF-03 (no public self-registration) — separate CKAN-side change.
3. **Live CKAN round-trip** — manual/integration verification of the real login flow still outstanding.
4. **Token accumulation on repeated login** deferred — consider `api_token_list` dedupe (design open question).
5. **Consider enabling `expire_api_token` plugin** on CKAN for token expiry (proposal non-goal).

## Notes and Discrepancies

- **Chain strategy in archived `tasks.md`**: the persisted tasks artifact shows `chain strategy: pending` (written at task-planning time before the strategy resolved); the engram tasks snapshot shows `stacked-to-main`. The authoritative resolved value is `stacked-to-main` per the orchestrator's delivery strategy and the 5+1 PRs actually created. Recorded for transparency; does not affect final state.
- **Task count consistency**: all sources agree on 21/21 tasks complete; verify-report completeness table (21 total / 21 complete / 0 incomplete) matches the persisted `tasks.md`.
- **Stale-snapshot reconciliation**: engram tasks observation (#201) shows Phase 5 checkboxes as `- [ ]` in the previewed revision; the persisted filesystem `tasks.md` (authoritative artifact, updated by sdd-apply) shows 5.1–5.3 as `[x]`, and `apply-progress` WU5 + `verify-report` (21/21) prove completion. No stale unchecked implementation tasks remain in the archived audit trail.
- **Environment fact**: `gentle-ai` CLI v2.4.0 installed at `~/.local/bin/gentle-ai` during this cycle (PATH added to `~/.bashrc` and `~/.config/fish/config.fish`).
- No destructive merge was performed (new domain spec created). No `openspec/config.yaml` exists, so no `rules.archive` constraints applied.
- Archive move left as uncommitted working-tree changes (no commit was requested); repo precedent for the archive commit is `docs(openspec): archive <change> change with base specs`.

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change.
