# Tasks: Publication Lifecycle — the wall and the single door (scope B)

Two repositories, and **PR 1 is already merged and is the base that changes**, not the target.
`odp-docker` commit `86f130b` (`feat(umss): refuse publication by non-approvers`, 2026-09-14) closed
the editor bypass and is load-bearing, but under scope B it permits the wrong thing: its
`Approver Capacity` contract is "the org admin publishes with `package_patch`", which decision D1 of
`design.md` removes. The scope-B work therefore does not extend PR 1 unchanged — it **amends** it.

The change splits across the two repositories by necessity, not preference: the enforcement is Python
in `ckanext-umss` (`odp-docker`), the affordance is SvelteKit in `odp`, and neither `pnpm test` nor
`pytest` alone can prove the rule (`openspec/config.yaml`: no integration runner, no E2E runner).

Every task names **what it produces**, **which repo and paths it touches**, **what proves it** (a
`pytest` command in `odp-docker`, a `pnpm` command in `odp`, or a live probe against the running CKAN),
and its **strict-TDD expectation**. `openspec/config.yaml` sets `strict_tdd: true`.

## Review Workload Forecast

`openspec/config.yaml` requires the budget gate **before apply** and declares three separate forecast
lines. `review_material_lines` (playgrounds, probe scripts) are **declared and do not compete** with
the 400-line budget. The two lines that do compete are `code_lines` and `test_lines`.

### `code_lines` — production, per repo

Measured where a merged or parked artifact already exists; `[ESTIMATE]` otherwise. The accepted
design's backend budget was `~600` lines `[ESTIMATE]` (`odd/tasks/publication-guard-design.md:170`);
the itemization below lands above it because the wall (D1/D6) is a separate delta over PR 1 and the
model layer has no local precedent (`design.md` §Not measured).

| Repo | Path / slice | Lines | Basis |
|---|---|---|---|
| `odp-docker` | `ckanext/umss/model.py` (new) | 80 | `[ESTIMATE]` — no local precedent |
| `odp-docker` | `ckanext/umss/migration/umss/**` (new, 4 files) | 220 | `[ESTIMATE]` — CKAN example layout copied; boilerplate still counts |
| `odp-docker` | `ckanext/umss/logic/action/publication.py` (new, 5 actions) | 260 | `[ESTIMATE]` |
| `odp-docker` | `ckanext/umss/logic/auth/publication.py` (new) | 110 | `[ESTIMATE]` |
| `odp-docker` | `ckanext/umss/auth.py` (wall delta, D1/D6) | 70 | `[ESTIMATE]` |
| `odp-docker` | `ckanext/umss/plugin.py` (`IActions` + model) | 25 | `[ESTIMATE]` |
| **`odp-docker` subtotal** | | **765** | |
| `odp` | `src/lib/components/dataset/PublishControl.svelte` (repoint from `6b53c64`) | 204 | **measured** (`wip/pr2-directo-publicacion`, `6b53c64`) |
| `odp` | `src/lib/components/dataset/RequestPublicationControl.svelte` (new: editor request + cancel) | 140 | `[ESTIMATE]` — mirrors the parked control's gate and state machines, two actions |
| `odp` | `src/lib/api/publication.ts` (new wrappers) | 110 | `[ESTIMATE]` — five actions, not three |
| `odp` | queue route + dataset-page wiring (both gates) + copy | 360 | `[ESTIMATE]` — includes the editor request/cancel wiring |
| **`odp` subtotal** | | **814** | |
| **`code_lines` TOTAL** | | **1,579** | |

### `test_lines` — derived from a measured ratio, never guessed

Each row names the ratio it uses and its measured source.

| Slice | `code` | Ratio used | Measured source of the ratio | `test` |
|---|---|---|---|---|
| `odp-docker` backend (all of it) | 765 | **2.20** | This extension: `ckanext/umss/tests/test_auth.py` (418 lines) ÷ `ckanext/umss/auth.py` (190 lines) = 2.20 | **1,683** |
| `odp` dense components + API wrappers | 454 | **1.69** | `dense_component` in `openspec/config.yaml`: `PublishControl` 363 test ÷ 215 code | **767** |
| `odp` markup-heavy pages (queue, wiring, copy) | 360 | **0.38** | `markup_heavy_page` in `openspec/config.yaml`: wizard 634 test ÷ ~1650 page | **137** |
| **`test_lines` TOTAL** | | | | **2,587** |

**Applied to the backend as a ceiling.** The migration tree (220 of the 765 backend lines) is copied
alembic boilerplate that carries little test weight; the same 2.20 ratio applied only to the non-migration
backend gives a floor of `(765 − 220) × 2.20 = 1,199`. The declared line uses the full 2.20, because
the rule in `openspec/config.yaml` is to use the closest measured artifact and not to shave.

### Re-measured as units land — A1 (`odp-docker` `82ae6b6..01aabc7`, 2026-10-07)

**Correction first: this block initially recorded a mid-flight snapshot.** A1 was measured at `27b8ab8`
(509 lines) while the unit was still being closed; its final state is `01aabc7`, two commits later
(663 lines). The numbers below are the final ones. The lesson is this repository's own: **measure a unit
after it closes, not while it is still moving.**

The first real backend measurement against this forecast:

| Slice | Forecast | Measured (final) | Delta |
|---|---|---|---|
| `model.py` | 80 `[ESTIMATE]` | **101** | 26% low |
| `migration/umss/**` (4 files) | 220 `[ESTIMATE]` | **232** | 5% low |
| code subtotal | ~300 | **333** | **11% low** |
| `tests/test_publication_store.py` | ~660 (300 × 2.20) | **330** | **the ratio was 2.0× pessimistic** |

**The code estimate held within 11%; the test ratio did not, for this kind of material.** A1's own ratio
is `330 / 333 = 0.99`, well below the 2.20 measured on `auth.py` — the outlier this section already
predicted for copied alembic boilerplate, and further than predicted. What carries into the remaining
units: keep **2.20 for logic-dense auth code** (A3), where it was measured, and **do not** apply it to
boilerplate or declarative model code, whose measured ratio is ~1.0. The remaining backend units
re-measure as they land; **the total is not revised on one sample.**

