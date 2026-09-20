# v0 — Portal honesty

**Feature.** The portal must stop reporting *absence* where there was a *failure*. Four `v0` defects
share that root: a failed authorization or a dead session is rendered as "you have nothing" and, worse,
as "you lack permissions".

**Why now.** Measured 2026-09-17 against the running stack: all four defects are live, and two
compositions of them are what break the `v0` exit criterion — not the missing publication lifecycle.

| # | Defect | Evidence |
|---|---|---|
| D1 | "Mis datasets" is broken for every non-sysadmin, **including their own** private datasets | `ckan/logic/action/get.py:141-144` → `'include_private': authz.is_sysadmin(user)`, unconditional; portal call `src/lib/api/datasets.ts:84`; live: anonymous `package_search?include_private=true` → 16, same as without the flag |
| D1b | **New, found by the A1 probe.** The same call silently **truncates to 10 rows**: the portal sends no `limit`, so `package_search` falls back to its default `rows=10`. Nobody is told | A1 probe: `current_package_list_with_resources` → `n=10` while the same user's private-aware count is **17** |
| D2 | A dead session degrades to anonymous **silently** | live: invalid token → `{"success": true, "result": []}`, byte-identical to anonymous |
| D3 | "Publicar dataset" is offered to a user with no organization | `dashboard/+page.svelte:86-92` (unconditional action array); empty-state CTA gated on `datasets.length === 0`, not on organizations. The wizard does fail honestly (`datasets/new/+page.svelte:706-711`) |
| D4 | A `403` is shown as "Recurso no encontrado" | `dataset/[id]/resource/[resourceId]/+page.svelte:75-88` (DEV mock fallback, then a generic throw) rendered under the 404-labelled state at `:287-291` |

**Compounds (the reason this is one feature, not four tickets).**
- D2 × D3: with a dead token the wizard says *"Necesita rol de editor en una organización… Solicite a un
  administrador"*. A user with full permissions is told to ask for permissions — a **false diagnosis**.
- D1 × D3: the wizard creates every dataset `private: true`, D1 hides private datasets from
  non-sysadmins, and nothing can be published yet — so the empty state and its dead-end CTA fire
  **always**, even for a user with many datasets.
- D1 × D1b: the listing is both **incomplete and capped**. Fixing the permissions without an explicit
  `rows` would trade "shows nothing" for "shows the first ten, silently".

**Ordering constraint.** D3 must be fixed **after** D2. Gating the CTA on `organizations.length > 0`
while a dead session still returns `[]` would **hide** the CTA from a user who is entitled to it. The
correct guard is "organizations loaded **and** session valid".

---

## Slice A — D1: "Mis datasets" respects the caller's permissions

Branch `feat/v0-portal-honesty`. One repository (`odp`). No dependency on B or C.

- [x] **A1 · Probe — DONE (2026-09-17).** With a real non-sysadmin token: the current action hides a
  private dataset the caller **may** read (`package_show` → `200`, the control), while
  `package_search {include_private: true}` returns it. Transcript in the evidence log.
- [x] **A2 · Probe, pre-RED — DONE (2026-09-17).** Is "datasets I created" expressible? **Yes**: CKAN
  populates `creator_user_id` on create, `user_show {}` returns the caller's own id, and
  `fq=creator_user_id:<me>` filters correctly — but **only together with `include_private`**.
- [x] **A3 · RED — data layer.** Tests fixing the contract of the portal's "my datasets" call. It must
  (a) filter by creator with the **canonical CKAN condition** — `fq=+creator_user_id:<own id>`, the `+`
  included, because it is a required clause; (b) pass `include_private: true` under CKAN's own rule,
  `sysadmin or requester == the account` (the caller *is* the account here, so it holds); (c) carry
  `rows`/`start` (D1b: the silent 10-row cap) **and pin an explicit `sort`** — measured: with no sort the
  order is Solr's, and consecutive pages returned disjoint, out-of-order sets; (d) expose
  `.result.count` as the total for an honest page indicator. Must fail against today's implementation.
  **Drafts**: CKAN's own dashboard also passes `include_drafts: true`. The portal creates none, so this
  slice does not; record the difference rather than copy it blindly.
