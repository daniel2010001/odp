# Apply Progress: Authentication — Work Units 1–3 (Foundation + Server Auth Helper + Routes/Client API)

- **Change**: authentication
- **Phase**: Phase 1 (tasks 1.1–1.7) + Phase 2 (tasks 2.1–2.2) + Phase 3 (tasks 3.1–3.5)
- **Mode**: Strict TDD
- **Branch**: `feat/auth-01-foundation` (WU1, targets `main`) → `feat/auth-02-server` (WU2) → `feat/auth-03-routes` (WU3, stacked on WU2)
- **Date**: 2026-08-24

---

## Work Unit 1 (Foundation)

### Completed Tasks

- [x] 1.1 Add `sysadmin?`, `fullname?` to `CkanUser` (`src/lib/types/ckan.ts`)
- [x] 1.2 Extend `ApiClientConfig.apiKey` to `string | (() => string | null)` (`src/lib/types/api.ts`)
- [x] 1.3 Resolve lazy `apiKey` in `request()` (`src/lib/api/client.ts`)
- [x] 1.4 `getCkanClient()` passes `getApiKey` getter (`src/lib/ckan.ts`)
- [x] 1.5 Auth store: localStorage persistence + hydration; `isSuperAdmin` → `user.sysadmin` (`src/lib/stores/auth.ts`)
- [x] 1.6 Create `loginSchema` (zod, Spanish messages) (`src/lib/schemas/auth.ts`)
- [x] 1.7 Test: store persistence/hydration + `isSuperAdmin` (`src/lib/stores/auth.test.ts`)

### TDD Cycle Evidence (WU1)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | — (type export) | — | N/A (new field) | ➖ Structural | n/a | ➖ skipped: structural | ➖ none |
| 1.2 | — (type union) | — | N/A | ➖ Structural | n/a | ➖ skipped: structural | ➖ none |
| 1.3 | `src/lib/api/client.test.ts` | Unit | N/A (new) | ✅ 2 failed/1 passed | ✅ 3/3 | ✅ 3 cases (getter / null / string) | ✅ clean |
| 1.4 | — (wiring) | — | N/A | ➖ Structural | n/a | ➖ skipped: wiring, no branch | ➖ none |
| 1.5/1.7 | `src/lib/stores/auth.test.ts` | Unit | N/A (new) | ✅ 5 failed/3 passed | ✅ 8/8 | ✅ persistence + sysadmin + capacity-override | ✅ clean |
| 1.6 | `src/lib/schemas/auth.test.ts` | Unit | N/A (new) | ✅ module-not-found | ✅ 4/4 | ✅ valid + empty + spaces + short | ✅ clean |

### Work Unit Evidence (WU1)

| Evidence | Value |
|---|---|
| Focused test command | `pnpm test` — 3 files, 15 tests passed (exit 0) |
| Runtime harness | N/A — unit-only foundation; no route/runtime boundary in WU1 |
| Rollback boundary | Revert `src/lib/types/*`, `src/lib/api/client.*`, `src/lib/ckan.ts`, `src/lib/stores/auth.*`, `src/lib/schemas/auth.*`, plus `chore(test)` infra. No route/UI wiring touched; getter is unused until Phase 3/4 |

---

## Work Unit 2 (Server Auth Helper)

### Completed Tasks

- [x] 2.1 RED: mock-fetch tests for 6-step flow, cookie jar, CSRF fallback, error mapping (`src/lib/server/ckan-auth.test.ts`)
- [x] 2.2 Implement `ckan-auth.ts`: cookie jar, CSRF parse+fallback, mint; DI `baseUrl` (`src/lib/server/ckan-auth.ts`)

### TDD Cycle Evidence (WU2)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1/2.2 | `src/lib/server/ckan-auth.test.ts` | Unit | N/A (new) | ✅ module-not-found | ✅ 11/11 | ✅ 11 cases (6-step, resolved name, multi-cookie jar, 4 error paths, 2 CSRF fallbacks) | ✅ clean (`biome --write`) |

### Work Unit Evidence (WU2)