**A1 shipped more than this plan asked for**, and that is to its credit: the suite exercises the
**down-migration**, and the migration's `CHECK` constraints carry nullability tests. The extension suite
went 54 → **79**; CI is green on both jobs (`37564700222`).

### Re-measured — A2 (`odp-docker` `01aabc7..1a2d6c2`, 2026-10-07)

The second backend measurement, and it **falsifies the guidance the A1 block drew**:

| Slice | Measured |
|---|---|
| `logic/action/publication.py` (new) | **249** |
| `logic/auth/publication.py` (new) | **142** |
| `plugin.py` (delta) | **+36 / −3** |
| code subtotal | **427** |
| `tests/test_publication_actions.py` (new) | **513** |
| **ratio** | **513 / 427 = 1.20** |

**The 2.20 predicted for this material was 1.8× pessimistic — again.** The other session reported
404 and 485 for the same two numbers (a different counting convention); the ratio is **1.20 either way**,
which is why it is the number that travels.

**What that does to the guidance, stated plainly because it has now been revised three times in one
day:** the ratio is **not** a property of a material class. 2.20 measured the particular density of
`auth.py`, and extrapolating it to "logic-dense code" — the refinement this very section proposed after
A1 — is wrong by the same factor A1's was. The four measurements now in hand are:

| Artifact | Ratio |
|---|---|
| A1: declarative model + copied alembic boilerplate | **0.99** |
| A2: the five actions and their auth | **1.20** |
| portal: a dense component with logic | **1.69** |
| `auth.py` alone (the outlier that started it) | **2.20** |

**Revised guidance: forecast `test_lines` as a range of `1.0–1.7 × code_lines` for the backend and the
portal, re-measuring per unit as it lands, and retire 2.20 as a backend default.** The deeper lesson is
about the rule itself: **a rule derived from two samples is a hypothesis, and this one was written as a
rule.** It took a third and fourth sample to see it.

**And one consequence that is not a forecast matter:** the return contract is now **uniform** — every action
returns only its row, and the portal **re-reads the dataset** to confirm the stored value (spec, `Return
shape`; `design.md` D4/D5). Two earlier states of this paragraph were true and are not any more, which is
worth naming: the additive `dataset` key was **decided and then dropped**, and while the portal assumed it
the mismatch was real — with that shape, against the deployed action, **every successful publication would
have read as a failure**. Under the uniform shape the portal and the delivered action **agree on the
return**, so what still keeps **B1** waiting is not the return but the **authorization**: the delivered code
predates the governance amendment — `publication_publish` still authorizes the organization `admin` and
`decide` still carries no four-eyes check (`odp-docker` `PUBLICATION-ACTIONS.md`, status banner).

### `review_material_lines` — declared, does not compete with the budget

| Artifact | Lines | Basis |
|---|---|---|
| `openspec/changes/2026-09-13-publication-lifecycle/probe.sh` (rewrite + door/wall rows) | ~500 | measured 373 today (`wc -l`) + ~130 for the door and wall rows |
| `src/routes/dev/dataset-publish/**` playground (control) | 273 | **measured** (`6b53c64`) |
| new request-control + queue playground | ~200 | `[ESTIMATE]` |
| **`review_material_lines` TOTAL** | **~973** | |

### The gate — verdict against the 400-line budget

| Reading | Lines | Multiple of 400 |
|---|---|---|
| `code_lines` alone | 1,579 | **3.9×** |
| Budget-bearing total (`code_lines` + `test_lines`) | 4,166 | **10.4×** |
| `review_material_lines` (non-competing) | ~973 | — |

**The gate fails, by a wide margin, and no reading of the measured ratios closes it.** Even
`code_lines` alone is 3.9× the budget; the closest-measured test ratio multiplies that to 10.4×.

**Resolved by the maintainer on 2026-10-07: the change is delivered as a chain of work units, each
completed, verified and reviewed on its own native gate.** No `size:exception` was granted, and no scope
was reduced to fit the number. Each unit is expected to exceed 400 lines of code+test by itself, and
that is accepted deliberately: the alternative — one review of ~1,600 code lines and ~2,600 test lines —
concentrates every unmeasured assumption of this design (the model layer, the record+flip atomicity, the
native-writer inventory) behind a single gate, so one structural finding would reopen the whole chain.

Measured precedent in this repository: the UI polish sweep (1,987 lines) entered `main` **per unit**,
with one native gate per unit (`review-236918db1f135803`, `review-44dbd42660f4154f`,
`review-7ad1e9b391960117`).

`size:exception` is **not** requested or inferred by this forecast, and scope is **not** shrunk to fit
the number. The last two deliveries in this repo blew the budget ~2.5× precisely because the forecast
ignored verification work (`openspec/config.yaml`): PR 1 estimated 190 → real 915; PR 2 estimated
230 → real 480 code + 363 tests. Both are named here so the same error is not repeated a third time.

```text
Decision needed before apply: No — the gate is resolved (chained work units)
Chained PRs recommended: Yes
Chain strategy: one unit at a time, each with its own native gate, in the order
  A1 → A2 → A3 → A5 → B1 → B2 (A4 closes inside A3; A6 lands with A1, whose migration it deploys)
400-line budget risk: High (code alone 3.9× overall) — accepted by the maintainer
```

### Suggested work units (the full chain)

| Unit | Goal | Repo | Focused test command | Review material | Rollback boundary |
|---|---|---|---|---|---|
| **PR 1** *(merged)* | The guard (`86f130b`) | `odp-docker` | extension `pytest` (see hazard) | `probe.sh` | revert `auth.py`, `plugin.py`, tests; stock CKAN authorization returns |
| A1 | Store + migration + model | `odp-docker` | `pytest … tests/test_publication_store.py` | — | drop the table; `ckan db downgrade` |
| A2 | Five actions + their auth | `odp-docker` | `pytest … tests/test_publication_actions.py` | — | remove `IActions`; actions disappear |
| A3 | The wall (D1/D6) + wire inventory + probe rewrite | `odp-docker` + `odp` | `pytest … tests/test_auth.py` | `probe.sh` | revert `auth.py`; patch path reopens |
| B1 | Portal controls + API wrappers (sysadmin direct publish control repointed; editor request/cancel control new) | `odp` | `pnpm vitest run src/lib/components/dataset/PublishControl.test.ts src/lib/components/dataset/RequestPublicationControl.test.ts` | `/dev/dataset-publish` | revert components + wrappers; CKAN rule keeps working |
| B2 | Approval queue + dataset-page wiring (both gates) + copy | `odp` | `pnpm vitest run <queue test>` | queue playground | revert route + controls + copy |