- [x] **A4 · GREEN — data layer.** Replace `currentUser()` in `src/lib/api/datasets.ts:84` with that
  query, plus the one call that resolves the caller's own id (`user_show {}` returns the caller).
  Adapt the return shape to carry items and count. `user_show {include_datasets: true}` is **not** used:
  it caps at `rows: 50` and returns no count, so it cannot paginate honestly — it is the **oracle** the
  tests check against. **Work unit 1.**
- [x] **A5 · Pagination UI + copy.** Real pagination — the 2026-09-17 decision; a high cap with a counter
  was rejected as still silent. Copy must match what the card lists: **the datasets the user created**.
  Today it promises "datasets que pueda editar", which is the *future* model (collaborators and teams,
  `RF-18`/`RF-19`; see `BACKLOG.md`). **Work unit 2.**
  **DONE (2026-09-19):** the promoted variant is **V3 compact range**, **20 per page**, **badge = total**
  — the author's choices after reviewing the three variants in the playground. Copy corrected to «Los
  datasets que usted creó.»; the playground was deleted on promotion.
- [x] **A6 · Gates.** `pnpm test`, `pnpm check`, `pnpm lint` clean.
  **Final state (2026-09-19):** **316 tests passing**; `pnpm check` 0 errors; Biome clean on the changed
  files; the repo baseline unchanged at **108 files / 4 warnings / 7 infos**.
