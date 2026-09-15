# Tasks: Publication Lifecycle

Two PRs, two repositories, **PR 1 first**. PR 1 is the enforcement (`odp-docker`, Python); it alone
satisfies the change's primary success criterion. PR 2 is the portal affordance (`odp`, SvelteKit); it
degrades honestly when PR 1 is absent. Neither PR can be merged as the other's substitute.

Every task names **what it produces**, **which repo and paths it touches**, **what proves it** (a
`pytest` command in `odp-docker`, a `pnpm` command in `odp`, or a live probe against the running CKAN),
and its **strict-TDD expectation**. `openspec/config.yaml` sets `strict_tdd: true`; `odp`'s only runner
is Vitest (`pnpm test`) and it declares **no integration runner and no E2E runner**, so no test task
below claims portal-side coverage of the Python enforcement.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR 1 ≈ 190 (`odp-docker`); PR 2 ≈ 230 (`odp`). Sum ≈ 420 across two repositories |
| 400-line budget risk | **Low per PR**, **High as one change** — the sum is over budget and the halves cannot be one PR (different repositories) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (`odp-docker`: guard + tests + baseline fix + `probe.sh`) → PR 2 (`odp`: `publish()`, `PublishControl`, page wiring, copy) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Low
```

### Why "Decision needed before apply: No"

Delivery strategy is `ask-on-risk`, which pauses **only when the review budget is at risk**. Each PR is
estimated at roughly half the 400-line budget and the split is already fixed by the design, so there is
nothing for the user to decide here. The `pending` chain strategy records that the two-PR structure is a
**cross-repository dependency** (`odp` PR 2 depends on `odp-docker` PR 1), not a stacked chain inside one
repository; no `stacked-to-main` / `feature-branch-chain` label applies until the orchestrator names one.
`size:exception` is **not** requested and must not be inferred.

### Suggested Work Units

| Unit | Goal | PR | Repo | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|---|
| 1 | Chained `IAuthFunctions` guard + tests + red-baseline fix + `probe.sh` | PR 1 | `odp-docker` | `docker exec -e CKAN_SQLALCHEMY_URL="postgresql://ckandbuser:ckandbpassword@db/ckan_test" -e CKAN_SITE_ID="test.ckan.net" odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss && pytest --ckan-ini=test.ini ckanext/umss'` (both `-e` overrides are mandatory — see the hazard note below) | `openspec/changes/2026-09-13-publication-lifecycle/probe.sh` against the running CKAN 2.11.6 | revert `auth.py`, `plugin.py`, `test_plugin.py`; stock CKAN authorization for org editors returns |
| 2 | `publish()` API + `PublishControl` + dataset-page wiring + copy | PR 2 | `odp` | `pnpm vitest run src/lib/api/datasets.test.ts src/lib/components/dataset/PublishControl.test.ts` | dev stack at `http://localhost:8082` | revert the API method, the component, the page wiring and the copy; the CKAN rule keeps working |

---

## PR 1 — Enforcement in `ckanext-umss` (`odp-docker`)

> **⚠ HAZARD — read before running any test command.** The extension suite must **never** be run inside
> the dev container without overriding the database **and** the site id. `test.ini` inherits
> `test-core.ini`, which points at a *test* database (`sqlalchemy.url = postgres://ckan:ckan@db/ckan_test`)
> and a *test* site (`ckan.site_id = test.ckan.net`), but both point at the **same** Solr core as dev. The
> dev container exports `CKAN_SQLALCHEMY_URL`, `CKAN_SOLR_URL` and `CKAN_SITE_ID`, and
> `ckan/config/environment.py:81` maps those settings to exactly those variables — so the env vars win on
> all three and the suite's `clean_db` drops the **dev** schema while its factory datasets get indexed as
> if they were dev's. This is not a theory: on 2026-09-14 the bare command wiped all 16 seeded datasets
> and 5 organizations, replaced them with pytest factory rows, and left orphaned Solr documents. A run
> with only the database override still left 5 factory datasets visible in dev's search. Always run:
>
> ```sh
> docker exec -e CKAN_SQLALCHEMY_URL="postgresql://ckandbuser:ckandbpassword@db/ckan_test" \
>   -e CKAN_SITE_ID="test.ckan.net" \
>   odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss && pytest --ckan-ini=test.ini ckanext/umss'
> ```
>
> Verified with both overrides: `22 passed`, the dev database untouched at 16 datasets, and the anonymous
> index count untouched at 16. If you ever run the suite without them, the index must be repaired with
> `ckan -c "$CKAN_INI" search-index clear` **then** `rebuild` — `rebuild` alone does not purge stale
> documents.
>
> **⚠ Also do not restart `odp-dev-ckan-dev-1` right now.** Its baked entrypoint script
> (`ckan/docker-entrypoint.d/01_setup_datapusher.sh`) blanks `ckan.datapusher.api_token` on every start
> because the CLI call it makes fails under `expire_api_token`; an empty token makes the DataPusher
> plugin refuse to configure (`plugin.py:52`) and the container crash-loops. The script is fixed in
> `odp-docker`, but the running image still has the old copy — the fix needs an image rebuild.