| Evidence | Value |
|---|---|
| Focused test command | `pnpm test src/lib/server/ckan-auth.test.ts` — 11 passed (exit 0); full `pnpm test` — 50 passed (8 files) |
| Runtime harness | N/A — mocked fetch; no route/runtime boundary in WU2 (helper unused until Phase 3) |
| Rollback boundary | Delete `src/lib/server/ckan-auth.ts` + `src/lib/server/ckan-auth.test.ts`; helper is not wired into any route yet, so removal leaves the app unchanged |

### Test Summary (WU2)

- **Total tests written**: 11
- **Total tests passing**: 11
- **Layers used**: Unit (11)
- **`pnpm check`**: 0 errors, 4 pre-existing warnings (ThemePlayground a11y ×2, SearchBar state_referenced_locally, tsconfig node types) — unrelated to this change
- **`biome check`**: clean on both changed files

---

## Work Unit 3 (Server Routes + Client API)

### Completed Tasks

- [x] 3.1 RED: `login`/`logout` endpoint wiring tests (`src/lib/api/auth.test.ts`)
- [x] 3.2 Implement client `login(username, password)` / `logout(token)` (`src/lib/api/auth.ts`)
- [x] 3.3 RED: handler rate-limit + body-parse + error-map tests (`src/lib/server/auth-server.test.ts`)
- [x] 3.4 Implement POST `/auth/login`: rate limit, parse, helper, Spanish errors (`src/routes/auth/login/+server.ts`)
- [x] 3.5 Implement POST `/auth/logout`: best-effort `api_token_revoke` (`src/routes/auth/logout/+server.ts`)

### TDD Cycle Evidence (WU3)

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1/3.2 | `src/lib/api/auth.test.ts` | Unit | N/A (new) | ✅ module-not-found | ✅ 5/5 | ✅ login success/401/500 + logout success/network | ✅ clean |
| 3.3/3.4 | `src/lib/server/auth-server.test.ts` | Unit | N/A (new) | ✅ module-not-found | ✅ 19/19 | ✅ 4 rate-limit + 4 parse + 6 error-map + 5 handleLogin | ✅ clean (`biome --write`) |
| 3.5 | `src/lib/server/ckan-auth.test.ts` | Unit | ✅ 11/11 (WU2 baseline) | ✅ 3 failed/11 passed | ✅ 14/14 | ✅ revoke happy-path + network + HTTP-error | ✅ clean |

### Work Unit Evidence (WU3)

| Evidence | Value |
|---|---|
| Focused test command | `pnpm test src/lib/api/auth.test.ts` — 5 passed; `pnpm test src/lib/server/auth-server.test.ts` — 19 passed; `pnpm test src/lib/server/ckan-auth.test.ts` — 14 passed; full `pnpm test` — 77 passed (10 files) |
| Runtime harness | `curl -X POST http://localhost:5173/auth/login -H 'Content-Type: application/json' -d '{"username":"x","password":"y"}'` in `pnpm dev` — not executed (no live CKAN dev instance in this environment); route wiring validated by `svelte-check` + generated `$types` |
| Rollback boundary | Delete `src/lib/api/auth.*`, `src/lib/server/auth-server.*`, `src/routes/auth/login/+server.ts`, `src/routes/auth/logout/+server.ts`, and revert `revokeToken` in `src/lib/server/ckan-auth.ts` (+ its tests). Store/UI untouched; `auth.ts` client API is unused until Phase 4 |

### Test Summary (WU3)

- **Total tests written**: 27 (5 client API + 19 handler + 3 revoke)
- **Total tests passing**: 77 (10 files) — was 50 (8 files) before WU3
- **Layers used**: Unit (27)
- **`pnpm check`**: 0 errors, 4 pre-existing warnings (ThemePlayground a11y ×2, SearchBar state_referenced_locally, tsconfig node types) — unrelated to this change
- **`biome check`**: clean on all 8 changed files (5 auto-fixed for import order)

---

## Deviations / Notes (cumulative)

