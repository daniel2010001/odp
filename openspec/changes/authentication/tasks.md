# Tasks: Authentication

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900 (additions + deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 foundation → PR2 auth helper → PR3 routes+client API → PR4 UI → PR5 env/docs |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Types, store persistence, client token wiring | PR1 | `pnpm test src/lib/stores` | N/A — unit only | revert files; no route wiring |
| 2 | CKAN 6-step auth helper | PR2 | `pnpm test src/lib/server` | N/A — mocked fetch | revert helper; unused |
| 3 | Login/logout routes + client API | PR3 | `pnpm test src/routes/auth` | `curl -X POST /auth/login` in dev | revert routes; store intact |
| 4 | Login UI, dashboard, UserMenu, layout | PR4 | `pnpm test src/lib/components/auth` | manual browser login | revert components |
| 5 | Env vars + docs | PR5 | `pnpm check` | N/A — config only | revert env/compose |

## Phase 1: Foundation

- [ ] 1.1 Add `sysadmin?`, `fullname?` to `CkanUser` (`src/lib/types/ckan.ts`)
- [ ] 1.2 Extend `ApiClientConfig.apiKey` to `string | (() => string | null)` (`src/lib/types/api.ts`)
- [ ] 1.3 Resolve lazy `apiKey` in `request()` (`src/lib/api/client.ts`)
- [ ] 1.4 `getCkanClient()` passes `getApiKey` getter (`src/lib/ckan.ts`)
- [ ] 1.5 Auth store: localStorage persistence + hydration; `isSuperAdmin` → `user.sysadmin` (`src/lib/stores/auth.ts`)
- [ ] 1.6 Create `loginSchema` (zod, Spanish messages) (`src/lib/schemas/auth.ts`)
- [ ] 1.7 Test: store persistence/hydration + `isSuperAdmin` (`src/lib/stores/auth.test.ts`)

## Phase 2: Server Auth Helper

- [ ] 2.1 RED: mock-fetch tests for 6-step flow, cookie jar, CSRF fallback, error mapping (`src/lib/server/ckan-auth.test.ts`)
- [ ] 2.2 Implement `ckan-auth.ts`: cookie jar, CSRF parse+fallback, mint; DI `baseUrl` (`src/lib/server/ckan-auth.ts`)

## Phase 3: Server Routes + Client API

- [ ] 3.1 RED: `login`/`logout` endpoint wiring tests (`src/lib/api/auth.test.ts`)
- [ ] 3.2 Implement client `login(username, password)` / `logout(token)` (`src/lib/api/auth.ts`)
- [ ] 3.3 RED: handler rate-limit + body-parse + error-map tests (`src/routes/auth/login/+server.test.ts`)
- [ ] 3.4 Implement POST `/auth/login`: rate limit, parse, helper, Spanish errors (`src/routes/auth/login/+server.ts`)
- [ ] 3.5 Implement POST `/auth/logout`: best-effort `api_token_revoke` (`src/routes/auth/logout/+server.ts`)

## Phase 4: UI

- [ ] 4.1 Login page: runes form, zod, loading/error, `goto(returnTo || "/dashboard")` (`src/routes/auth/login/+page.svelte`)
- [ ] 4.2 Dashboard: minimal + client guard → `goto("/auth/login")` (`src/routes/dashboard/+page.svelte`)
- [ ] 4.3 Test + implement `UserMenu.svelte`: runes dropdown (name, Dashboard, Cerrar sesión) (`src/lib/components/auth/UserMenu.svelte`)
- [ ] 4.4 Replace `{#if false}` block with conditional `UserMenu` desktop+mobile (`src/routes/+layout.svelte`)

## Phase 5: Env + Docs

- [ ] 5.1 Add `CKAN_INTERNAL_URL` (server-only) to `.env.example`
- [ ] 5.2 Add `CKAN_INTERNAL_URL` to odp-docker compose (prod `http://ckan:5000`, dev `http://ckan-dev:5000`)
- [ ] 5.3 Run `pnpm check` typecheck gate — must pass