---

## The base that changes (PR 1, merged)

PR 1 is `odp-docker` `86f130b` (`feat(umss): refuse publication by non-approvers`, 2026-09-14),
merged and pushed. It is the base the scope-B work edits. Four artifacts must move with it, and all
four are part of this same reconciliation:

| Artifact | What it owes under D1 |
|---|---|
| `openspec/changes/2026-09-13-publication-lifecycle/apply-progress.md` | Its record of PR 1 describes the guard as finished; under scope B the guard is the base that changes. **Already reconciled in this change (out of this pass's edit surface).** |
| `probe.sh` (this change directory) | Asserted 25/25 against the old `Approver Capacity` contract (admin publishes with `package_patch` → `200`). D1 turns `P6` and `P10` into `403`. The probe is **partly false** until rewritten (Phase A.5). |
| `specs/publication-lifecycle/spec.md` → `Requirement: Approver Capacity` | The admin's capacity now exercises through the action, not `package_patch`. **Already reconciled in this change (out of this pass's edit surface).** |
| The portal's copy (`DatasetForm.svelte`) | The copy that promises "the publication flow decides visibility" becomes true; it is edited to name who publishes (Phase B2). |

**Do not read PR 1 as the finished rule.** `probe.sh`'s "25/25" and `Approver Capacity`'s old wording
are the two places where the merged base is now wrong.

## Hazards — inherited, and each has already bitten once

> **⚠ HAZARD 1 — never run the extension suite without the database *and* site-id overrides.** The bare
> `pytest --ckan-ini=test.ini` runs against the **dev** database: `ckan/config/environment.py:81` maps
> `sqlalchemy.url` to `CKAN_SQLALCHEMY_URL`, and the dev container exports it (plus `CKAN_SOLR_URL`,
> `CKAN_SITE_ID`), which wins over `test.ini`. On 2026-09-14 the bare command **wiped all 16 seeded
> datasets and the sysadmin** (`apply-progress.md:32-110`). Always run:
>
> ```sh
> docker exec -e CKAN_SQLALCHEMY_URL="postgresql://ckandbuser:ckandbpassword@db/ckan_test" \
>   -e CKAN_SITE_ID="test.ckan.net" \
>   odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss && pytest --ckan-ini=test.ini ckanext/umss'
> ```
>
> If the suite is ever run without them, repair with `ckan -c "$CKAN_INI" search-index clear` **then**
> `rebuild` (`rebuild` alone does not purge stale documents).

> **⚠ HAZARD 2 — do not restart `odp-dev-ckan-dev-1`.** A restart crash-loops it: the DataPusher init
> script mints a token without the `expires_in`/`unit` that `expire_api_token` makes mandatory, blanks
> `ckan.datapusher.api_token`, and every `ckan` invocation dies in `load_environment`
> (`apply-progress.md:433-469`). The dev container runs the Flask reloader, so a bind-mounted plugin
> change is picked up **without** a restart anyway (`apply-progress.md:316-320`).

> **⚠ HAZARD 3 — the migration is a deployment step, not a code change.** The table does not exist
> until `ckan -c <ini> db upgrade` runs. Dev hot-mounts the extension and the reloader registers code
> live (`$ODP_DOCKER/ckan-docker/docker-compose.dev.yml:30`), but production bakes the extension
> (`$ODP_DOCKER/ckan-docker/Dockerfile.umss:13`), so a deploy that skips `db upgrade` leaves the wall
> refusing every publication with no action able to complete it. The command must be recorded in the
> `odp-docker` deploy path (Phase A6).

> **⚠ VERSION DRIFT — the probe was measured on CKAN 2.11.6; the running stack is 2.12.0.** `GET
> http://localhost:8082/api/3/action/status_show` answers `ckan_version: 2.12.0` (measured 2026-10-07),
> and the container's `ckan.__version__` is `2.12.0`. Every previously-measured row and every `ckan/…`
> citation in `design.md` must be re-validated against the running image during Phase A5, not assumed.
> The applied guard's own docstrings still cite the 2.11.6 path `ckan/logic/schema.py:160-161`; in
> 2.12.0 that file is `ckan/logic/schema/__init__.py`.

---

## PR A — Backend: the wall and the door (`odp-docker`)

Repo root: `/home/danielblc/projects/odp-docker`. Extension root:
`/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss` (in-container:
`/srv/app/src_extensions/ckanext-umss`). All `pytest` proofs below use the two-override command from
Hazard 1; it is abbreviated as `pytest … <path>`.

### Phase A1 — Store and migration (D2, D3)

- [ ] **A1.1 RED: failing tests for the store.** Produce: a new module
  `…/ckanext-umss/ckanext/umss/tests/test_publication_store.py` whose first collected test fails
  because `ckanext.umss.model` does not exist yet (import the module directly; no `skip`/`xfail`).
  Cover: the record persists every declared column; every outcome of
  `pending|approved|rejected|cancelled|annulled` is storable; `decided_at`/`consumed_at` are unset on a
  `pending` row. Repo/paths: `odp-docker`,
  `…/ckanext-umss/ckanext/umss/tests/test_publication_store.py` (new). Proof:
  `pytest … ckanext/umss/tests/test_publication_store.py` → collection/import failure. TDD: RED for A1.2.

