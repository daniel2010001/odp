# Proposal: Authentication

## Intent

The portal cannot identify users: the header shows a placeholder "Iniciar Sesión" and no authenticated routes exist. Publishers and admins need login to manage datasets and see a dashboard. This change adds username/password login via a server-side SvelteKit proxy that authenticates against CKAN and mints an API token (JWT) for the frontend.

## Scope

### In Scope
- Login page `/auth/login` (username + password)
- Server proxy `+server.ts` executing the validated 6-step CKAN flow
- Logout (server-side token revoke + client cleanup)
- Session persistence in localStorage
- Header user menu replacing the "Iniciar Sesión" placeholder
- Minimal authenticated dashboard `/dashboard`

### Non-Goals
- Public self-registration (PRD RF-03 — users created by admin only)
- Password reset / recovery
- HttpOnly-cookie routing of all authenticated calls — future hardening
- Token expiration (no `expire_api_token` plugin in CKAN)

## Capabilities

### New Capabilities
- `authentication`: username/password login against CKAN, JWT mint/storage/revoke, session persistence, header user menu, authenticated dashboard.

### Modified Capabilities
- None

## Approach

Server-side proxy (validated live against CKAN 2.11.5):

1. Login form-encoded to `user/login` (`redirect: manual`) → session cookie
2. `user_show` with cookie → resolved `name`
3. Fetch `user/<name>` → parse `_csrf_token`
4. `api_token_create` (cookie + `X-CSRFToken`) → JWT
5. Browser stores JWT; `Authorization` on `/api/...`
6. Logout: `api_token_revoke` + clear localStorage

| Area | Impact | Description |
|------|--------|-------------|
| `src/routes/auth/login/+page.svelte` | New | Login form (Spanish, voseo) |
| `src/routes/auth/login/+server.ts` | New | Proxy: 6-step flow |
| `src/routes/auth/logout/+server.ts` | New | Revoke + redirect |
| `src/routes/dashboard/+page.svelte` | New | Minimal dashboard |
| `src/lib/api/auth.ts` | New | Client auth API |
| `src/lib/schemas/auth.ts` | New | Zod login schema |
| `src/lib/components/auth/UserMenu.svelte` | New | Header user menu |
| `src/lib/stores/auth.ts` | Modified | localStorage persistence; `isSuperAdmin` → `user.sysadmin` |
| `src/lib/types/ckan.ts` | Modified | Add `sysadmin?`, `fullname?` |
| `src/lib/ckan.ts` | Modified | Wire token into client |
| `src/routes/+layout.svelte` | Modified | Conditional `UserMenu` |
| `.env.example` + odp-docker compose | Modified | `CKAN_INTERNAL_URL` env |

## Assumptions

- Token name `Portal Datos UMSS` (user-managed in CKAN profile)
- JWT in localStorage (matches theme store); XSS mitigated by revocable token + no `{@html}`; HttpOnly cookie deferred
- In-memory rate limiting on login `+server.ts` (brute-force)
- Auth client-only; header hydrates post-mount; `/dashboard` guarded client-side

## Rollback Plan

Frontend-only change. Revert commit; remove `CKAN_INTERNAL_URL` from compose and `.env.example`; revoke minted tokens via `api_token_revoke` or CKAN UI. No CKAN schema or backend changes.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| CKAN login CSRF re-enabled later | Low | Fallback: GET form + token |
| Token accumulation on repeated login | Med | `api_token_list` + revoke prior |
| XSS (token in localStorage) | Med | CSP; never render user HTML |
| `api_token_revoke` fails if CKAN down | Low | Client always clears localStorage |

## Success Criteria

- [ ] Valid creds mint JWT and render user menu
- [ ] Bad creds show Spanish error, no token minted
- [ ] Logout revokes token and clears localStorage
- [ ] Session persists across reloads
- [ ] `isSuperAdmin` reflects `sysadmin`