Repo root: `/home/danielblc/projects/odp-docker`. Extension root:
`/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss` (inside the container:
`/srv/app/src_extensions/ckanext-umss`).

### Phase 1.1 — Baseline

- [x] **1.1.1 Record the red `pytest` baseline before touching anything.** Produce: a written record of the
  pre-change suite state in `odp-docker`'s PR description (or `apply-progress.md`), not in this change
  directory. Paths: `…/ckanext-umss/ckanext/umss/tests/test_plugin.py:57`. Proof (live, in the running dev
  image): `docker exec odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss && pytest
  --ckan-ini=test.ini ckanext/umss'` → expect `1 failed`, `NameError: name 'plugin_loaded' is not
  defined`. No TDD expectation: this is a measurement, not a behavior change. If it reports anything other
  than that one failure, stop and re-read design §"Measured baseline" P0.6 before continuing.
  <!-- sdd-owner: implementation -->

- [x] **1.1.2 GREEN: fix `test_plugin.py` so the suite actually runs.** Produce: the plugin-load test fixed
  by taking `plugin_loaded` as a fixture parameter
  (`def test_plugin(self, plugin_loaded):`) instead of calling an undefined name. Paths:
  `…/ckanext-umss/ckanext/umss/tests/test_plugin.py`. Proof: the DB-and-site-overridden `pytest` command
  above → `1 passed` (or the suite's real size) with no `NameError`. RED expectation
  is task 1.1.1: the failure exists and is captured before the fix. **Correction measured during
  `apply`:** `plugin_loaded` is **not** a pytest fixture in 2.11.6, so taking it as a fixture parameter
  cannot work; the load test must assert through the real CKAN test helpers instead. Record what
  actually worked rather than the prescribed signature.
  <!-- sdd-owner: implementation -->

### Phase 1.2 — The guard (strict TDD)

- [x] **1.2.1 RED: failing tests for the update-path predicate.** Produce: a new test module
  `…/ckanext-umss/ckanext/umss/tests/test_auth.py` whose **first collected test fails because
  `ckanext.umss.auth` does not exist yet** — import the module directly and assert the chained functions
  are registered, and do **not** use `pytest.skip` or `xfail` for behavior that is part of this change.
  Cover, in `odp-docker`: org `editor` `package_patch {id, private: false}` → `403`; org `editor`
  `package_patch {id, state: "draft"}` → `403`; org `editor` full `package_update` flipping `private` →
  `403`; sysadmin `package_patch {id, private: false}` → `200` with stored `private=false`; org `admin`
  `package_patch {id, private: false}` → `200`; `private: "banana"` → core validation outcome, **not**
  `403`; unresolvable `id` → core not-found outcome, **not** `403`; `private: false` against a dataset
  whose stored `private` is already `false` → `200` (no transition requested). Use `factories.Dataset` /
  `factories.Organization` / `factories.User` and `helpers.call_action(..., context={'user': …})`.
  Proof: `docker exec odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss && pytest
  --ckan-ini=test.ini ckanext/umss/tests/test_auth.py'` → collection/import failure or failing
  assertions. TDD: this is the RED step for 1.2.2.
  <!-- sdd-owner: implementation -->

- [x] **1.2.2 GREEN: implement `auth.py` for the update shape.** Produce: `PUBLISH_DENIED_MSG`,
  `_is_approver` (via `authz.has_user_permission_for_group_or_org(owner_org, user, 'admin')`),
  `_as_bool` (accepts `bool` and the strings `'true'`/`'false'` the CKAN web form posts), `_load_or_defer`,
  and `@toolkit.chained_auth_function package_update(next_auth, context, data_dict)` implementing
  `PUBLISH_ATTEMPT` of design D1: defer when `private` and `state` are both absent from `data_dict`, defer
  when the package cannot be resolved, defer on an unrecognized value, and return
  `{'success': False, 'msg': PUBLISH_DENIED_MSG}` only for a recognized diff by a non-approver. Paths:
  `…/ckanext-umss/ckanext/umss/auth.py` (new). Proof: the `pytest … tests/test_auth.py` command from
  1.2.1 → all update-path assertions pass. TDD: 1.2.1 must be red first and is the only acceptable reason
  to write this file.
  <!-- sdd-owner: implementation -->

- [x] **1.2.3 RED: failing tests for the create-path guard, including the omitted-key shape.** Produce:
  additional tests in `…/ckanext-umss/ckanext/umss/tests/test_auth.py` covering, in `odp-docker`: org
  `editor` `package_create {owner_org: <own>, private: false}` → `403` **and no dataset created**; org
  `editor` `package_create {name, owner_org}` with `private` **omitted** → `403` **and no dataset
  created**, because an omitted key falls through to CKAN's **public** column default
  (`model/package.py:75`) — the asymmetry with update, where omission leaves the stored value untouched
  (measured P4c), is the point of this task, so assert both sides; org `editor` `package_create` with the
  wizard's payload (`private: true`, no `state`) → `200` with stored `private=true`, `state="active"`;
  org `editor` `package_create` with `private: true, state: "draft"` → **not refused by this rule**
  (stored `state` stays `active`). Proof: `pytest … tests/test_auth.py` → these assertions fail while
  1.2.2's still pass. TDD: RED for 1.2.4.
  <!-- sdd-owner: implementation -->

- [x] **1.2.4 GREEN: implement the `package_create` guard.** Produce:
  `@toolkit.chained_auth_function package_create(next_auth, context, data_dict)` in
  `…/ckanext-umss/ckanext/umss/auth.py`: defer when `data_dict` has no `owner_org`; defer only on an
  **explicit truthy** `private`; treat an absent key exactly like `false`; return the denial otherwise.
  Do **not** guard create-time `state` — it is measured to be silently dropped for every non-sysadmin, so
  a `403` there would be a lie in the opposite direction. Proof: `pytest … tests/test_auth.py` → all
  create-path assertions pass. TDD: 1.2.3 first.
  <!-- sdd-owner: implementation -->

- [x] **1.2.5 RED: failing tests for the preserved refusals and the untouched write paths.** Produce:
  tests in `…/ckanext-umss/ckanext/umss/tests/test_auth.py` covering, in `odp-docker`: org `member`
  `package_patch {id, private: false}` → `403`; editor of another org → `403`; `package_delete` → `200`;
  `resource_create` on its own dataset → `200`; `package_patch {id, title: …}` → `200` with `private`
  still `true`; a full `package_update` that **omits** `private` → `200` with `private` still `true`; an
  `admin` of a **parent** org publishing a **child** org's dataset → `200` (the cascade is measured, P10,
  so it is a test, not an assumption). Proof: `pytest … tests/test_auth.py` → the new assertions fail
  against 1.2.4's guard, which currently over-refuses at least one of these shapes. TDD: RED for 1.2.6.
  <!-- sdd-owner: implementation -->