- [ ] **A1.2 GREEN: implement the model.** Produce: `PublicationRequest` in
  `…/ckanext-umss/ckanext/umss/model.py` (new) with `id`, `dataset_id`, `requested_visibility`,
  `status`, `requested_by`, `approved_by`, `comments`, `motive`, `created_at`, `decided_at`,
  `consumed_at`, and a **partial unique index enforcing at most one `pending` per dataset** (D2).
  Repo/paths: `odp-docker`, `…/ckanext-umss/ckanext/umss/model.py` (new). Proof:
  `pytest … tests/test_publication_store.py` → green. TDD: A1.1 first.

- [ ] **A1.3 GREEN: add the migration tree.** Produce:
  `migration/umss/{alembic.ini, env.py, script.py.mako, versions/0001_add_publication_requests.py}`
  copied from CKAN's own `ckanext/example_database_migrations/` layout; registration is the **plugin
  name** (`umss`), no plugin code needed (`ckan/cli/db.py:142-172`, cited in `design.md` D3).
  `MANIFEST.in:5` already reserves the tree. **Correction (measured 2026-10-07 in `ckan/tests/pytest_ckan/fixtures.py:390-400`; reported by the
  session working in `odp-docker` and re-verified here): there is no TDD exception, and the migration is
  not optional in tests.** CKAN's `clean_db` does **not** create extension tables. The fixture
  `migrate_db_for("<plugin>")` exists for exactly this: its own docstring shows the pattern
  (`@pytest.mark.usefixtures("clean_db")` … `migrate_db_for("my_plugin")` … `has_table(...)`), and it
  calls `ckan.cli.db._run_migrations` — the same code path as `ckan db upgrade`. So the store tests take
  `(clean_db, migrate_db_for)` and call `migrate_db_for("umss")`, and **the migration ends up exercised
  by the suite**, not only at the CLI. Repo/paths: `odp-docker`, `…/ckanext-umss/ckanext/umss/migration/umss/**` (new). Proof: against
  a database without the table, `ckan -c <ini> db pending-migrations` lists the new migration, `ckan
  -c <ini> db upgrade` applies it, and `ckan -c <ini> db pending-migrations` then reports none with
  the table resolvable; `pytest … tests/test_publication_store.py` stays green.

- [ ] **A1.4 TRIANGULATE: the one-pending index.** Produce: tests proving a second `pending` row for
  the same dataset is rejected while a `pending` row for a **different** dataset is unaffected, and
  that non-`pending` rows are not constrained by the partial index. Repo/paths: `odp-docker`,
  `…/tests/test_publication_store.py`. Proof: `pytest … tests/test_publication_store.py` → green.
  TDD: negative/alternate cases that protect D2.

### Phase A2 — The five actions (D4, D5)

- [ ] **A2.1 RED: failing tests for the action surface.** Produce: `…/tests/test_publication_actions.py`
  (new) whose first test fails because the actions are not registered. Cover, in `odp-docker`:
  `publication_request_create` writes exactly one `pending` row with `requested_by`/`comments` and is
  **idempotent**; `publication_request_cancel` (`pending`→`cancelled`, no flip);
  `publication_request_decide {approve: false, comments}` → `rejected` + comments, `private` unchanged;
  `publication_request_decide {approve: false}` with **no** comment → refused, row stays `pending`;
  `publication_request_decide {approve: true}` → `approved` with `decided_at`/`consumed_at` **and**
  `private: false`; the **four-eyes** refusal (a caller whose identity equals `requested_by` is refused
  and the row stays `pending`); `publication_publish` writes and consumes the row in the act **only for
  a `sysadmin`**, while an organization `admin` gets `403`; `publication_request_list` filters by status.
  Repo/paths: `odp-docker`, `…/tests/test_publication_actions.py` (new). Proof:
  `pytest … tests/test_publication_actions.py` → collection/import failure. TDD: RED for A2.2.

- [ ] **A2.2 GREEN: implement the five actions.** Produce:
  `…/ckanext-umss/ckanext/umss/logic/action/publication.py` (new) with the five actions of D4. The door
  flips through a **server-side** call carrying `ignore_auth`
  (`logic.get_action('package_patch')(context={…, 'ignore_auth': True}, data_dict={'id': …, 'private': False})`;
  the production entry point is `logic.get_action`, not `helpers.call_action` — `design.md` D5) so the
  record and the flip travel one session (`ckan/logic/__init__.py:313`). `publication_publish` is
  **`sysadmin`-only** and writes and consumes its row; `publication_request_decide` refuses a
  self-approval (four eyes) and requires a comment to reject. Repo/paths: `odp-docker`,
  `…/logic/action/publication.py` (new). Proof: `pytest … tests/test_publication_actions.py` → green.
  TDD: A2.1 first.

- [ ] **A2.3 RED: failing tests for the actions' authorization.** Produce: tests covering — an `editor`
  cannot decide (`403`); a stranger cannot cancel someone else's request (`403`); the requester can
  cancel their own; an `admin` (and a parent-org `admin`) can decide, but **never a request they
  created** (`403`, four eyes); an organization `admin` cannot `publication_publish` (`403`); a
  `sysadmin` can decide and can `publication_publish`; `publication_request_list` returns the caller's
  org requests plus their own and **not** requests the caller has no capacity to see. Repo/paths:
  `odp-docker`, `…/tests/test_publication_actions.py`. Proof:
  `pytest … tests/test_publication_actions.py` → the new assertions fail. TDD: RED for A2.4.

- [ ] **A2.4 GREEN: implement the actions' authorization.** Produce:
  `…/ckanext-umss/ckanext/umss/logic/auth/publication.py` (new) authorizing the five actions per D4:
  `publication_publish` authorizes only a `sysadmin`; `publication_request_decide` authorizes an org
  `admin` (owning or parent) or a `sysadmin`, but **never the requester** (the `admin` predicate is the
  stock capacity, reused — no extension-defined permission). Repo/paths:
  `odp-docker`, `…/logic/auth/publication.py` (new). Proof: `pytest … tests/test_publication_actions.py`
  → green. TDD: A2.3 first.

- [ ] **A2.5 TRIANGULATE: the record and the flip are one transaction.** Produce: a test that forces
  the flip to fail and asserts **no** `approved`/`consumed` row remains (the scenario that closes
  `design.md` §Not measured). Repo/paths: `odp-docker`, `…/tests/test_publication_actions.py`. Proof:
  `pytest … tests/test_publication_actions.py` → green. TDD: the asserted-not-measured point becomes a
  measured test.

