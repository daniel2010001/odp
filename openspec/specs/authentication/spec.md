# Authentication Specification

## Purpose

Define username/password login against CKAN via a SvelteKit server proxy, plus JWT storage, revocation, header menu, and dashboard guard. The password stays server-side; the browser stores only a revocable CKAN JWT. Bound to `/auth/login`, `/auth/logout`, `/dashboard`, and `src/lib/stores/auth.ts`.

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