- [x] **1.2.6 GREEN: make the guard defer everywhere it must.** Produce: the minimum correction to
  `_load_or_defer` / the key-presence logic in `…/ckanext-umss/ckanext/umss/auth.py` so every assertion of
  1.2.5 passes. A failure here means the guard refused a request that asks for no visibility or state
  change, or refused a caller it must not. Proof: the DB-and-site-overridden `pytest` command → the
  **whole** suite green. TDD: 1.2.5 first.
  <!-- sdd-owner: implementation -->

### Phase 1.3 — Registration

- [x] **1.3.1 Register the auth functions and prove a reviewer sees them take effect.** Produce:
  `plugins.implements(plugins.IAuthFunctions)` plus `get_auth_functions()` returning
  `{'package_update': …, 'package_create': …}` on `UmssPlugin`, and nothing else changed. Paths:
  `…/ckanext-umss/ckanext/umss/plugin.py`. Proof, two parts: (a) the DB-and-site-overridden `pytest`
  command → green including 1.1.2's load test; (b) **live probe** —
  `sh openspec/changes/2026-09-13-publication-lifecycle/probe.sh` from
  `/home/danielblc/projects/odp`, which must flip row P3 from the measured `200` to `403`.
  **Correction measured during `apply`:** the design assumed `IAuthFunctions` registration only happens
  at process start and therefore requires `docker restart odp-dev-ckan-dev-1`. It does not — the dev
  container runs the Flask reloader, so the bind-mounted change is registered on its own and a
  pre-restart probe run was already 25/25. **Do not restart the container as part of this proof**, both
  because it is unnecessary and because of the DataPusher hazard noted above. No RED expectation: this
  task wires already-tested functions.
  <!-- sdd-owner: implementation -->