1. **Test infra prerequisite**: `origin/main` (10d0160) did NOT contain the Vitest test infrastructure — it lives on `chore/cleanup` (commit `452a844`, unmerged). Strict TDD required a runner, so WU1 PR includes a `chore(test)` commit as a prerequisite. Recommend merging `chore/cleanup`'s test-infra commit before later WUs.
2. **`apiKey` field naming**: task 1.4 wording says "`getApiKey` getter", but the config field is `apiKey` (per task 1.2 and design Interfaces/Contracts). Implemented as `apiKey: () => get(auth).token`.
3. **localStorage mock**: jsdom v30 exposes no `localStorage` in this setup, so `src/test-setup.ts` installs an in-memory `localStorage`.
4. **Pre-commit hook**: previously invoked `bun` (not installed). Now uses `pnpm exec biome check --staged --write` (fixed upstream in `chore(dev)`), so WU2 commits used the normal hook.
5. **DOMException vs Error (WU2)**: jsdom v30's `DOMException` is not `instanceof Error`, so the mock's `throw` guard (`next instanceof Error`) did not rethrow it. The TIMEOUT test uses `new Error(...)` with `name = "AbortError"` instead; the helper checks `err.name`, matching real abort semantics.
6. **Error codes beyond design (WU2)**: the design's Interfaces/Contracts listed only bad-creds / network / timeout / CSRF codes, but steps 2 and 4 also need typed failures. Added `USER_RESOLUTION_FAILED` and `TOKEN_CREATION_FAILED` to `CkanAuthErrorCode`. This clarifies the design without changing behavior.
7. **`+server.test.ts` in `src/routes/` is illegal (WU3)**: SvelteKit reserves ALL `+`-prefixed files under `src/routes/`. `src/routes/auth/login/+server.test.ts` (task 3.3's stated path) breaks `svelte-kit sync` with "Files prefixed with + are reserved". Relocated the handler test to `src/lib/server/auth-server.test.ts` (co-located with the extracted `auth-server.ts` helpers it tests). The thin `+server.ts` wrapper is validated by `svelte-check` instead.
8. **Testable handler via extracted module (WU3)**: `+server.ts` imports `$env/dynamic/private`, which Vitest cannot resolve. Extracted all testable logic (rate limiter, body parse, error map, orchestration) into `src/lib/server/auth-server.ts` (no `$env` import), returning plain `{ status, body }` results the route converts with `json(...)`.
9. **`$env/dynamic/private` is `{ env }`, not named exports (WU3)**: the generated ambient types expose `export const env`, so the route reads `env.CKAN_INTERNAL_URL` (not `import { CKAN_INTERNAL_URL }`). Falls back to `http://localhost:5000` for dev.
10. **Timeout maps to 504, not 502 (WU3)**: the design contract lists 401/429/502 only; `TIMEOUT` is mapped to 504 (semantically correct upstream timeout) with the Spanish message "La conexión con CKAN expiró.". All other upstream failures map to 502 with a specific Spanish message.

## Remaining (Phases 4–5 — NOT implemented)

- [ ] 4.1–4.4 Login UI, dashboard, UserMenu, layout
- [ ] 5.1–5.3 Env vars + docs (`CKAN_INTERNAL_URL`)

## Commits (cumulative)

WU1:

- `d85a53f` docs(openspec): add authentication change planning artifacts
- `340a88b` chore(test): add Vitest test infrastructure (config, jsdom setup, runner)
- `96f3925` feat(auth): add sysadmin and fullname fields to CkanUser
- `dbce341` feat(auth): support lazy apiKey resolver in CKAN client
- `5d48710` feat(auth): wire auth token getter into CKAN client singleton
- `e9d488f` feat(auth): persist session in localStorage and derive isSuperAdmin from sysadmin
- `7fd0dbe` feat(auth): add login validation schema with Spanish messages
- `9c694ab` docs(openspec): record apply progress for authentication work unit 1

WU2:

- `2b21a38` test(auth): add server CKAN auth helper tests
- `864b8a4` feat(auth): add server-side CKAN auth helper

WU3:

- `c382b6e` test(auth): add client login/logout API wiring tests
- `980528d` feat(auth): add client login/logout API module
- `8e73263` test(auth): add login route handler and token revoke tests
- `d54b0e6` feat(auth): add login and logout server routes
