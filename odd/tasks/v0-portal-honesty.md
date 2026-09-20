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

1. **A dead session is cleared, then redirected**: the stored session is dropped locally and the browser
   goes to `/auth/login?returnTo=/dashboard&expired=1`, where the login screen shows the notice. Same shape
   as the existing Dashboard Guard, which redirects instead of blocking.

   **Correction (2026-09-20), after reading the store:** this plan first named a new `auth.invalidate()`
   beside `logout()` and described `logout()` as revoking on the server. That is wrong about the code:
   `stores/auth.ts` `logout()` only clears state and `localStorage`, and the server-side revoke is a
   separate call (`logout(token)` from `UserMenu.svelte`). A second method with an identical body would be
   duplication, so the unit adds **no** store method; the intent lives in the caller and in the URL.
2. **The slice also fixes the wizard's false diagnosis**, as its own work unit, because that is where the
   compound produces the false permissions message.
3. **The UI is proposed in a playground first** (`AGENTS.md` rule 8), then promoted and deleted.
4. **One commit per work unit**, tests and docs beside their code, on `feat/v0-portal-honesty`.

**Ordering trap, read in the code**: `src/routes/auth/login/+page.svelte:20-23` sends a viewer holding a
 token straight back to `/dashboard`. Navigating to the login screen **before** clearing the dead session
 produces a redirect loop. Clearing first, navigation second.

**Task list (all closed 2026-09-20):**

- [x] **B1 · The session probe** (`src/lib/api/session.ts`, 9 tests) — **`5d51452`**. Three states: `alive`
  (200 + the caller), `dead` (the measured 404), `inconclusive` (5xx, 403, timeout, network, non-JSON). Only a
  definite 404 closes a session.
- [x] **B2 · One condition, one message** (`src/lib/session.ts`, 2 tests) — **`63d0b35`**. The single expiry text,
  the URL parameter and the re-login URL. **No store method**: `logout()` already clears locally and never calls
  the server, so `invalidate()` would have been a duplicate body — a correction to this plan, recorded above.
- [x] **B3 · Playground** (`/dev/dashboard/session`) — **`537b9c0`**, deleted on promotion by **`3df5be4`** (git
  keeps it). The author reviewed it and approved it.
- [x] **B4 · Dashboard — probe before the gate (D2)** — **`069c011`**. Probe on mount, before any decision; `dead`
  clears and then navigates (the order is what stops the redirect loop); `alive` refreshes the identity; `inconclusive`
  loads with the stored session and expels nobody. The corrupt local session (token without identity) takes the same
  single path instead of a second message.
- [x] **B5 · Dashboard — the CTA (D3)** — **`069c011`**, corrected in **`f7b5562`**. The whole `Acciones` section
  (heading, grid, sentinel, sticky bar) and the empty-state CTA hang from one condition, and that condition is now
  the same question the wizard asks (`permission: "create_dataset"`), not the broader membership list.
- [x] **B6 · Login — the notice** (`7b5d4b4`). One merged alert block for the login error and the expiry notice;
  submitting replaces the notice with the attempt's outcome. The test lives at `login.test.ts`: SvelteKit reserves
  `+`-prefixed files under `src/routes`.
- [x] **B7 · Wizard — the false diagnosis** (`3d6529d`). The probe runs before the three loaders, so a dead session
  never reaches «Necesita rol de editor…». The expiry path moved to `src/lib/session-guard.ts`, because two screens
  now need it and its three steps must not diverge; its second test measures the order inside the `goto` mock.
- [x] **B8 · Spec extension** (`4d25b3e`). `Invalid Session Detection` in
  `openspec/specs/authentication/spec.md`, between Session Persistence and Logout, with four scenarios — including
  that an unavailable CKAN is **not** an invalid session.
- [x] **B9 · Gates and live verification** (2026-09-20). See the closing entry in the evidence log.
- [x] **B10 · Work-unit commits**: `5d51452`, `63d0b35`, `537b9c0`, `069c011`, `7b5d4b4`, `3d6529d`, `4d25b3e`,
  `3df5be4`, `f7b5562`. All **unpushed**; the push remains the author's decision.

## Slice C — D4: honest status-to-message mapping

One repository (`odp`). Depends on **slice B**: the 403 branch reuses its session probe and its single
expulsion path.