### Phase 1.4 — Live-probe materialization

- [x] **1.4.1 Materialize `probe.sh` as the reviewer-runnable evidence.** Produce: an executable script at
  `openspec/changes/2026-09-13-publication-lifecycle/probe.sh` in **`odp`** (this repository), because the
  change directory lives here and the reviewer of PR 1 needs the script addressable from a path they
  already read; it is carried by **PR 1** even though the enforcement lives in `odp-docker`, since without
  PR 1 the script's expectations cannot be satisfied. Content: the P1→P9 sequence of design §"Live probe",
  using `http://localhost:8082/api/` (nginx proxy in
  `/home/danielblc/projects/odp-docker/frontend-proxy/dev-nginx.conf`), a sysadmin token to create the
  probe org and users and mint per-user tokens via `api_token_create {user, name, expires_in: 1, unit:
  3600}`, then asserting the truth table of design D3 and printing each raw HTTP status and
  `error.__type`. Include the P9 cleanup **in the script**, not as a manual afterthought: `package_delete`
  + `ckan -c "$CKAN_INI" dataset purge`, `organization_purge`, `api_token_revoke` by `jti` resolved
  through `api_token_list {user_id}` (a sysadmin-minted token returns **no** `result.id`), and a final
  anonymous `*:*` count check. Proof: run it against the running stack → P3, P4a, P5, P5b report `403`
  (today they report `200`); P2, P4b, P4c, P6, P6.1, P10 report `200`; P6.2, P8 report `403`; P7 shows the
  anonymous count rise by exactly the number of published datasets. TDD: not applicable — the script is a
  measurement harness, and it is the **only** evidence that covers the running image. Say so in the PR
  description instead of implying pytest proves it.
  <!-- sdd-owner: implementation -->

- [x] **1.4.2 Clean up the probe artifacts and record what remains.** Produce: a confirmation in PR 1's
  verification notes that `probe.sh` left nothing behind. Proof (live): anonymous `package_search?q=*:*`
  `count` back to its pre-run value (baseline 16), zero `probe-lc-*` datasets, zero `probe-lc-*`
  organizations, and `api_token_list` showing no tokens minted by the run. Residual to state plainly:
  CKAN 2.11.6 exposes no user hard-delete, so probe users remain as `state='deleted'` rows — the same
  residual `preproposal.md` §5 already records. Do not claim a clean deletion the platform cannot perform.
  <!-- sdd-owner: implementation -->

### Phase 1.5 — PR 1 verification

- [x] **1.5.1 Run the full extension suite one last time and attach the raw probe output.** Produce: PR 1's
  verification section, carrying the `pytest` summary line and the pasted `probe.sh` transcript (every
  status code and message body), to be consumed by `verify-report.md`. Proof:
  `docker exec odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss && pytest
  --ckan-ini=test.ini ckanext/umss'` → suite green, and the probe transcript contradicting none of the
  design's post-guard expectations. If any row disagrees, the task is not done; do not rephrase the
  expectation to match the output.
  <!-- sdd-owner: implementation -->

---

## PR 2 — Portal affordance (`odp`)

Repo root: `/home/danielblc/projects/odp`. **Depends on PR 1 for its happy path**, and must behave
honestly without it: a `403` becomes the D5 inline alert, never a fabricated success.

### Phase 2.1 — API surface

- [ ] **2.1.1 RED: failing tests for `publish()`.** Produce: tests in `src/lib/api/datasets.test.ts`
  asserting the client posts `package_patch` with **exactly** `{id, private: false}`, that no `state` key
  is present, and that no extension-specific action name is used. Repo/paths: `odp`,
  `src/lib/api/datasets.test.ts`. Proof: `pnpm vitest run src/lib/api/datasets.test.ts` → fails, `publish`
  is not a function. TDD: RED for 2.1.2.
  <!-- sdd-owner: implementation -->

