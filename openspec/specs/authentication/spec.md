# Authentication Specification

## Purpose

Define username/password login against CKAN via a SvelteKit server proxy, plus JWT storage, revocation, session validity, header menu, and dashboard guard. The password stays server-side; the browser stores only a revocable CKAN JWT. Bound to `/auth/login`, `/auth/logout`, `/dashboard`, and `src/lib/stores/auth.ts`.

## Requirements

### Requirement: Login Proxy

The `/auth/login` endpoint MUST authenticate against CKAN and mint a token server-side. The password MUST NEVER reach the browser.

#### Scenario: Password never reaches the browser

- GIVEN a user submits credentials
- WHEN the proxy completes the login flow
- THEN the response contains only a JWT and the resolved user
- AND the password is absent from any response

#### Scenario: Valid credentials mint a JWT

- GIVEN valid CKAN credentials
- WHEN the user submits the login form
- THEN the server mints a JWT via `api_token_create`
- AND returns both to the client

### Requirement: Login Success

On successful authentication, the client MUST persist the session and redirect to the dashboard.

#### Scenario: Successful login

- GIVEN valid CKAN credentials
- WHEN the user submits the login form
- THEN the auth store holds the token and user
- AND the user is redirected to `/dashboard`

### Requirement: Login Failure

On failed authentication, the login page MUST show a Spanish error and MUST NOT mint or store a token.

#### Scenario: Bad credentials

- GIVEN invalid CKAN credentials
- WHEN the user submits the login form
- THEN the page shows "Usuario o contraseña incorrectos" in Spanish
- AND no token is minted or stored

### Requirement: Login Rate Limiting

The `/auth/login` endpoint MUST limit repeated attempts from one source to mitigate brute-force attacks.

#### Scenario: Repeated failures throttled

- GIVEN many failed login attempts from one source
- WHEN that source exceeds the attempt limit
- THEN further attempts are rejected with a throttling response

### Requirement: Session Persistence

The auth session MUST persist across reloads using localStorage.

#### Scenario: Reload restores session

- GIVEN an authenticated session with a stored JWT and user
- WHEN the user reloads the page
- THEN the auth store rehydrates the token and user from localStorage

### Requirement: Invalid Session Detection

A stored token is evidence of a past login, never of a live session. An authenticated screen MUST verify that CKAN still accepts it before rendering anything derived from it, and an invalid session MUST force a re-login rather than degrade into an empty or permissionless view. CKAN does not report this condition as an authentication status: measured 2026-09-20, `organization_list_for_user` answers `200` with an empty list both for a dead token and for an anonymous caller, so degraded data is indistinguishable from "you have nothing" — and from "you lack permissions" — without a check.

The check MUST be the authenticated action `user_show` **without `id`**: it answers `200` with the caller for a live token and `404` for an expired, revoked, or unknown one. Any other outcome (a `5xx`, a timeout, an unreachable host) describes the server or the transport, not the token, and MUST NOT be read as an invalid session. The stored session MUST be cleared **before** navigating away, because the login screen redirects a viewer that still holds a token back to the dashboard.

#### Scenario: Dead session forces re-login

- GIVEN a stored session whose token CKAN no longer accepts
- WHEN an authenticated screen mounts
- THEN the stored session is cleared before any navigation
- AND the viewer lands on `/auth/login` carrying the reason and the original destination
- AND nothing derived from the dead session is rendered

#### Scenario: Unavailable CKAN is not an invalid session

- GIVEN a stored session and a CKAN that answers `5xx`, times out, or is unreachable
- WHEN an authenticated screen mounts
- THEN the stored session is left untouched
- AND the viewer is not sent to the login screen

#### Scenario: A valid session passes the check

- GIVEN a stored session whose token CKAN still accepts
- WHEN an authenticated screen mounts
- THEN the session is kept
- AND the user CKAN returns replaces the stored one as the identity the screen acts on

#### Scenario: Expired notice on the login screen

- GIVEN the login screen was reached because the session was found invalid
- WHEN the login screen renders
- THEN it shows one notice in Spanish saying the session is no longer valid, together with the existing login errors in a single alert
- AND submitting the form replaces that notice with the outcome of the attempt

### Requirement: Logout

Logout MUST revoke the CKAN token server-side and clear the client session.

#### Scenario: Logout revokes and clears

- GIVEN an authenticated session
- WHEN the user triggers logout
- THEN the server revokes the JWT via `api_token_revoke`
- AND the client clears localStorage and the auth store

#### Scenario: Revoke failure still clears client

- GIVEN an authenticated session while CKAN is unreachable
- WHEN the user triggers logout
- THEN the client clears localStorage and the auth store regardless of the revoke outcome

### Requirement: Header User Menu

The header MUST render a user menu when authenticated and an "Iniciar Sesión" action when anonymous.

#### Scenario: Authenticated header

- GIVEN an authenticated session
- WHEN the header renders
- THEN it shows the user's display name and dashboard/logout actions

#### Scenario: Anonymous header

- GIVEN no authenticated session
- WHEN the header renders
- THEN it shows the "Iniciar Sesión" link to `/auth/login`

### Requirement: Dashboard Guard

The `/dashboard` route MUST be restricted to authenticated users.

#### Scenario: Anonymous access redirected

- GIVEN an anonymous user
- WHEN the user navigates to `/dashboard`
- THEN the user is redirected to `/auth/login`

#### Scenario: Authenticated access

- GIVEN an authenticated user
- WHEN the user navigates to `/dashboard`
- THEN the dashboard renders

### Requirement: Super Admin Flag

The `isSuperAdmin` derived store MUST reflect CKAN's `sysadmin` boolean on the user, not the `capacity` field.

#### Scenario: Sysadmin user

- GIVEN a user whose CKAN record has `sysadmin: true`
- WHEN the auth store holds that user
- THEN `isSuperAdmin` is `true`

#### Scenario: Non-sysadmin user

- GIVEN a user whose CKAN record has `sysadmin: false`
- WHEN the auth store holds that user
- THEN `isSuperAdmin` is `false`