- [x] **A7 · Live verification.** Through the real portal path against the running stack, with a fixture
  that has created datasets: the card lists the creator's own private datasets, and count and paging are
  honest.
  **DONE (2026-09-19):** the author looked at the real portal with **42 datasets** and 3 pages — 25
  temporary datasets were seeded (created by the author's own user) so the pagination footer would
  appear, then purged. It is **not recorded** whether the author clicked the pagination arrows.
- [x] **A8 · Work-unit commits** on `feat/v0-portal-honesty`, one per work unit, tests beside their code.
  **DONE (2026-09-19):** `33158ee` (work unit 1 code), `c959285` (work unit 1 docs), `7d27547` (work unit
  2). All three are **unpushed**.

## Slice A — decisions recorded

Author's decisions, 2026-09-19:

- **Pagination variant V3** (compact range).
- **20 rows per page.**
- **Badge shows the total**, not the page length.
- **Sort stays `metadata_modified desc`** — the alternatives were measured and rejected.
- **The footer is hidden when a load fails**: a range beside an error panel would describe rows that are
  not on screen.

## Slice B — D2 + D3: the portal knows whether the session is alive

**The measurement is closed (2026-09-20); full transcript in the evidence log**, entry «B1 · probe before
the RED test». Measured through the dev proxy the browser actually uses
(`http://localhost:8082/api/3/action`):

| Caller | `user_show {}` | `organization_list_for_user {permission:create_dataset}` |
|---|---|---|
| no token / expired / revoked / garbage | **404** `Not Found Error` | **200 `[]`** |
| valid non-sysadmin, with organizations | **200** + the caller | `200` + the organization |
| valid non-sysadmin, **without** organizations | **200** + the caller | `200 []` |
| valid sysadmin | 200 + the caller | 200 + the organization |

- **The signal is a 404 and it is unambiguous.** `user_show {}` carries no id, so no resource can be
  missing; and the dashboard only renders when the store holds a token. `200` = alive, `404` with a token
  present = dead. **No 401 and no 403 exist for this condition.**
- **`user_show {id: <someone>}` cannot be the probe**: it answers `200` to an anonymous caller.
- **No new CKAN surface**: `user_show` is the action the login flow already uses to resolve the caller.
- **The D2 × D3 compound is confirmed at the source**: an expired token and an anonymous caller get the
  *identical* `200 []` from `organization_list_for_user`, which is the `[]` the wizard turns into
  «Necesita rol de editor… Solicite a un administrador». A **live** user with no organizations also gets
  `[]` — correct for them — so only the probe tells the two apart.
- **Extra finding (D1 × D2), not previously recorded**: `package_search {include_private:true}` answers
  count **17** with a live editor token and **16** with that same token revoked. A dead session makes
  «Mis datasets» report a **plausible, wrong total with no error** — the honest counter slice A delivered
  depends on a live session. With the slice A `fq=+creator_user_id:<me>` the same case returns 0, which is
  exactly the false empty state this feature exists to kill.

**Decisions (author, 2026-09-20)**:

1. **A dead session is cleared, then redirected**: `auth.invalidate()` (local clear, no server revoke) and
   then `/auth/login?returnTo=/dashboard&expired=1`, where the login screen shows the notice. Same shape as
   the existing Dashboard Guard, which redirects instead of blocking.
2. **The slice also fixes the wizard's false diagnosis**, as its own work unit, because that is where the
   compound produces the false permissions message.
3. **The UI is proposed in a playground first** (`AGENTS.md` rule 8), then promoted and deleted.
4. **One commit per work unit**, tests and docs beside their code, on `feat/v0-portal-honesty`.

**Ordering trap, read in the code**: `src/routes/auth/login/+page.svelte:20-23` sends a viewer holding a
 token straight back to `/dashboard`. Navigating to the login screen **before** clearing the dead session
 produces a redirect loop. Clearing first, navigation second.

**Task list:**

- [ ] **B1 · The session probe** (`src/lib/api/`): one function reporting three states — `alive` (200, with
  the caller), `dead` (404 `Not Found Error`), **`inconclusive`** (5xx, timeout, network failure). **Only a
  definite 404 closes a session**: a CKAN hiccup must never expel a signed-in user. Tests first.
- [ ] **B2 · Store — one condition, one message**: `auth.invalidate()` beside `logout()` (which revokes on
  the server and is useless with a dead token). Absorb the component-local throw at
  `routes/dashboard/+page.svelte:67` into that single condition, so one condition never has two messages.
- [ ] **B3 · Playground** (`/dev/dashboard/...`): the action grid, the sticky bar, both empty states and the
  login notice, with a switcher for (a) live session with organizations, (b) live session without, (c)
  still loading, (d) dead session. Author reviews, we iterate, then promote and delete.
- [ ] **B4 · Dashboard — probe before the gate (D2)**: probe on mount, before any decision. Dead → clear,
  then navigate. Alive → the caller the probe returned **is** the identity, and the `!userId` throw goes away.
- [ ] **B5 · Dashboard — the CTA (D3)**: the action grid and the sticky bar share one condition,
  «organizations loaded and non-empty». The organizations empty state keeps its copy, which only becomes
  true once the session is known to be alive.
- [ ] **B6 · Login — the notice**: reuse the existing `role="alert"` block; «Su sesión expiró o dejó de ser
  válida. Inicie sesión nuevamente.»
- [ ] **B7 · Wizard — the false diagnosis**: the same probe, so a dead session no longer reads as «ask an
  administrator for a role».
- [ ] **B8 · Spec extension (a real contract change)**: `openspec/specs/authentication/spec.md` has nine
  requirements — Login Proxy, Success, Failure, Rate Limiting, **Session Persistence**, Logout, Header User
  Menu, Dashboard Guard, Super Admin Flag — and **none covers an invalid or expired token**. Add one, with
  scenarios: a dead token on an authenticated screen clears the session and forces re-login; **an
  unavailable CKAN is not an invalid session**; a valid session is left alone.
- [ ] **B9 · Gates and live verification**: `pnpm test`, `pnpm check`, `pnpm lint`, plus the live check —
  revoke the token in CKAN, reload the dashboard, watch the re-login happen.
- [ ] **B10 · Work-unit commits.**

## Slice C — D4: honest status-to-message mapping

Pending. Map the failure by status (`403` → permission/no-session; `404` → does not exist) and remove the
DEV mock fallback that masks an authorization failure. Implement it as a **reusable helper**: this is the
`Distinguishable Authorization Errors` requirement the publication-lifecycle spec already wrote, and
slice B will want the same mapping.

## Review disposition (2026-09-19)

After the two work-unit lineages were approved and acknowledged, a third target appeared covering the
**accumulated branch** (`b28757c..HEAD`, the same 9 paths); it was **inspected and deliberately not
started**. Three reasons: the only content not already covered is two documentation bullets in
`BACKLOG.md`, which is the contract's own "trivial passive documentation-only edit" exemption; the
governing guidance says the accumulated feature branch is **never** the review candidate; and
re-covering content approved the same day is the waste this repository already documented. **Nothing was
created and nothing was burned**; if the author wanted a branch-level receipt before pushing, the cycle
is cheap and can be run on request. The author reviewed this decision and confirmed it as correct.

---

## Evidence log

**A1 — probe (2026-09-17), PASS — the assumption holds and the defect is real.**
Fixture: a fresh `editor` in `direccion-investigacion` (the organization that owns the private dataset
`test`) with its own token. Created and removed inside the probe.

```
baseline  anonymous count = 16
S1..S4  user_create / organization_show / member_create editor / api_token_create   all 200
M1  package_show test                  -> 200   private=true    (CONTROL: the user MAY read it)
M2  current_package_list_with_resources-> ABSENT  n=10          (D1 and D1b, live)
M3  package_search include_private=true-> PRESENT n=17          (THE FIX DIRECTION WORKS)
M4  package_search (no flag)           -> ABSENT  n=16
M5  organization_list_for_user (valid) -> ['direccion-investigacion']
M6  private-aware count for the editor = 17
cleanup: token revoked (0 left), member_delete 200, user_delete 200, anonymous count back to 16
```

- **M1 makes M2 a defect rather than correct behaviour**: the user is authorized to read `test` and the
  portal's own listing hides it.
- **M3 confirms the unverified assumption**: `package_search {include_private: true}` returns the
  private dataset to the caller who may read it. The fix direction is measured, not assumed.
- **M5 is the baseline slice B needs**: a *valid* non-sysadmin token **does** report its organization,
  while a dead one answers `[]` byte-identically to anonymous. A session probe is viable.
- **M2's `n=10` against M6's `17` is D1b**: the silent truncation, found by accident because the two
  numbers disagreed.
- **Residual**: CKAN 2.11.6 exposes no user hard-delete, so the probe user survives as a
  `state='deleted'` row — the same residual `probe.sh` documents. Everything else was removed and the
  anonymous catalogue count returned to its baseline.

**A2 · probe before the RED test (2026-09-17), PASS — the chosen contract is implementable.**

The decision (author, 2026-09-17) is that the card lists **only the datasets the caller created**; the
editor/steward model over collaborators and teams is future work. That choice had been flagged in this
document as *risky* — CKAN's creator data was assumed unreliable. **The measurement refutes the
warning**: the risk was about `author`, which is free text; the reliable column is `creator_user_id`.

```
C1  package_create as the editor (private:true) -> 200
C2/C4  creator_user_id populated on create, equal to the user's id -> YES
U1  user_show {} with the caller's own token -> 200, returns the caller (id and name)
F1  fq=creator_user_id:<me> include_private=true -> PRESENT n=1   (the query works)
F2  fq=creator_user_id:<me> (no flag)           -> ABSENT  n=0   (BOTH pieces are required)
F3  fq=creator_user_id:<ckan_admin> -> count=17  (inconclusive as a control: the admin created everything)
F4  fq=creator_user_id:<nobody>     -> count=0   (the real control: an ignored fq would answer 17)
cleanup: package_delete 200 · purge · tokens 0 · member_delete 200 · user_delete 200 · anon 16 · dataset 404
```

- **F2 is the trap the test must encode**: filter by creator alone is not enough, because the caller's own
  dataset is private.
- **F4, not F3, is the control.** F3 cannot prove anything about permissions here, and must not be cited
  as if it did.
- The query shape for the fix:
  `package_search {q: "", include_private: true, fq: "creator_user_id:<own id>", rows: N, start: offset}`,
  with `.result.count` driving the honest page indicator.

**A3 · probe before the RED test (2026-09-17), PASS — the differential is closed and the query is
validated against CKAN itself.**

The author asked whether the defect might be an artifact of every dataset having been created by
`ckan_admin`. Legitimate question; the probe settles it by holding the catalogue constant and varying
only the caller's sysadmin flag.

```
fixture: an editor in direccion-investigacion, who then CREATES three private datasets

PART 1 — same catalogue, same action, same moment
S1  as sysadmin -> the 3 created datasets PRESENT, `test` PRESENT   (n=10)
S2  as editor   -> the 3 created datasets ABSENT,  `test` ABSENT    (n=10)

PART 2 — my hand-rolled query vs CKAN's own dashboard action
Q1  package_search fq=+creator_user_id:<me> include_private=true -> n=3 count=3
Q2  user_show {include_datasets:true} as itself (CKAN's dashboard) -> n=3, IDENTICAL SET
Q3  user_show {id:<editor>, include_datasets:true} as sysadmin    -> n=3, IDENTICAL SET

PART 3 — pagination
P1  rows=2 start=0 -> n=2 count=3
P2  rows=2 start=2 -> n=1 count=3

cleanup: 3× package_delete 200 + purge · tokens 0 · member_delete 200 · user_delete 200 ·
         anonymous count back to 16 · all three datasets answer 404
```

- **PART 1 closes the author's doubt with measurement**: the only variable is the caller's sysadmin flag,
  so the defect is about *who asks*, never about *who created*. It also explains why the author never saw
  it: their own account is a sysadmin.
- **PART 2 is the strongest check available**: the query the fix will send returns **exactly** the set
  CKAN's own dashboard returns, from two independent canonical paths. The fix mirrors CKAN instead of
  inventing semantics.
- **PART 3 confirms the contract** for `rows`/`start` + total count — and exposes a trap: with no `sort`,
  `start=0` returned `ds2, ds3` and `start=2` returned `ds1`. Pages are disjoint and out of creation
  order, so **a `sort` must be pinned** or paging can repeat or skip rows.
- **Q2/Q3 confirm why `user_show` cannot be the data layer**: same 3 datasets, `(no count field)`.

**A3–A6 · implementation and independent verification (2026-09-17).**

The contract test was written by the parent and then **left untouched**: the diff is 83 insertions, **0
deletions**. The implementation was written by a delegated worker (ODD's multi-file write rule put
`src/lib/types/api.ts`, `src/lib/api/datasets.ts` and the dashboard call site out of the parent's hands).

```
pnpm exec vitest run src/lib/api/datasets.test.ts          13 passed (13)
pnpm test                                  30 files, 309 passed, 0 failed
pnpm check                                 0 errors, 4 pre-existing warnings
Biome over the 5 changed files             5 files, exit 0, no fixes
Biome over the repo                        108 files, exit 0, 4 warnings, 7 infos  (baseline unchanged)
```

**An independent read-only verifier confirmed the implementation and refuted one sub-claim**, then found
three weaknesses. All three are closed:

1. **A new user-facing string did reach the screen** — `"No se pudo identificar al usuario autenticado."`,
   rendered by the existing error state at `+page.svelte:284`. The claim "no other copy was added" was
   imprecise. Kept, because it replaces a silent failure with an honest one, and it is inside the case the
   auth guard should make unreachable. **Recorded for slice B**: this path and the session-validity check
   are the same problem, and slice B should absorb it instead of leaving two messages for one condition.
2. **The paging test asserted too little**: `expect(params.sort).toBeTruthy()` passes for any non-empty
   string, so a bogus order would slip through while the comment claimed a stability rationale. Now pinned
   to the exact value, `"metadata_modified desc"`.
3. **The "total" test was largely tautological**: the mock resolved `{count, results}` and the old code
   forwarded that object, so the `count`/`results` assertions passed on the *old* implementation too. The
   test now pins the explicit request defaults (`rows: 20`, `start: 0`) as the **load-bearing** assertions
   and labels the `count`/`results` pair **documentary** in the comment, so nobody can delete the
   request-shape assertions and leave a hollow test. It cannot be made fully falsifiable without touching
   production code, and that is now stated rather than hidden.

**A real coverage gap the verifier found, now closed**: the dashboard suite would have passed even if the
loader called `currentUser()` **without** an id — and the identity is exactly what this work unit fixes. A
test now asserts the API is called with the authenticated user's id. Each new assertion was shown to fail
by a mutation probe (three mutations, exactly three failures, reverted with no residue).

**Gate caveat, stated plainly**: `pnpm lint` could **not** produce a verdict in this environment today —
exit 254 with `Linter process terminated abnormally`. It is not caused by these changes: Biome cannot even
start (`biome --version` fails the same way) and fails identically on files nobody touched. The same gate
passed 11/11 earlier today on an idle machine. The evidence above comes from invoking the same Biome binary
and config **directly** (the ELF, not the Node launcher), which is what makes the repo-wide baseline
checkable at all. So: the changed files are clean, the repo baseline is unchanged, and the npm-script path
remains unverified until the machine is idle.

**B1 · probe before the RED test (2026-09-20), PASS — the slice's open question is answered, and the answer
is not the one the document guessed.**

What had to be measured: **can the portal tell a dead session from an anonymous caller?** The document
previously guessed `403` for a dead token. **There is no 403 anywhere in this condition.**

Method: four probe rounds (scripts in `/tmp/probe_sliceB*.sh`, not in the repository) against the running
`odp-dev` stack through the dev proxy, which is the same path the browser uses —
`http://localhost:8082/api/3/action` — plus a sysadmin token minted inside the container with
`ckan -c /srv/app/ckan.ini user token add ckan_admin <name> expires_in=1 unit=86400 -q`.

```
                                                     user_show {}   org_list_for_user{create_dataset}
no token         (anonymous)                         404 Not Found  200 []
expired token    (exp in the past)                   404 Not Found  200 []
revoked token    (api_token_revoke)                 404 Not Found  200 []
garbage token    ("not-a-token", truncated JWT)      404 Not Found  200 []
VALID non-sysadmin, editor in an organization        200 + caller   200 [direccion-investigacion]
VALID non-sysadmin, no organizations                 200 + caller   200 []
VALID sysadmin                                       200 + caller   200 [direccion-investigacion]
public control   expired token on status_show         200 (public reads give nothing away)
```

And the D1 × D2 measurement the document did not ask for:

```
package_search {include_private:true}  VALID editor -> count 17
                                       REVOKED same token -> count 16
```

- **`user_show {}` is the probe**, and it needs no new permission surface: the login flow already calls it
  (`src/lib/server/ckan-auth.ts`) to resolve the caller. It carries no id, so a 404 there cannot mean
  "missing resource"; and the dashboard renders only with a token in `localStorage`, so "token present and
  404" is unambiguous. `user_show {id: X}` was rejected as a candidate: it answers 200 to an anonymous
  caller.
- **The `` `403` `` guess in the earlier revision of this document is refuted.** Any design that maps
  `404 → does not exist` (slice C, D4) must exclude this probe explicitly, or it will read "your session
  died" as "the resource is missing".
- **The dead session's `200 []` is byte-identical to a live user with no organizations** — the compound
  D2 × D3, measured rather than inferred. The wizard's «Solicite a un administrador» is therefore a false
  diagnosis for exactly the case in which the user needs no permission at all.
- **A live session is required for slice A's own honesty**: with the token revoked, the counter drops by the
  private dataset (17 → 16) with no error at all.
- **Fixture discipline**: a non-sysadmin fixture user was created, granted editor in
  `direccion-investigacion`, given a token, measured, and removed (`user_create` · `member_create` ·
  `api_token_create {expires_in:1, unit:86400}` · `api_token_revoke` · `member_delete` · `user_delete`). In
  this CKAN `expires_in` and `unit` are **mandatory** on `api_token_create` — both in the CLI and in the
  action — and `unit` is seconds, so `expires_in:1 unit:1` mints a token that dies in one second, which is
  how the expired case was produced.
- **Residual, stated rather than hidden**: the three fixture users survive as `state='deleted'` rows, the
  same residual `probe.sh` documents (CKAN 2.11.6 exposes no user hard-delete). Their tokens were revoked;
  the sysadmin probe token was revoked as well. The catalogue was left intact: **16 public + 1 private**.
- **Loop trap recorded**: with a dead token still in the store, navigating to `/auth/login` bounces back to
  `/dashboard` (`auth/login/+page.svelte:20-23`), so clearing must precede navigation.