- [ ] **2.1.2 GREEN: add `publish(id)` and drop the dead `setState`.** Produce: `publish(id)` calling
  `client.post<CkanPackage>("package_patch", { id, private: false })` in `src/lib/api/datasets.ts`, and
  removal of `setState` (its `"draft"` vocabulary belongs to the deferred state machine and it has no
  caller). Repo/paths: `odp`, `src/lib/api/datasets.ts`. Proof: `pnpm vitest run
  src/lib/api/datasets.test.ts` → green; `pnpm check` → no error from the removal. TDD: 2.1.1 first.
  <!-- sdd-owner: implementation -->

### Phase 2.2 — The affordance component

- [ ] **2.2.1 RED: failing component tests for every row of the D5 table.** Produce:
  `src/lib/components/dataset/PublishControl.test.ts` covering, with `@testing-library/svelte`: private +
  approver → control labeled "Publicar dataset" with the consequence sentence; private + non-approver →
  no control plus "Solo un administrador de la organización puede publicar este dataset."; private + hint
  failed → no control plus "No se pudo verificar su permiso para publicar." with a working retry; already
  public → no control and no unpublish control; click → `403` → the inline alert and the control offered
  again; click → `200` with `private: true` → "El catálogo no confirmó la publicación." and no success
  state; click → `200` with `private: false` → the page's dataset object is replaced by CKAN's response;
  other failure → explicit error with retry; pending → busy state, no success indicator. Repo/paths: `odp`,
  `src/lib/components/dataset/PublishControl.test.ts` (new). Proof: `pnpm vitest run
  src/lib/components/dataset/PublishControl.test.ts` → fails, component does not exist. TDD: RED for
  2.2.2. Note in the test file's header that this proves the **portal's honesty**, not CKAN's enforcement.
  <!-- sdd-owner: implementation -->

- [ ] **2.2.2 GREEN: implement `PublishControl.svelte`.** Produce: the component with the button, busy and
  disabled states, the inline alert, and the approver / non-approver / unavailable states, using existing
  tokens (`bg-primary`, `text-destructive`, `border-border`) and Lucide icons only — no hex, no emoji, no
  optimistic state. Repo/paths: `odp`, `src/lib/components/dataset/PublishControl.svelte` (new). Proof:
  `pnpm vitest run src/lib/components/dataset/PublishControl.test.ts` → green. TDD: 2.2.1 first.
  <!-- sdd-owner: implementation -->

- [ ] **2.2.3 TIMING: build the playground and get it reviewed before promoting.** Produce:
  `src/routes/dev/dataset-publish/+page.svelte`, a fixture-driven playground rendering the control in all
  its states, per `AGENTS.md` rule 8. Repo/paths: `odp`, `src/routes/dev/dataset-publish/+page.svelte`
  (new, temporary). Proof: the user reviews every state at `http://localhost:5173/dev/dataset-publish` and
  says it is ready to promote. This is a human review gate, not an automated test — do not promote to the
  real page before it passes. TDD: not applicable.
  <!-- sdd-owner: implementation -->

### Phase 2.3 — Dataset-page wiring

- [ ] **2.3.1 RED: failing tests for the approver hint.** Produce: tests asserting the page loads the hint
  via `organization_list_for_user {permission: "admin"}` **only when** `dataset.private`, that it tests
  membership against the dataset's organization id (not against an unfiltered organization list), and that
  a failed hint call yields the unavailable state rather than an offered control. Repo/paths: `odp`,
  `src/routes/dataset/[id]/+page.test.ts` (or the existing dataset-page test file). Proof: `pnpm vitest run
  <that file>` → fails. TDD: RED for 2.3.2.
  <!-- sdd-owner: implementation -->

- [ ] **2.3.2 GREEN: wire the hint and the control into the dataset page.** Produce: the hint call when
  `dataset.private`, the control rendered inside the existing hero badges region next to `visibilityLabel`
  (`src/routes/dataset/[id]/+page.svelte:157`, `:381`), and the result wired back into the page's dataset
  state so the badge flips only on CKAN's `200` with `private: false`. Repo/paths: `odp`,
  `src/routes/dataset/[id]/+page.svelte`. Proof: `pnpm vitest run <the dataset-page test file>` → green.
  TDD: 2.3.1 first.
  <!-- sdd-owner: implementation -->

### Phase 2.4 — Copy