**The defect, re-measured live (2026-09-20, stack up, through the browser's own dev proxy `:8082`):**

```
resource_show (resource of the PRIVATE dataset `test`), anonymous  -> 403  Authorization Error
resource_show (the same resource), garbage token                   -> 403  Authorization Error   <- identical body
resource_show (an unknown resource id)                             -> 404  Not Found Error
resource_show (resource of a public dataset), anonymous            -> 200
package_show  (the private dataset), anonymous                     -> 403  Authorization Error
```

Both 403 bodies read `"Access denied: User  not authorized to read resource <id>"` — the user name is
**empty**. On this action a **dead session and a genuine permission denial are indistinguishable by
status**, so any message that asserts one cause is a lie. Separating them is exactly what slice B's probe
(`src/lib/api/session.ts`) can do.

**Second defect in the same page, found while measuring.** `resource/[resourceId]/+page.svelte` builds its
CKAN client **without `apiKey`** (`createCkanClient({ baseUrl: env.CKAN_URL })`) — the same omission
`f8e6b09` fixed for the dataset page. An owner of a private dataset therefore gets a 403 on **their own**
resource. Fixing the message without fixing this would leave the most common 403 unexplained.

**Decisions (author, 2026-09-20):**

1. **Probe and branch on a 403.** The page carries the session token and, on a 403 *with a token*, asks the
   slice B probe: `dead` → the single expulsion path (`endInvalidSession`, clear-then-navigate); `alive` → a
   real permission denial, named as such; `inconclusive` → one message that covers both readings without
   asserting either. With **no token nobody is probed**: an anonymous viewer is not a dead session, and
telling them «su sesión expiró» would be a new lie. They get «inicie sesión con una cuenta autorizada».
2. **The mock fallback survives only for non-definitive failures.** A 403/404 is the catalogue's final answer
   and is never masked with sample data; the mock stays for a refused network, a timeout or a 5xx. This is
   the rule `dataset/[id]/+page.svelte` already applies, so no third convention appears.
3. **One reusable helper, and both 403/404 call sites migrate to it** — the resource page and the dataset
   page, which today carries the same judgment inline (`dataset/[id]/+page.svelte:64-72`).
4. **The author reviews the UI on the real page.** Slice B's fourth empty-state text and the login notice are
   still unreviewed, and this slice adds three more texts; they get reviewed together.
5. **One commit per work unit**, tests and docs beside their code, on `feat/v0-portal-honesty`.

**Forecast (corrected with measurements — the original was wrong by ~3.7×).** The forecast written before
the first line of code said: code ~160 lines, tests ~220, review material 0, **total ~380** against the
400-line review budget. Measured across `b68031b..HEAD` once the slice was done:

```
code  = 545   (failure.ts 148, session-guard.ts 40, session.ts 12, both pages 264)
tests = 804   (failure.test.ts 232, session-guard.test.ts 121, session.test.ts 24,
               resource-page.test.ts 227, dataset-page.test.ts 187)
docs  =  71   (spec 47, BACKLOG 24)
total = 1420
```

**Why it was wrong.** I applied the measured ratios from `openspec/config.yaml` (1.69 dense module, 0.38
markup-heavy page) to a code size I had *guessed*, and I guessed the code at less than a third of what it
cost: the helper grew three judgements and a full copy table, and the shared 403 branch needed `session.ts`
and `session-guard.ts` as well. Worse, I then estimated the test surface from the ratio instead of from the
matrix it actually had to cover — three access contexts × two subjects × two pages × the state rendering —
which is 804 lines, not 220. The rule in `openspec/config.yaml` exists because two earlier deliveries broke
the budget by ~2.5×; this was the third, and it broke the same rule the same way, by estimating.

**Consequence, recorded rather than hidden.** Slice C exceeds the 400-line review budget on its own
(1420 changed lines). It was reviewed as a whole range, which lands in the same size class slice B already
reviewed (1341 lines, tier high, four lenses) — see the disposition below.

**Task list:**

- [x] **C1 · RED — the helper's contract** (`src/lib/api/failure.test.ts`), then **C2 · GREEN**
  (`src/lib/api/failure.ts`). The three judgments it owns:
  - `classifyFailure(err)`: `403` → `unauthorized`, `404` → `not-found`, everything else (`0`, `408`, 5xx, a
    foreign throw) → `unavailable`. Must fail against today's code, which has no such module.
  - `isDefinitive(kind)`: true for a 403/404, false for `unavailable` — the single condition the mock rule
    hangs from.
  - `describeFailure(err, subject, access)`: subject `dataset | resource`; access
    `anonymous | session-alive | unknown`. Spanish copy, formal «usted», and the `unauthorized` message
    **differs per access**: `anonymous` asks to sign in, `session-alive` names a real lack of authorization,
    `unknown` asserts neither.
  **Work unit 1.**
- [x] **C3 · The shared 403 branch** (`src/lib/session-guard.ts`): given a token and a 403-shaped failure,
  either expel — and the page stops — or report `alive`/`inconclusive` for the copy. Same module and same
  philosophy slice B used for the expulsion path («una condición, un mensaje, una ruta»), so the decision is
  not written twice. **Work unit 1.**
- [x] **C4 · Resource page** (`src/routes/dataset/[id]/resource/[resourceId]/+page.svelte`): the token reaches
  the client; the mock fallback moves behind `isDefinitive`; the error state stops hardcoding «Recurso no
  encontrado» in both the heading and `<svelte:head>` and renders the presentation instead; retry is offered
  only where a retry can change the answer. **Work unit 2.**
- [x] **C5 · Dataset page** (`src/routes/dataset/[id]/+page.svelte`): the inline 403/404 mapping is replaced
  by the helper, with the same rendering contract. **Work unit 3.**
- [x] **C6 · Spec** (`openspec/specs/resource-detail-view/spec.md`): a new requirement —
  `Authorization Failure Is Not a Missing Resource` — with scenarios: a 403 is not rendered as "not found";
  an owner with a live session sees the resource; DEV does not mask a definitive failure with sample data.
  `Missing Resource` already owns the 404 half and is left intact. **Work unit 1.**
- [x] **C7 · Gates**: `pnpm test`, `pnpm check`, `pnpm build`, and Biome through the direct ELF binary
  (`pnpm lint` is the documented machine flake).
- [x] **C8 · Live verification** against the running stack, with a real token: the owner sees their private
  resource (200), an anonymous viewer gets the permission message, a dead token is expelled with the notice.
- [ ] **C9 · Native review** of the slice C range (`committedOnly`, base at the slice B closing commit
  `b68031b`).

**Outcome (2026-09-20).** Four commits on `feat/v0-portal-honesty`, tests and docs beside their code:
`5219055` (helper + shared 403 branch + spec + the two BACKLOG prose corrections), `e99b81e` (resource
page), `d3e2692` (dataset page; message amended — its first version claimed the dataset page had masked a
definitive answer with sample data, which is false, it already mapped 403/404 before the DEV branch), and
`05abdde` (the correction round below). `d3e2692` replaced the original `6402701` id by amendment; nothing
was pushed.

**Two independent verifications, both of which found real defects in the slice.**

*Read-only code verification* reproduced every gate (433 tests, 35 files; `check` 0 errors with the four
pre-existing warnings; `build` OK; Biome through the direct ELF binary at 117 files / 4 warnings / 7 infos,
no new finding) and confirmed each of the four decisions at file:line with the test that pins it — while
recording five weaknesses, three of them real:

1. **The `unavailable` copy named a cause that is false for most of its own kind.** «No se pudo conectar con
   el catálogo de datos» is untrue for the timeout, every 5xx and a 401, where the catalogue did answer. The
   slice was repeating, in miniature, the dishonesty it exists to remove. Fixed in `05abdde`, with a test
   that asserts the new message never mentions connecting.
2. **The `401` comment generalized past the measurement** («only infrastructure in front of CKAN»). Rewritten
   to claim only what was observed.
3. **A false claim in a commit message** (`d3e2692`, see above). Fixed by amendment.
4. Two weaker findings, both fixed: the successful expulsion path was unpinned (a rewrite could have left the
   loading skeleton forever, and no test would have noticed), and the `forbiddenProbe` helper's comment
   implied its `throw` was the pin when `createSessionApi` swallows it — the real pin is
   `expect(post).not.toHaveBeenCalled()`.
5. The `unavailable`/`unknown` state had no spec scenario. Added.

*Live verification in a real browser* (headless Chromium over CDP, temporary `ckan_admin` token minted and
revoked by jti, request headers read from `Network.requestWillBeSent`) confirmed all four claims against the
real stack, and found two things nobody had looked for:

```
anonymous, private resource   no Authorization header, 403  -> «Recurso privado» + sign-in link
                                                            (returnTo present, NO expired param)
with token, private resource  Authorization = session token -> resource renders (200)
anonymous, unknown id         no Authorization header, 404  -> «Recurso no encontrado», no retry
anonymous, public resource    no Authorization header, 200  -> renders (control)
dead session («garbage»)      Authorization = garbage       -> /auth/login?returnTo=…&expired=1,
                                                            notice shown, no loop, storage cleared
mock id that CKAN answers 404 -> «no encontrado», never the mock (the decisive DEV check)
```

- **Limitation stated, not glossed:** `ckan_admin` is a sysadmin and gets 200 on any private package, so the
authenticated case proves the token is **sent**, not that an ordinary owner sees their own private dataset.
The `session-alive` branch (a live session that lacks authorization) could not be exercised with the
accounts available.
- **Two incidental findings recorded in `BACKLOG.md`:** the download link renders CKAN's own
  `ckan.site_url` origin rather than the portal's, which matters for a deliberately headless architecture;
  and the data preview fails for the **whole seeded catalogue**, because the seeded resources are links, not
  uploaded files, so `datastore_search` answers 404 and the panel reports a load failure.
- The DataStore preview's own tokenless client is recorded as a `[v0]` follow-up, deliberately outside this
  slice's four decisions.

**Reference correction, so nobody re-cites it.** `BACKLOG.md` claims slice C «es el requisito
`Distinguishable Authorization Errors` que la spec del ciclo de vida ya escribió». That requirement
(`openspec/changes/2026-09-13-publication-lifecycle/specs/publication-lifecycle/spec.md:124`) governs **the
CKAN plugin's** HTTP semantics: it demands a `403` with its own message instead of a `409` or a validation
error. It says nothing about how the portal renders a failure. The spec this slice actually amends is
`resource-detail-view`.

**Out of scope, found while reading** (noted, not fixed here): `resource-detail-view`'s `Preview Placeholder`
requirement still demands a «coming soon» placeholder where the page now renders a real DataStore preview.

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

**B10 · the native review of the slice (2026-09-20).**

`review-086ad59599b720f1` — tier **high**, **18 files, 1341 changed lines**, four lenses (risk,
resilience, readability, reliability), correction budget 200. The author chose to review **only the
slice** (`baseRef` at the slice A closure, `committedOnly`) instead of the accumulated branch the
inspection derived, which is the guidance this document already recorded. It closed **`approved`** and
the authority was **burned** with evidence `gentle-ai.review-acknowledged/v1`, on revision
`sha256:b589c2b2…` of candidate `sha256:6198424b…`.

**It found one CRITICAL, deterministic, candidate-caused defect — this slice's own:**

- **`R4-404-LOGOUT`** (`src/lib/api/session.ts:68-69`): the probe treated *every* 404 from `user_show`
  as a dead session, without distinguishing CKAN rejecting the token from the deployment failing to
  reach the action at all. One misconfigured base URL or proxy would have cleared **every** stored
  session and sent every authenticated user to a login screen that might itself be unreachable: a mass
  lockout, and a failure mode the base did not have. **Corrected in `f7214f6`** (117 diff lines of the
  120 declared): a 404 closes a session only when CKAN is demonstrably answering — one public
  `status_show` read (which needs no token and answers 200 even with a dead one, measured) must
  succeed — and otherwise the answer is `inconclusive`, so nobody is evicted over infrastructure. The
  corroboration is behavioral evidence, not a match on CKAN's message or error type. A targeted
  validator run confirmed the correction, and `f7214f6` is part of the reviewed candidate.

**Nine advisory findings — all non-blocking; the reviewers' own disposition is that none of them
reopens the review and none opened a correction.** They are recorded rather than silently kept:

| id | lens | where | severity |
|---|---|---|---|
| `R1-session-probe-404` | risk | `src/lib/api/session.ts:66-71` | WARNING |
| `R2-duplicated-empty-copy` | readability | `src/routes/dashboard/+page.svelte:435-445` | SUGGESTION |
| `R2-duplicated-probe` | readability | `src/routes/dashboard/+page.svelte:79-96` | SUGGESTION |
| `R2-stale-session-comment` | readability | `src/lib/session.ts:5-8` | SUGGESTION |
| `R3-001` | reliability | `src/lib/api/session.ts:67-69` | WARNING |
| `R3-002` | reliability | `src/lib/session-guard.ts:30` | WARNING |
| `R3-003` | reliability | `src/routes/auth/login/login.test.ts:1-90` | SUGGESTION |
| `R3-004` | reliability | `src/routes/dashboard/datasets/new/wizard.test.ts:666-692` | SUGGESTION |
| `R4-PERM-SILENT` | resilience | `src/routes/dashboard/+page.svelte:174-177` | WARNING |

- **`R2-stale-session-comment` is confirmed stale by reading it**: the paragraph in
  `src/lib/session.ts:5-8` still describes the dashboard throwing «No se pudo identificar al usuario
  autenticado.», and `069c011` deleted that string. The comment is now wrong. It is deliberately **not**
  touched here so the tree keeps matching the revision the receipt was burned on; it is a follow-up.
- **`R4-PERM-SILENT` names a limitation this document should own**: a failure of the permission
  question leaves the offer closed with no retry surface — fail closed, as decided, but the user gets
  no way to ask again without a reload.
- **Traceability**: this evidence-log entry is the only change made after the acknowledgement. The
  approved candidate is the tree whose revision is `sha256:b589c2b2…`; the entry is a record of ids,
  locations and decisions, not a new claim about that tree.

**B9 · gates and the live verification (2026-09-20).**

The independent read-only verifier reproduced every gate and refuted part of the design's own claim:

```
pnpm test                                   34 files, 350 passed, 0 failed
pnpm check                                  0 errors, 4 pre-existing warnings
pnpm build                                  built in 30s, adapter-node done
pnpm lint                                   exit 254 (the documented machine flake, not the repo)
biome check .  (direct ELF binary)          115 files, 0 fixes, 4 warnings, 7 infos (baseline unchanged)
```

**The review found a third defect, and it was this slice's own.** `f7b5562`:

- **The offer hung from a broader question than the action it offered.** The gate used the membership list
  (`organization_list_for_user {}`, every membership with its `capacity`), while the wizard asks
  `{permission:"create_dataset"}`. Measured with the same user and token: a `capacity: "member"` appears in the
  broad list and gets `[]` from the scoped one; the same user promoted to `editor` gets the organization back. So
  the panel offered «Publicar dataset» to a member who cannot create a dataset — D3 again, in the form this slice
  had just introduced. The offer now asks the same question the wizard asks, in a loader whose failure means no
  offer and no claim. That also closed a copy hole: a member **does** belong to an organization, so «requiere
  pertenecer a una organización» would have been false for them; it now says the editor or administrator role.
- **Identity rendered before the session was checked.** The greeting and the admin badge come from the stored
  session and were drawn while the probe was in flight. They now render only once the probe resolves without
  declaring the session dead — the flag means «comprobada y no declarada muerta», not «viva», because an
  inconclusive probe also opens the panel.
- **The spec overclaimed.** The scenario said «nothing derived from the dead session is rendered», which the shared
  header cannot promise while it reads the same store. It now names what is guaranteed: no identity, no listing and
  no offer on the authenticated screen.
- **Test-quality notes taken, not hidden**: the inconclusive test would also pass on the pre-slice code (its
  decisive contrast lives in the `dead` test), the offer tests never asserted the permission scope — which is how
  the member hole stayed invisible — and one pre-existing assertion checks a CSS class rather than behavior.

**Live verification in a real browser** (headless Chromium driven over CDP, a fixture `editor` in
`direccion-investigacion`, token injected into `localStorage` exactly as the login writes it):

```
LIVE session, /dashboard            href=/dashboard  offer=yes  «Hola, Live probe»  organization row=yes
revoke that token server-side       api_token_revoke -> success
DEAD session, reload /dashboard     href=/auth/login?returnTo=%2Fdashboard&expired=1
                                    offer=no  greeting=no  organization row=no  localStorage=cleared
alert on the login screen           «Su sesión expiró o dejó de ser válida. Inicie sesión nuevamente.»
reload again while anonymous        href=/auth/login  (the anonymous guard; no notice, no loop)
```

- **The redirect loop does not happen**: the final URL is the login screen, not the dashboard, which is the
  measured proof that clearing before navigating works.
- **Nothing from the dead session survives on screen**: no offer, no greeting, no organization row.
- Fixture removed afterwards (`member_delete`, `user_delete`, `api_token_revoke`); catalogue back to **16 public
  + 1 private**, and the deleted-user rows are the documented CKAN 2.11.6 residual.
