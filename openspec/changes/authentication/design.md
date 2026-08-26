# Design: Authentication

## Technical Approach

Add username/password login through a server-side SvelteKit proxy that runs the validated 6-step CKAN flow (web-login → `user_show` → CSRF token → `api_token_create`) and returns a JWT stored in localStorage. Zero CKAN/backend changes; frontend repo plus one compose env var. Authenticated `/api/...` calls attach `Authorization: <JWT>` client-side via the nginx/Vite proxy.

## Architecture Decisions

| Decision | Options | Trade-offs | Choice |
|---|---|---|---|
| Auth mechanism | Server proxy + token mint (A) vs custom ckanext action (B) vs web cookie only (C) | A: zero backend changes, validated live; 2 CSRF steps. B: 1 call but cross-repo rebuild. C: cross-origin, inviable. | A |
| Token storage | localStorage (A) vs HttpOnly cookie (B) | A: matches theme store, simple; XSS mitigated by revocable token + CSP. B: secure but forces routing all authed calls through SvelteKit. | A (B deferred) |
| Private env | `$env/dynamic/private` `CKAN_INTERNAL_URL` (A) vs `env.ts` (B) | A: runtime-injected by compose, server-only. B: `env.ts` is client-imported → leaks/build error. | A |
| Client token wiring | `getApiKey?: () => string \| null` resolver on client (A) vs rebuild singleton per token (B) | A: no stale cache, minimal change. B: extra subscription boilerplate. | A |
| Superadmin | `user.sysadmin === true` (A) vs `capacity` (B) | A: matches CKAN `user_show`. B: wrong (org role, not sysadmin). | A |
| UserMenu dropdown | Small runes dropdown (A) vs add shadcn dropdown-menu (B) | A: no new dep, ~30 lines, reuses Button + lucide. B: consistent kit but new dependency. | A |
| Logout revoke | Client POSTs token → server revokes (A) vs server reads token | A: token lives only in localStorage. B: impossible server-side. | A |

## Data Flow

```
Browser ──► +server.ts ──► CKAN
  POST /auth/login {u,p}
    (1) user/login → session cookie
    (2) user_show → resolved name
    (3) user/<name> → csrf_token
    (4) api_token_create → JWT
  ◄─ {token, user} → auth.login() → localStorage
GET /api/* + Authorization ──► nginx/Vite proxy ──► CKAN
Logout: POST /auth/logout {token} → revoke; client always clears localStorage
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/routes/auth/login/+page.svelte` | Create | Runes form (username/password), zod validation, loading/error, `goto(returnTo \|\| "/dashboard")` |
| `src/routes/auth/login/+server.ts` | Create | POST: in-memory rate limit, parse body, call helper, map errors to Spanish |
| `src/routes/auth/logout/+server.ts` | Create | POST: best-effort `api_token_revoke` |
| `src/routes/dashboard/+page.svelte` | Create | Minimal authed dashboard; client-side guard → `goto("/auth/login")` |
| `src/lib/server/ckan-auth.ts` | Create | 6-step flow (cookie jar, CSRF parse+fallback, mint) — testable, DI baseUrl |
| `src/lib/api/auth.ts` | Create | `login(username, password)`, `logout(token)` |
| `src/lib/schemas/auth.ts` | Create | zod: username required, password min length, Spanish messages |
| `src/lib/components/auth/UserMenu.svelte` | Create | Runes dropdown (display_name, Dashboard, Cerrar sesión) |
| `src/lib/stores/auth.ts` | Modify | localStorage persistence + hydration; `isSuperAdmin` → `user.sysadmin` |
| `src/lib/types/ckan.ts` | Modify | Add `sysadmin?`, `fullname?` |
| `src/lib/api/client.ts` | Modify | `ApiClientConfig.apiKey` accepts string \| getter |
| `src/lib/ckan.ts` | Modify | `getCkanClient()` passes `getApiKey: () => get(auth).token` |
| `src/routes/+layout.svelte` | Modify | Replace `{#if false}` block with conditional `UserMenu` (desktop+mobile) |
| `.env.example` | Modify | Add `CKAN_INTERNAL_URL` (server-only, runtime) |
| odp-docker compose (external) | Modify | `CKAN_INTERNAL_URL=http://ckan:5000` (prod) / `http://ckan-dev:5000` (dev) |

## Interfaces / Contracts

```typescript
// CkanUser additions
sysadmin?: boolean;
fullname?: string;

// ApiClientConfig: apiKey accepts a lazy resolver
apiKey?: string | (() => string | null);

// Proxy POST /auth/login
//   200 { token: string; user: CkanUser }
//   401 { error: "Usuario o contraseña incorrectos" }
//   429 { error: "Demasiados intentos. Esperá un momento." }
//   502 { error: "No se pudo conectar con CKAN." }
```

Cookie jar: extract `Set-Cookie` after step 1, replay as `Cookie` header. On 400 at step 4, re-GET `/user/<name>` and retry once.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | 6-step flow + cookie jar + CSRF fallback + error mapping | `server/ckan-auth.test.ts`, mock `fetch` per step |
| Unit | store persistence/hydration + `isSuperAdmin` | `stores/auth.test.ts`, jsdom localStorage, `auth.reset()` between tests |
| Unit | client `login`/`logout` wire correct endpoints | `api/auth.test.ts`, mock fetch |
| Unit | UserMenu renders name + logout action | `components/auth/UserMenu.test.ts` |
| Integration | `+server.ts` POST handler (rate limit, body parse) | import handler, mock helper |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration. Rollback: revert commit, remove `CKAN_INTERNAL_URL` from compose/`.env.example`, revoke minted tokens via `api_token_revoke` or CKAN UI.

## Open Questions

- [ ] Token accumulation on repeated login — dedupe via `api_token_list` now or defer?
- [ ] Recommend `ckan.auth.create_user_via_api=false` (RF-03 gap) as a separate CKAN change.