- [ ] **A2.6 TRIANGULATE: the decision re-checks the current state.** Produce: a test that changes the
  dataset's owning organization, or revokes the requester's capacity, **after** the request was created,
  and asserts `publication_request_decide` evaluates the dataset's **current** owner and the requester's
  **current** capacity — not the state captured at request time — and refuses an approver whose admin
  reach no longer covers the current owner. Repo/paths: `odp-docker`,
  `…/tests/test_publication_actions.py`. Proof: `pytest … tests/test_publication_actions.py` → green.
  TDD: negative/alternate cases that protect the four-eyes and approver-capacity contract.

- [ ] **A2.7 TRIANGULATE: a pending request is annulled when its object disappears.** Produce: tests
  that delete the dataset under a `pending` request, and that publish it through another path (the
  `sysadmin`'s `publication_publish`), and assert the request's outcome is `annulled` with the `motive`
  column recorded and no second publication written. Repo/paths: `odp-docker`,
  `…/tests/test_publication_actions.py`. Proof: `pytest … tests/test_publication_actions.py` → green.
  TDD: the annulment transition this cut now writes (`Publication Request Store`).

### Phase A3 — The wall (D1, D6)

- [ ] **A3.1 RED: failing tests for the wall.** Produce: extend `…/tests/test_auth.py` so the **admin**
  now gets `403` from `package_patch {private: false}` and from a `state` change (the reversal of the
  measured `200`, `apply-progress.md:282`); the admin gets `403` from `package_create` with `private:
  false` **or omitted**; and `bulk_update_public` is refused **by the chained rule** (`403` with the
  plugin's message), not by CKAN's own authorization. Repo/paths: `odp-docker`,
  `…/ckanext-umss/ckanext/umss/tests/test_auth.py`. Proof:
  `pytest … ckanext/umss/tests/test_auth.py` → the new assertions fail against the merged guard. TDD:
  RED for A3.2.

- [ ] **A3.2 GREEN: implement the wall.** Produce: in `…/ckanext-umss/ckanext/umss/auth.py`, remove the
  admin capacity exception from `package_update`/`package_patch` (D1), refuse public `package_create`
  for **everyone** (D6.2), and add the `bulk_update_public` chained refusal (D6.3) — **chain CKAN's own
  auth function named `bulk_update_public` (`ckan/logic/auth/update.py:261`), not `package_update`**
  (measured 2026-10-07: it is a separate function that checks
  `has_user_permission_for_group_or_org(org_id, user, 'update')`, which is precisely why the
  `package_update` chain does not cover it). Keep `_as_bool` a
  faithful mirror of `boolean_validator` and keep `@toolkit.auth_allow_anonymous_access` (D6.4) —
  `'banana'`/`''`/`None` are publish attempts, not deferrals (`apply-progress.md:363-399`). Add the
  admin's **distinguishable** message ("publication goes through the publication flow, not
  `package_patch`"). Repo/paths: `odp-docker`, `…/ckanext/umss/ckanext/umss/auth.py`. Proof:
  `pytest … tests/test_auth.py` → green. TDD: A3.1 first.

- [ ] **A3.3 TRIANGULATE: preserved refusals, allowed edits, and the sysadmin.** Produce: tests that the
  `member`, cross-org `editor` and anonymous callers stay refused; metadata edits, `package_delete`,
  `resource_create` and a full `package_update` omitting `private` stay `200`; create-time `state` is
  not refused; the two refusal messages are distinguishable; the guard does **not** set
  `auth_sysadmins_check`; and a `sysadmin` still publishes with stock `package_patch` (`200`, no row
  required — the declared bypass, `design.md` D6.4) while the sysadmin's **recorded** door
  `publication_publish` writes its row. Repo/paths: `odp-docker`, `…/tests/test_auth.py`. Proof:
  `pytest … tests/test_auth.py` → green. TDD: alternate and negative cases that protect D1/D6.

- [ ] **A3.4 Inventory the other native writers (review trigger).** Produce: a written inventory probe
  of the actions reachable through the API that write `private`/`state`, beyond the measured
  `bulk_update_public` (`design.md` §Not measured). Any writer the wall does not cover becomes a new
  chained refusal or an explicit, named gap — not silence. Repo/paths: `odp-docker` (a throwaway
  read-only probe; no production write). Proof: the inventory's `ACTION: <name> writes <field>`
  transcript attached to the PR. TDD: not applicable — a measurement.

### Phase A4 — Registration and the full suite

- [ ] **A4.1 Register the actions and the model.** Produce: `plugins.implements(plugins.IActions)` plus
  `get_actions()` returning the five actions on `UmssPlugin`, and the model import, next to the existing
  `IAuthFunctions` (`…/ckanext-umss/ckanext/umss/plugin.py:9,25-28`). Repo/paths: `odp-docker`,
  `…/ckanext/umss/ckanext/umss/plugin.py`. Proof: the two-override full suite
  `pytest … ckanext/umss` → green, including the new store/action modules. TDD: not applicable — wires
  already-tested actions.

### Phase A5 — The live probe, first-class (D9)

`probe.sh` (373 lines today, `wc -l` measured) is **review material**, not code budget. It is carried by
PR A because without the wall and the door its expectations cannot be satisfied. It currently asserts
the **old** contract: row `P6` (org admin `package_patch {private: false}` → `200`, stored public) and
row `P10` (parent-org admin → `200`) are now `403`; row `P8`'s refusal must now come from **our** rule,
not CKAN's. **The previously-measured 25/25 assumed the old contract and is therefore partly false.**

- [ ] **A5.1 Rewrite the `Approver Capacity` rows.** Produce: `P6` and `P10` flipped from `200` to `403`
  (through `package_patch`) and paired with their action equivalents: the org `admin` now approves
  through `publication_request_decide` (`200`) and has **no** direct publish path, while the direct
  `publication_publish` is `sysadmin`-only (`200` for a `sysadmin`, `403` for the org `admin`).
  Repo/paths: `odp`, `openspec/changes/2026-09-13-publication-lifecycle/probe.sh`. Proof: run the script
  against the running stack → `P6`/`P10` report `403`, the approval rows report `200`, and the org
  admin's `publication_publish` reports `403`. TDD: not applicable — a measurement harness.

- [ ] **A5.2 Add the door's paths.** Produce: probe rows for `publication_request_create` (editor →
  `200`, one `pending` row), `publication_request_decide {approve: true}` (an admin approving another
  caller's request → `200`, `private` flips, row consumed), `publication_request_decide {approve:
  false}` (→ `rejected`, `private` intact), `publication_request_decide {approve: false}` with **no**
  comment (→ refused), the **four-eyes** refusal (the requester deciding their own request → `403`),
  the sysadmin's recorded `publication_publish` (`200`, a row written), the org admin's
  `publication_publish` (`403`), `publication_request_cancel`, `publication_request_list` scoping, and
  the annulment of a `pending` request whose dataset is published by the sysadmin path. Repo/paths:
  `odp`, `probe.sh`. Proof: the run prints each status and, for the create, the row's
  `status`/`requested_by`. TDD: n/a.

- [ ] **A5.3 Add the wall's refusals.** Produce: probe rows for the **admin** refused by `package_patch`
  (message names the flow), the **admin** refused a public `package_create`, the **admin** refused
  `publication_publish` (`403`, no direct path), and `bulk_update_public`
  refused by our rule (assert the plugin message, not a generic CKAN refusal). Repo/paths: `odp`,
  `probe.sh`. Proof: the run's bodies carry the distinguishable messages. TDD: n/a.

- [ ] **A5.4 Add the atomicity probe.** Produce: a probe that forces the door's flip to fail and asserts
  no row is left (`P-ATOMIC`). Repo/paths: `odp`, `probe.sh`. Proof: the run reports the row absent.
  TDD: n/a — this is the measurement that closes `design.md`'s inferred atomicity.

- [ ] **A5.5 Re-run every previously-measured row on 2.12.0.** Produce: a full `P0`→`P10` run against
  the running image, with the 2.11.6→2.12.0 drift flagged in the PR (Hazard 4). Every row that no
  longer holds on 2.12.0 is a finding, not an expectation to rephrase. Repo/paths: `odp`, `probe.sh`.
  Proof: the full transcript. TDD: n/a.

- [ ] **A5.6 Keep the hygiene in-script.** Produce: confirmation that the run left nothing behind —
  `P9.1` anonymous count back to its own pre-run baseline, `P9.2`–`P9.4` zero, and the documented
  residual (CKAN exposes no user hard-delete, so probe users remain as `state='deleted'` rows). The
  `P0`/`P9.1` baseline may read the orphaned-index value, not the designed 16; state it plainly rather
  than asserting a baseline the environment cannot produce. Repo/paths: `odp`, `probe.sh`. Proof: the
  `P9.*` lines. TDD: n/a.

### Phase A6 — Deployment step

- [ ] **A6.1 Record `db upgrade` as a deploy step.** Produce: a note in the `odp-docker` deploy path
  (`Dockerfile.umss`'s vicinity or the deploy runbook, **not** `src/`, which the dev container mounts)
  that `ckan -c <ini> db upgrade` runs at deploy, and that dev hot-mounts while production bakes.
  Repo/paths: `odp-docker`, the deploy runbook / PR description (not `src/`). Proof: the note exists
  and names both the command and the dev/prod divergence. TDD: not applicable — documentation.

---

## PR B — Portal: the publication control and the approval queue (`odp`)

Repo root: `/home/danielblc/projects/odp`. Test runner: Vitest (`pnpm test`), single file
`pnpm vitest run <path>`. The portal has **no integration runner and no E2E runner**.

- [ ] **B1.1 RED: failing tests for the API wrappers.** Produce: tests asserting the **sysadmin's**
  direct publish control posts `publication_publish` with exactly `{id}` (no `state`, no
  `package_patch`), and that the queue's `listRequests`/`decideRequest` call their named actions with
  the expected payloads (the decide payload carrying `comments` for a rejection). The cut's portal
  affordances are the **sysadmin's** direct publish control, the **editor's** request/cancel control,
  and the **admin's** queue, so the request/cancel wrappers are added too. Repo/paths: `odp`,
  `src/lib/api/publication.test.ts` (new). Proof: `pnpm vitest run src/lib/api/publication.test.ts` →
  fails, wrappers absent. TDD: RED for B1.2.

- [ ] **B1.2 GREEN: add the API wrappers.** Produce: `src/lib/api/publication.ts` (new) with
  `publish` (`publication_publish`), `requestCreate` (`publication_request_create`), `requestCancel`
  (`publication_request_cancel`), `listRequests` (`publication_request_list`) and `decideRequest`
  (`publication_request_decide`), calling the D4 actions through the same-origin client. Repo/paths: `odp`,
  `src/lib/api/publication.ts` (new). Proof: `pnpm vitest run src/lib/api/publication.test.ts` → green.
  TDD: B1.1 first.

- [ ] **B1.3 RED: failing component tests for the control.** Produce: `src/lib/components/dataset/PublishControl.test.ts`
  covering the spec's `Portal Publication Affordance` and `No Fabricated Publication` scenarios:
  private + **sysadmin** → control with the consequence sentence; private + **organization `admin` who
  is not a sysadmin** → no direct publish control plus the copy "Solo un administrador de la
  organización puede aprobar esta publicación."; the gate is the `sysadmin` flag, not an organization
  list (a `capacity: "admin"`, `sysadmin: false` user gets no control); flag read failed → no control
  plus "No se pudo verificar su permiso para publicar." with retry; already public → no control and no
  reverse control; click → `403` → inline alert + control offered again; `200` with `private: true` →
  "El catálogo no confirmó la publicación." and no success; `200` with `private: false` → the page's
  dataset is replaced by CKAN's response; other failure → explicit error with retry; pending → busy, no
  success indicator. Repo/paths: `odp`, `src/lib/components/dataset/PublishControl.test.ts`. Proof:
  `pnpm vitest run src/lib/components/dataset/PublishControl.test.ts` → fails. TDD: RED for B1.4.

- [ ] **B1.4 GREEN: repoint the parked `PublishControl`.** Produce: `PublishControl.svelte` imported
  from `wip/pr2-directo-publicacion` (`6b53c64`) and repointed from `package_patch` to
  `publication_publish`; its honest `403` handling and its two state machines survive; its gate changes
  from the admin organization list to the portal's existing `isSuperAdmin` flag
  (`src/lib/stores/auth.ts:96` — **no new plumbing**); existing tokens and Lucide icons only. The
  `publish()` call to `package_patch {private: false}` does **not** survive — under the wall it is
  refused. Repo/paths: `odp`, `src/lib/components/dataset/PublishControl.svelte` (new on this branch).
  Proof: `pnpm vitest run src/lib/components/dataset/PublishControl.test.ts` → green. TDD: B1.3 first.

- [ ] **B1.5 RED: failing component tests for the editor's request control.** Produce:
  `src/lib/components/dataset/RequestPublicationControl.test.ts` covering the spec's editor scenarios:
  a caller who can `update_dataset` in the owning organization and is not a `sysadmin` → the request
  control is offered and the direct publish control is not; activating it posts
  `publication_request_create {dataset_id}`; a caller with an own `pending` request → a cancel control
  posts `publication_request_cancel {request_id}`; a caller who cannot edit → no request control; the
  `update_dataset` check failing → no control plus an explicit state with retry; a `403` → the honest
  authorization condition, not a success; a `200` that does not grant the request → no optimistic
  success. Repo/paths: `odp`, `src/lib/components/dataset/RequestPublicationControl.test.ts` (new).
  Proof: `pnpm vitest run src/lib/components/dataset/RequestPublicationControl.test.ts` → fails. TDD:
  RED for B1.6.

- [ ] **B1.6 GREEN: implement the editor's request control.** Produce:
  `src/lib/components/dataset/RequestPublicationControl.svelte` (new), gated by the existing
  `puedeEditarDataset`/`listUpdatableOrganizationIds` check — the same capacity
  `publication_request_create` demands (`src/lib/api/organizations.ts:99-110`;
  `src/routes/dataset/[id]/+page.svelte:297-300`) — calling `requestCreate`/`requestCancel` and never
  `publication_publish`. It reuses the parked component's shape, workspace check and state machines,
  not its direct-publish gate. Repo/paths: `odp`,
  `src/lib/components/dataset/RequestPublicationControl.svelte` (new). Proof:
  `pnpm vitest run src/lib/components/dataset/RequestPublicationControl.test.ts` → green. TDD: B1.5
  first.

- [ ] **B2.1 RED: failing tests for the approval queue.** Produce: `src/routes/dashboard/…test.ts` (or
  the queue route's test) covering the spec's `Portal Approval Queue` scenarios: renders pending
  requests from `publication_request_list`; approving posts `publication_request_decide {request_id,
  approve: true}` and the row leaves the queue on confirmation; rejecting posts `approve: false` with
  the comment; a request whose `requested_by` is the caller is shown with "No puede aprobar su propia
  solicitud." and offers no action; a rejection without a comment is not submitted; a `403` keeps the
  row and is reported as an authorization condition; an unavailable queue shows an explicit error
  with retry and **no** fabricated empty queue. Repo/paths: `odp`, the
  queue route's test file (new). Proof: `pnpm vitest run <queue test>` → fails. TDD: RED for B2.2.

- [ ] **B2.2 GREEN: implement the approval queue.** Produce: the queue route hosted on the
  authenticated dashboard (the design choice of `design.md` D7; the route is reviewed per `AGENTS.md`
  rule 8), reading `publication_request_list` and deciding via `publication_request_decide`. The queue
  is **admin-only** and enforces **four eyes**: the action layer authorizes both calls to the org
  `admin`, the queue does not offer a decision on the caller's own request, and it requires a comment
  to reject. Repo/paths: `odp`,
  `src/routes/dashboard/**`. Proof: `pnpm vitest run <queue test>` → green. TDD: B2.1 first.

- [ ] **B2.3 RED: failing tests for the dataset-page wiring and the copy.** Produce: tests asserting the
  direct publish gate uses the portal's `isSuperAdmin` flag (no organization list, filtered or not, is
  proof), that the request gate uses
  `organization_list_for_user {permission: "update_dataset"}` (the `puedeEditarDataset` check) and is
  distinct from the direct publish gate, that a failed read on either gate yields the unavailable
  state, that the queue's self-approval state and reject-comment requirement are wired, and that the
  wizard copy names the organization administrator as the approver without introducing
  `draft`/`review`/`approved`. Repo/paths: `odp`, `src/routes/dataset/[id]/+page.test.ts`,
  `src/routes/dashboard/datasets/new/+page.test.ts`. Proof: `pnpm vitest run <those files>` → fails.
  TDD: RED for B2.4.

- [ ] **B2.4 GREEN: wire both checks and correct the copy.** Produce: each hint call only when
  `dataset.private`; the request control offered off `puedeEditarDataset` and the direct publish
  control off the `isSuperAdmin` flag, both rendered in the existing hero badges region
  (`src/routes/dataset/[id]/+page.svelte:157,:381`) with the result wired back so the badge flips only
  on CKAN's `200` with `private: false`; the `DatasetForm.svelte` copy edited only to name who
  publishes (`:770,:796,:1429-1430`). The two controls never share a gate. Repo/paths: `odp`,
  `src/routes/dataset/[id]/+page.svelte`, `src/lib/components/datasets/DatasetForm.svelte`. Proof:
  `pnpm vitest run <those files>` → green. TDD: B2.3 first.

- [ ] **B2.5 Playground and human review (rule 8).** Produce: `src/routes/dev/dataset-publish/**`
  rendering the request control, the direct publish control **and** the queue in all their states from
  fixtures. Repo/paths: `odp`,
  `src/routes/dev/dataset-publish/**` (new, temporary). Proof: the user reviews every state at
  `http://localhost:8082/dev/dataset-publish` and says it is ready to promote. This is a human review
  gate, not an automated test. TDD: not applicable.

- [ ] **B2.6 Delete the playground and promote.** Produce: `src/routes/dev/dataset-publish/**` removed
  once B2.5 passed and the real pages carry the control and the queue. Repo/paths: `odp`,
  `src/routes/dev/dataset-publish/**`. Proof: `pnpm build` succeeds with the route absent. TDD: n/a.

- [ ] **B2.7 Portal verify gate.** Produce: the PR's verification section with the four command
  results. Repo/paths: `odp`. Proof: `pnpm test`, `pnpm check`, `pnpm lint`, `pnpm build` — all exit 0
  (`openspec/config.yaml` → `verify.also_run`). TDD: not applicable; consumes B1/B2's RED/GREEN work.

- [ ] **B2.8 Honest end-to-end note.** Produce: a statement in the PR that the portal's happy path is
  only end-to-end verifiable against the running CKAN with PR A deployed, plus either a manual pass at
  `http://localhost:8082` (sysadmin publishes → badge flips; an org admin approves an editor's request
  → badge flips; editor → inline alert, dataset still
  private) or an honest **"not measured"**. Repo/paths: `odp`, the PR description. Proof: the manual
  pass transcript, or the explicit words "not measured" — this is **not** covered by `pnpm test`.
  TDD: n/a.

---

## Coverage map — the specs' requirements to tests and probes

Each requirement of `specs/publication-lifecycle/spec.md` (13 requirements, 81 scenarios) and the
three modified requirements of `specs/dataset-publishing/spec.md` is listed. A `—` in a runner column
means the runner does not cover it; the right column says who does, or that nobody can.

### `specs/publication-lifecycle/spec.md`

| Requirement | Automated test | Live probe | No runner can cover |
|---|---|---|---|
| Publication Authorization | `test_auth.py` (patch/update/create refusals, omitted key, `state`) | `P3`, `P4a`, `P4d`, `P4e`, `P5`, `P5b`, plus the admin-refused rows | — |
| Approver Capacity | `test_auth.py` + `test_publication_actions.py` (approval auth + four eyes) | `P6`/`P10` flipped to `403` by patch; an org admin approves via `publication_request_decide`; the direct `publication_publish` is `sysadmin`-only | — |
| Distinguishable Authorization Errors | `test_auth.py` (two messages; `banana`/`''` are attempts) | message/body assertions on the refusal rows | — |
| No Other Visibility Path | `test_auth.py` (`bulk_update_public` chained refusal) | `P8` now refused by our rule; A3.4 inventory | the full native-action inventory is a review trigger, not a measured claim |
| Publication Request Store | `test_publication_store.py` | door rows: a `pending` row exists; one-pending index | — |
| Publication Request Actions | `test_publication_actions.py` | door paths: create/decide(reject-comment, self-approval refusal, current-state re-check)/publish(sysadmin-only)/cancel/list + annulment + `P-ATOMIC` | — |
| Preserved Refusals | `test_auth.py` | `P6.2a`, `P6.2b`, `P6.3` | — |
| Sysadmin Bypass | `test_auth.py` | `P6.1` and the sysadmin action path | — |
| Published Datasets Reach The Catalogue | none in-repo | `P7` (anonymous count) | **only the live probe** — Solr behaviour; no Python unit or portal runner |
| Portal Publication Affordance | Vitest `PublishControl.test.ts` (sysadmin-flag gate), `RequestPublicationControl.test.ts` + dataset-page test (both gates) | — | the real CKAN calls end-to-end: the repo has no integration/E2E runner → manual (B2.8) |
| Portal Approval Queue | Vitest queue test (required reject reason, self-approval state, a stale request's age and emphasis) | — | the real CKAN call end-to-end → manual (B2.8) |
| No Fabricated Publication | Vitest `PublishControl.test.ts` | — | — |
| Honest Lifecycle Copy | Vitest copy tests | — | the global "no shipped string promises a deferred step" sweep is a **manual read** |

### `specs/dataset-publishing/spec.md` (modified requirements)

| Requirement | Automated test | Live probe | No runner can cover |
|---|---|---|---|
| Visibility | Vitest wizard payload tests (`private: true`, no `state`, never `private: false`) | the CKAN-side refusal is covered by the `Publication Authorization` tests/probe | — |
| Dataset Metadata Fields | Vitest wizard payload tests (pre-existing; unaffected by this cut) | — | — |
| Deferred Interoperability Metadata | Vitest "no DCAT extras" (pre-existing; unaffected by this cut) | — | — |

**What no runner covers, in one sentence.** The repository has no integration or E2E runner
(`openspec/config.yaml`), so the portal's happy path, the catalogue's Solr behaviour, and the
"no shipped string promises a deferred step" sweep are manual or live-probe only — and `pnpm test`
proves the portal's honesty, never CKAN's enforcement.

## Notes for apply

- **PR 1 is merged and is the base, not the target.** A1–A3 amend `86f130b`; they do not extend it
  unchanged.
- **The wall and the door ship together.** Removing the admin's `package_patch` capacity while the
  door does not exist leaves no way to publish; the door's action must land in the same backend slice
  as the wall.
- **The migration is a deployment step.** A1.4's tree is inert until `ckan db upgrade` runs at deploy
  (A6.1). Dev and production diverge (Hazard 3).
- **Never run the extension suite without the two overrides** (Hazard 1). **Never restart the dev CKAN
  container** (Hazard 2).
- **The probe is not optional and not a footnote.** `probe.sh` is the only evidence that covers the
  running image, and it is currently **partly false** (its `P6`/`P10` assume the old contract).
- **`RF-41`/`RF-42` are `[v1]`.** Do not add the downgrade, the `annulled` transition, or
  `bulk_update_private`. The store reserves their columns; `bulk_update_private` is `[v1]`.
- **Do not extend scope** to the editorial machine (`draft`/`review`/`approved`), versioning, the
  collection gate, a search filter, the `current_package_list_with_resources` defect, or the
  `internal`/lifecycle unions of `src/lib/types/dataset.ts`.
- **Do not touch** `openspec/specs/**` in these PRs. Spec promotion is a manual, separate step
  (`openspec/config.yaml`: `sync.manual: true`).
