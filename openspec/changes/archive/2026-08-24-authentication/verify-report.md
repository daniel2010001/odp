```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:d6ce8e2c0532b749018da59871439dd8816accfa562083b792b68675f453e4fa
verdict: pass
blockers: 0
critical_findings: 0
requirements: 9/9
scenarios: 14/14
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:0ebcd3cfc57ea6e63e6b8df2f755d35bb3124d55e98da40ccb6349970e0577fb
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:20cc74972745354b6641e30af0478e1da70317492d30cffef37a172601df6c57
```

## Verification Report

**Change**: authentication
**Version**: N/A
**Mode**: Strict TDD

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 21 |
| Tasks complete | 21 |
| Tasks incomplete | 0 |

### Build & Tests Execution
**Tests**: ✅ 87 passed / ❌ 0 failed / ⚠️ 0 skipped (13 files)
```text
$ pnpm test
Test Files  13 passed (13)
     Tests  87 passed (87)
```

**Type-check**: ✅ Passed (0 errors, 4 pre-existing warnings)
```text
$ pnpm check
svelte-check found 0 errors and 4 warnings in 3 files
```
Warnings are pre-existing and unrelated to this change (ThemePlayground.svelte a11y_label_has_associated_control ×2, SearchBar.svelte state_referenced_locally, tsconfig.json missing `node` type definition).

**Build**: ✅ Passed
```text
$ pnpm build
vite v8.0.16 building ssr environment for production...
✓ 3819 modules transformed.
vite v8.0.16 building client environment for production...
✓ 3904 modules transformed.
✓ built in 16.74s
```

**Lint (biome)**: ✅ Clean on all 17 changed source/test files (0 errors).

**Coverage**: ➖ Not available (no coverage tool configured — `@vitest/coverage-*` not installed).

### Spec Compliance Matrix

#### Login Proxy (REQ-01)
| Scenario | Test | Result |
|----------|------|--------|
| Password never reaches the browser | `src/lib/server/ckan-auth.test.ts` > "mints a token and returns the resolved user"; `src/lib/server/auth-server.test.ts` > handleLogin 200 body | ✅ COMPLIANT |
| Valid credentials mint a JWT | `src/lib/server/ckan-auth.test.ts` > "mints a token..."; "uses the name resolved by user_show" | ✅ COMPLIANT |

#### Login Success (REQ-02)
| Scenario | Test | Result |
|----------|------|--------|
| Successful login | `src/lib/stores/auth.test.ts` > "login persiste token y user"; `src/lib/api/auth.test.ts` > login 200 (redirect to `/dashboard` verified in `+page.svelte`) | ✅ COMPLIANT |

#### Login Failure (REQ-03)
| Scenario | Test | Result |
|----------|------|--------|
| Bad credentials | `src/lib/api/auth.test.ts` > 401 AuthApiError; `src/lib/server/auth-server.test.ts` > 401 mapping; `src/lib/server/ckan-auth.test.ts` > INVALID_CREDENTIALS | ✅ COMPLIANT |

#### Login Rate Limiting (REQ-04)
| Scenario | Test | Result |
|----------|------|--------|
| Repeated failures throttled | `src/lib/server/auth-server.test.ts` > createRateLimiter + handleLogin 429 | ✅ COMPLIANT |

#### Session Persistence (REQ-05)
| Scenario | Test | Result |
|----------|------|--------|
| Reload restores session | `src/lib/stores/auth.test.ts` > "hidrata token y user desde localStorage al cargar" | ✅ COMPLIANT |

#### Logout (REQ-06)
| Scenario | Test | Result |
|----------|------|--------|
| Logout revokes and clears | `src/lib/server/ckan-auth.test.ts` > revokeToken; `src/lib/components/auth/UserMenu.test.ts` > "cierra sesión"; `src/lib/stores/auth.test.ts` > "logout limpia" | ✅ COMPLIANT |
| Revoke failure still clears client | `src/lib/server/ckan-auth.test.ts` > revokeToken best-effort (network + HTTP); `src/lib/api/auth.test.ts` > logout best-effort | ✅ COMPLIANT |

#### Header User Menu (REQ-07)
| Scenario | Test | Result |
|----------|------|--------|
| Authenticated header | `src/lib/components/auth/UserMenu.test.ts` > display_name; `src/routes/layout-header.test.ts` > "muestra el menú de usuario cuando hay sesión" | ✅ COMPLIANT |
| Anonymous header | `src/routes/layout-header.test.ts` > "muestra 'Iniciar Sesión' hacia /auth/login cuando anónimo" | ✅ COMPLIANT |

#### Dashboard Guard (REQ-08)
| Scenario | Test | Result |
|----------|------|--------|
| Anonymous access redirected | `src/routes/dashboard/dashboard.test.ts` > "redirige a /auth/login cuando no hay sesión" | ✅ COMPLIANT |
| Authenticated access | `src/routes/dashboard/dashboard.test.ts` > "renderiza el saludo... cuando hay sesión" | ✅ COMPLIANT |

#### Super Admin Flag (REQ-09)
| Scenario | Test | Result |
|----------|------|--------|
| Sysadmin user | `src/lib/stores/auth.test.ts` > "es true cuando user.sysadmin es true" | ✅ COMPLIANT |
| Non-sysadmin user | `src/lib/stores/auth.test.ts` > "es false aunque capacity sea 'admin'..." | ✅ COMPLIANT |

**Compliance summary**: 14/14 scenarios compliant, 9/9 requirements compliant.