- [ ] **2.4.1 RED: failing tests for the honest copy.** Produce: tests asserting the three wizard strings
  no longer promise a flow that does not exist and do name the organization administrator. Repo/paths:
  `odp`, `src/routes/dashboard/datasets/new/+page.test.ts` (or the wizard's existing test file). Proof:
  `pnpm vitest run <that file>` → fails. TDD: RED for 2.4.2.
  <!-- sdd-owner: implementation -->

- [ ] **2.4.2 GREEN: correct the three strings.** Produce: `src/routes/dashboard/datasets/new/+page.svelte:884`
  and `:909-910` → "Se creará como privado: un administrador de la organización podrá publicarlo.";
  `:1560-1561` → "Todos los datasets se crean como privados. Publicarlo requiere un administrador de la
  organización." Repo/paths: `odp`,
  `src/routes/dashboard/datasets/new/+page.svelte`. Proof: `pnpm vitest run <the wizard test file>` →
  green, and a manual read confirming no shipped string in this change introduces `draft`, `review` or
  `approved` vocabulary, and that no string claims a private dataset is visible only to its author.
  TDD: 2.4.1 first.
  <!-- sdd-owner: implementation -->

- [ ] **2.4.3 Delete the playground and promote.** Produce: `src/routes/dev/dataset-publish/` removed in the
  same PR once 2.2.3's review passed and the real page carries the control. Repo/paths: `odp`,
  `src/routes/dev/dataset-publish/`. Proof: `pnpm build` succeeds with the playground gone and the route
  absent. TDD: not applicable.
  <!-- sdd-owner: implementation -->

### Phase 2.5 — PR 2 verification

- [ ] **2.5.1 Run the portal's verify gate.** Produce: PR 2's verification section with the four command
  results. Repo/paths: `odp`. Proof: `pnpm test`, `pnpm check`, `pnpm lint`, `pnpm build` — all exit 0, per
  `openspec/config.yaml` → `verify.also_run`. TDD: not applicable; this consumes the RED/GREEN work above.
  <!-- sdd-owner: implementation -->

- [ ] **2.5.2 Optional live confirmation of the portal half.** Produce: a note in PR 2 stating that the
  portal's happy path is only end-to-end verifiable with PR 1 deployed, plus either a screenshot-grade
  manual pass or an honest "not run against the running stack". Proof: manual pass at
  `http://localhost:8082` with an org-admin token (publishes → badge flips) and an editor token (inline
  alert, dataset still private). This is **not** covered by `pnpm test`; the repository has no integration
  or E2E runner, so if it is not executed, say "not measured" rather than implying coverage.
  <!-- sdd-owner: implementation -->

---

## Coverage map — design truth table to tasks

| Truth-table row (design D3) | Automated test | Live probe |
|---|---|---|
| editor `package_patch {private: false}` → `403` | 1.2.1 / 1.2.2 | P3 |
| editor `package_patch {state: "draft"}` → `403` | 1.2.1 / 1.2.2 | P4a |
| editor `package_create … private: false` → `403` | 1.2.3 / 1.2.4 | P5 |
| editor `package_create` with `private` omitted → `403` | 1.2.3 / 1.2.4 | P5b |
| editor metadata-only update → `200` | 1.2.5 / 1.2.6 | P4b |
| editor full `package_update` omitting `private` → `200` | 1.2.5 / 1.2.6 | P4c |
| editor `package_delete` / `resource_create` → `200` | 1.2.5 / 1.2.6 | — |
| editor `package_create` with `private: true` → `200` | 1.2.3 / 1.2.4 | P2 |
| org `admin` publishes → `200` | 1.2.1 / 1.2.2 | P6, P10 |
| `sysadmin` publishes → `200` | 1.2.1 / 1.2.2 | P6.1 |
| org `member`, cross-org editor → `403` | 1.2.5 / 1.2.6 | P6.2 |
| anonymous → `403` | 1.2.5 / 1.2.6 | P6.2 |
| `bulk_update_public` → `403` from CKAN's own auth | out of extension scope — not our rule | P8 |
| published dataset reaches anonymous search | out of extension scope | P7 |
| portal `403` / `200`-without-grant / confirmed | 2.2.1 / 2.2.2 | 2.5.2 |

## Notes for `apply`

- **PR 1 before PR 2.** PR 2's happy path depends on the guard; without it, the affordance is the advisory
  convention the proposal's D1 rejects.
- **No `extras` key, no table, no migration.** `proposal.md`'s rollback condition is not met, so no
  down-migration is needed.
- **Do not extend scope** to retraction, lifecycle vocabulary, a search filter, the
  `current_package_list_with_resources` dashboard defect, or `src/lib/types/dataset.ts`'s unused
  lifecycle/visibility unions. All are explicit non-goals.
- **Do not touch** `openspec/specs/**` in these PRs. Spec promotion is a manual, separate step
  (`openspec/config.yaml`: `sync.manual: true`).
