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

Pending. Ordering inside the slice is **D2 first**: detect the invalid session with a read-only
authenticated probe, force re-login, and only then gate the CTA on "organizations loaded **and** session
valid". Needs a measurement: which action answers `403` for a dead token and `200` for a valid
non-sysadmin token. **Candidate from probe A2-prep**: `user_show {}` — with a valid token it answers
`200` and returns the caller; its dead-token answer still has to be measured.

**Contract gap to close in the spec, not in the portal alone.** `openspec/specs/authentication/spec.md`
has nine requirements — Login Proxy, Success, Failure, Rate Limiting, **Session Persistence**,
Logout, Header User Menu, Dashboard Guard, Super Admin Flag — and **none covers an invalid or expired
token**. So this slice does not contradict that spec; it fills a hole in it. Extending
`openspec/specs/authentication/spec.md` (an invalid session must be detected and must force re-login) is
part of slice B, not an afterthought.

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