### Prior Findings Resolution Confirmation
| # | Prior Finding | Status |
|---|---------------|--------|
| 1 | CRITICAL — "Anonymous header" scenario UNTESTED (no covering test for the anonymous `Iniciar Sesión` link) | ✅ Fixed — `src/routes/layout-header.test.ts` added (renders root layout anonymous state, asserts `Iniciar Sesión` link → `/auth/login`, plus authenticated state renders `UserMenu`). `src/test-setup.ts` gained a deterministic `window.matchMedia` stub required by the layout's `prefers-color-scheme` check. |

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Login Proxy | ✅ Implemented | `ckanLogin` (6-step flow) returns only `{ token, user }`; password used only in step-1 request body, never in any response. `+server.ts` returns `json(response.body)` (token + user only) |
| Login Success | ✅ Implemented | `+page.svelte` calls `apiLogin` → `auth.login(session.token, session.user)` → `goto(returnTo || "/dashboard")` |
| Login Failure | ✅ Implemented | `CkanAuthError(INVALID_CREDENTIALS)` → 401 `"Usuario o contraseña incorrectos"`; no token minted on failure |
| Login Rate Limiting | ✅ Implemented | In-memory `createRateLimiter` (5 attempts / 15 min) → 429 `"Demasiados intentos. Esperá un momento."` |
| Session Persistence | ✅ Implemented | `auth` store hydrates from localStorage on module load; persists on login/logout |
| Logout | ✅ Implemented | `UserMenu.handleLogout` → `logout(token)` (best-effort revoke) → `auth.logout()` clears store + localStorage |
| Header User Menu | ✅ Implemented | `+layout.svelte` renders `UserMenu` when `$isAuthenticated`, else `Iniciar Sesión` → `/auth/login` (desktop + mobile) |
| Dashboard Guard | ✅ Implemented | `+page.svelte` `onMount` redirects anonymous to `/auth/login`; content gated by `{#if $isAuthenticated}` |
| Super Admin Flag | ✅ Implemented | `isSuperAdmin = user?.sysadmin === true` (derived store), not `capacity` |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Auth mechanism: server proxy + token mint (A) | ✅ Yes | `ckan-auth.ts` 6-step flow via `+server.ts` proxy |
| Token storage: localStorage (A) | ✅ Yes | `src/lib/stores/auth.ts` persists to localStorage |
| Private env: `$env/dynamic/private` `CKAN_INTERNAL_URL` (A) | ✅ Yes | `env.CKAN_INTERNAL_URL || "http://localhost:5000"` in both `+server.ts` routes |
| Client token wiring: `getApiKey?: () => string \| null` (A) | ✅ Yes | `apiKey?: string \| (() => string \| null)`; `getCkanClient()` passes `apiKey: () => get(auth).token` |
| Superadmin: `user.sysadmin === true` (A) | ✅ Yes | `isSuperAdmin = $auth.user?.sysadmin === true` |
| UserMenu dropdown: small runes dropdown (A) | ✅ Yes | `UserMenu.svelte` (~88 lines, runes `$state`, no shadcn dropdown dependency) |
| Logout revoke: client POSTs token → server revokes (A) | ✅ Yes | `POST /auth/logout {token}` → `revokeToken` best-effort |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Found in apply-progress (WU1–WU5 tables) |
| All tasks have tests | ✅ | 21/21 tasks (structural/config tasks marked ➖ skipped legitimately) |
| RED confirmed (tests exist) | ✅ | All claimed test files exist in codebase |
| GREEN confirmed (tests pass) | ✅ | 87/87 tests pass on execution (full suite) |
| Triangulation adequate | ✅ | Multi-case coverage for store, 6-step flow, error mapping, rate limiter |
| Safety Net for modified files | ✅ | Baseline runs recorded across WU2–WU5 |

**TDD Compliance**: 6/6 checks passed

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 53 | 6 | vitest (mocked fetch) |
| Component/Integration (jsdom) | 10 | 3 | @testing-library/svelte + jsdom |
| E2E | 0 | 0 | not installed |
| **Total (this change)** | **63** | **9** | |
| Pre-existing (not part of change) | 24 | 4 | vitest |
| **Full suite** | **87** | **13** | |

### Changed File Coverage
Coverage analysis skipped — no coverage tool configured (`@vitest/coverage-*` not in devDependencies).

### Assertion Quality
✅ All assertions verify real behavior. No tautologies, no ghost loops, no mock-only assertions, and no smoke-only renders (every `render()` is followed by a behavioral assertion). The `layout-header.test.ts` anonymous test asserts both the accessible role/name and the exact `href="/auth/login"` value.

### Quality Metrics
**Linter (biome)**: ✅ No errors on 17 changed files
**Type Checker (svelte-check)**: ✅ 0 errors (4 pre-existing warnings in 3 files, unrelated to this change)

### Issues Found
**CRITICAL**: None

**WARNING**:
- 4 pre-existing svelte-check warnings (ThemePlayground.svelte a11y ×2, SearchBar.svelte state_referenced_locally, tsconfig.json `node` type def) — unrelated to this change.

**SUGGESTION**: None

### Verdict
**PASS** — 0 CRITICAL, 0 WARNING attributable to this change. All 21 tasks complete. 14/14 scenarios and 9/9 requirements compliant. 87/87 tests pass, build and type-check pass with exit 0. The prior CRITICAL (anonymous header) is resolved by `layout-header.test.ts`.

### Verification Scope Note
Live CKAN round-trip (real login against localhost:5000) remains deferred to manual/integration verification; unit verification is via mocked `fetch`.
