# Design: Publication Lifecycle — the wall and the single door

## Answer first

A dataset becomes public when its stored `private` flips to `false`. Under the accepted model that
flip has exactly **one** carrier: a dedicated CKAN action, which writes a durable
`publication_requests` row and flips `private` **in the same transaction**. The action is reached
through exactly two authorized paths: the **approval path** (`publication_request_decide`),
authorized to an organization `admin` (of the owning organization or a parent one) and to a
`sysadmin`, under **four eyes** — nobody approves a request they created; and the **sysadmin's
recorded direct publish** (`publication_publish`), which is `sysadmin`-only. An organization `admin`
has **no** direct publish path. `package_patch`, `package_update` and `package_create` no longer
publish — **for anyone, including the org admin**. The guard that already lives in `ckanext-umss`
stops being an approver check and becomes a **wall**; the action is the **single door**, and its two
keys are the approval path and the sysadmin's recorded path. `RF-15` step 5 stops being a promise and
becomes the only path, with the `RF-42` direct degradation explicitly deferred to `[v1]`.

This is **scope B** (the full PRD model: store + approval queue), decided by the author on
2026-10-07. The accepted architecture is `odd/tasks/publication-guard-design.md` (Spanish), which the
author accepted on the same day; this document is its fold-in, in the artifact language this repo
writes (`openspec/config.yaml`: OpenSpec artifacts are English).

It replaces the previous `design.md`, which designed the model the author **reverted on 2026-09-14**:
direct publication by the approver with stock `package_patch {private: false}` and no store. The old
document's measured baseline (probe rows P0–P10), its CKAN source citations and its create-time
asymmetry remain the evidentiary floor here; its scope decisions and its D4 do not.

> **The applied PR 1 is the base that changes, not the target.** `odp-docker` commit `86f130b`
> (`feat(umss): refuse publication by non-approvers`, 2026-09-14) is merged and pushed. It closed the
> editor bypass and is load-bearing, but under scope B it permits the wrong thing: its
> `Approver Capacity` contract is "the org admin publishes with `package_patch`", which D1 below
> removes. Do not read PR 1 as the finished rule.

## Reference conventions

Every path resolves against one of these roots. No path is meant to resolve against this change
directory.

| Alias in citations | Resolves to |
|---|---|
| *(bare `src/…`, `openspec/…`, `PRD.md`, `BACKLOG.md`)* | portal repo root `/home/danielblc/projects/odp` |
| `$EXT_ROOT` = `/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss` | the `umss` package, in the second repository (`odp-docker`) |
| `$ODP_DOCKER` = `/home/danielblc/projects/odp-docker` | the `odp-docker` compose/Dockerfile tree |
| *bare `ckan/…`* | the **running** CKAN source root inside `odp-dev-ckan-dev-1`, `/srv/app/src/ckan/ckan`. Never on the host. |

**Version drift, stated because it is load-bearing.** The running stack answers `ckan_version:
2.12.0` (`GET http://localhost:8082/api/3/action/status_show`, measured 2026-10-07), and the
container's `ckan.__version__` is `2.12.0`. The old `design.md` and `apply-progress.md` both record
**2.11.6**, which is what the guard was built and probed against on 2026-09-14. Every `ckan/…`
citation below was re-read against the running 2.12.0 source on 2026-10-07 unless tagged otherwise;
where a path moved between versions that is noted. The applied guard's own docstrings still cite the
2.11.6 path `ckan/logic/schema.py:160-161` (`$EXT_ROOT/ckanext/umss/auth.py:162`); in 2.12.0 that
file is `ckan/logic/schema/__init__.py`. This is a re-measurement trigger, not a style note (see
"D1's base is proven on 2.11.6" in **Not measured / not re-verified**).

## Evidence tags

| Tag | Meaning |
|---|---|
| `[MEASURED]` | Observed against the **running** stack (HTTP response, `docker exec`, or a recorded command transcript). |
| `[SOURCE]` | Read from the running container's CKAN source. Stable core code, but not executing code. |
| `[REPO]` | Read from the portal repo or `odp-docker`. |
| `[INFERRED]` | Follows from cited code but was not exercised. Never a measured claim. |
| `[ESTIMATE]` | A size or scope number. Not measured. |

## Measured baseline

Only measured claims, each with its path:line. Every row is `[MEASURED]` unless the cell says
`[SOURCE]` or `[INFERRED]`. Read the right column as **what the platform does**, not as the target.

### The bypass that PR 1 closed (pre-guard, 2026-09-14, 2.11.6)

| # | Measured | Where |
|---|---|---|
| P3 | org `editor` `package_patch {id, private: false}` → **`200`, stored `private=false`** | `apply-progress.md:253` |
| P4a | org `editor` `package_patch {id, state: "draft"}` → `200`, stored `draft` | `apply-progress.md:254` |
| P4c | editor **full** `package_update` omitting `private` → `200`, `private` **unchanged** | `apply-progress.md:275-276` |
| P5 / P5b | editor `package_create {private: false}`, and `package_create` with `private` omitted → **`200`, stored `private=false`** | `apply-progress.md:257-258` |
| P4d / P4e | editor `package_patch {private: "banana"}` and `{private: ""}` → `200`, stored **public** — `boolean_validator` is a *total* function, it coerces, it never rejects | `apply-progress.md:255-256`, `:363-399`; validator at `ckan/logic/validators.py:160-173` `[SOURCE]` |
| P6 | org `admin` `package_patch {id, private: false}` → `200`, stored `false` (**this is the row D1 removes**) | `apply-progress.md:282` |
| P6.1 / P6.2 / P6.3 | `sysadmin` → `200`; org `member` → `403`; editor of another org → `403`; anonymous → `403` | `apply-progress.md:284-287` |
| P8 | editor `bulk_update_public` → `403` from CKAN's own auth, not from the guard | `apply-progress.md:295` |
| P10 | `admin` of a **parent** org publishes a **child** org's dataset → `200`, stored `false` | `apply-progress.md:288` |

Two more measured behaviours the door depends on:

- **The catalogue follows `private`** (P7): the anonymous `*:*` count rose by exactly the number of
datasets published in the run and returned to its pre-run value after cleanup; the private datasets
never appeared (`apply-progress.md:289-299`).
- **`ignore_auth` cannot be injected from a client**, and `package_create`'s create-time hole is a
real public default, not a hypothetical (create-time chain above; `boolean_validator` above).

Post-guard, the same probe reported **25/25** (`RESULT: 25/25 checks passed`, exit 0,
`apply-progress.md:300`; script at `openspec/changes/2026-09-13-publication-lifecycle/probe.sh`,
373 lines). The extension suite reported **22 passed** (`apply-progress.md:236`) — and that run
destroyed the dev database (hazard 1 below).

### The create-time hole, and why the wall needs two shapes

- `private`'s create-time chain carries **no authorization**: `'private': [ignore_missing,
  boolean_validator, datasets_with_no_organization_cannot_be_private]`
  (`ckan/logic/schema/__init__.py:160-161` `[SOURCE]`; path as `logic/schema.py` in 2.11.6).
- The column default is **public**: `Column('private', types.Boolean, default=False)`
  (`ckan/model/package.py:75` `[SOURCE]`). An omitted key at create is therefore a publication
  attempt, exactly like `false` — the asymmetry P4c measured for updates.
- `package_patch` authorizes through `package_update` (`ckan/logic/auth/patch.py:8` `[SOURCE]`);
  `package_change_state` too (`ckan/logic/auth/update.py:109-117` `[SOURCE]`); `package_delete` too
  (`ckan/logic/auth/delete.py:17` `[SOURCE]`). One chained rule covers all four.
- **`bulk_update_public` does NOT.** Its action calls `_check_access('bulk_update_public', …)` and
  then `_bulk_update_dataset(context, data_dict, {'private': False})` directly
  (`ckan/logic/action/update.py:1232-1243` `[SOURCE]`). Its own auth requires
  `has_user_permission_for_group_or_org(org_id, user, 'update')`
  (`ckan/logic/auth/update.py:262-269` `[SOURCE]`). The wall alone does not cover it.

### The mechanisms the store and the door rest on

- **Migration needs no plugin code.** `ckan db upgrade` walks `config.get('ckan.plugins')`
  (`ckan/cli/db.py:142-162` `[SOURCE]`), runs `_run_migrations(plugin)` per plugin
  (`ckan/cli/db.py:165-172` `[SOURCE]`), exposes `-p/--plugin` (`ckan/cli/db.py:23` `[SOURCE]`) and
  iterates `ckan.plugins` for the upgrade command (`ckan/cli/db.py:93-104` `[SOURCE]`). The `umss`
  package name is the registration; CKAN's own example migration plugin —
  `ckanext/example_database_migrations/plugin.py` — is a `pass` class, and its
  `migration/example_database_migrations/` tree is the layout to copy (`[SOURCE]`, read in the
  container).
- **`MANIFEST.in` already reserves the tree**: `recursive-include ckanext/umss/migration *.ini *.py
  *.mako` (`$EXT_ROOT/MANIFEST.in:5` `[REPO]`). No model, migration or action exists today — the
  extension is `plugin.py` (29), `auth.py` (190) and `tests/` (`$EXT_ROOT/ckanext/umss/` `[REPO]`).
- **`ignore_auth` is a real context key** the action layer honors (`ckan/logic/__init__.py:922`,
  used internally at `:946` `[SOURCE]`), and the API view builds the context **server-side**
  (`ckan/views/api.py:244-249` `[SOURCE]`) while passing the request body as `data_dict`
  (`ckan/views/api.py:280` `[SOURCE]`). A remote client cannot inject context keys.
- **One session, one transaction**: `context.setdefault('session', model.Session)`
  (`ckan/logic/__init__.py:313` `[SOURCE]`). The record write and the flip travel the same session
  `[INFERRED]` — deducing atomicity from this is *not* a measurement (see below).
- **The sysadmin bypass is real**: `is_authorized` returns `{'success': True}` for a sysadmin before
  calling any auth function, unless it carries `auth_sysadmins_check`
  (`ckan/authz.py:224-228` `[SOURCE]`); `context['ignore_auth']` short-circuits earlier still
  (`ckan/authz.py:212` `[SOURCE]`). `has_user_permission_for_group_or_org` itself returns `True`
  for sysadmins and cascades `admin` down the org hierarchy
  (`ckan/authz.py:302-335` `[SOURCE]`; cascade default at `:518`).

### Product inputs

- `RF-15` step 5 makes the request flow mandatory (`PRD.md:151`); `RF-41`/`RF-42` are the two
  degradation cases (`PRD.md:156-163`); the `publication_requests` schema the PRD declares
  (`PRD.md:336`) lacks the `annulled` outcome `RF-42` requires — two independent sources reach that
  conclusion (`references/README.md:96-102`) `[REPO]`.
- The replanning mandate is `BACKLOG.md:1254-1307`; the "hardest decision of the redesign" sentence
  moved to `BACKLOG.md:1297`.

## Decisions

Numbered as the old document numbered its own; each row states what it replaces from the old
`design.md` (the old body carries D1–D6; its summary table's D6 and body D6 disagree — that
inconsistency dies here).

### D1 — The wall: nobody publishes through an update, including the `admin`

`package_update` refuses **every** `private`→public flip and **every** `state` change, with **no
capacity exception**. The old guard returned success for an org admin in that position; that is now a
refusal, and the door is the only way through. Replaces old **D4** (the approver's call is stock
`package_patch`) and re-reads old **D1** (the carrier is still the transition — it is now *denied*
rather than *permitted*).

The refusal message must stay distinguishable: today the guard carries a single string
(`$EXT_ROOT/ckanext/umss/auth.py:58-60` `[REPO]`); the wall adds the admin's own message (publication
goes through the flow, not `package_patch`) so the two callers are not conflated.

### D2 — The store: `publication_requests` lives in `ckanext-umss`

The PRD schema (`PRD.md:336` `[REPO]`) **plus** what the mining found missing: an `annulled` outcome
(`references/README.md:96-102` `[REPO]`) and the `RF-42` motive. Columns: `id`, `dataset_id`,
`requested_visibility` (`public`|`private`), `status` (`pending`|`approved`|`rejected`|`cancelled`|
`annulled`), `requested_by`, `approved_by`, `comments`, `motive`, `created_at`, `decided_at`,
`consumed_at`. A partial unique index enforces **one `pending` per dataset**. Replaces the old
document's explicit exclusion of "the `publication_requests` store".

### D3 — The migration: `migration/umss/**`, registered by plugin name

Alembic tree copied from CKAN's own example (`migration/umss/{alembic.ini, env.py, script.py.mako,
versions/}` with `versions/0001_add_publication_requests.py`), which `MANIFEST.in:5` already
reserves. Registration is the plugin name; `ckan db upgrade` is the runner (D3's evidence above). No
old counterpart — the old design's rollback was "two reverts, no migration". **Consequence:** `ckan
-c <ini> db upgrade` becomes a deployment step in `odp-docker`, and dev and production diverge (dev
hot-mounts the plugin, production bakes it — see **Deployment**).

### D4 — The five actions are the queue, and the door

| Action | Authorized to | Does |
|---|---|---|
| `publication_request_create(dataset_id, comments?)` | a caller who can `update_dataset` in the owning org, dataset is private | writes one `pending` row; **idempotent** (returns the existing pending one) |
| `publication_request_cancel(request_id)` | the requester, or an org `admin` | `pending` → `cancelled` |
| `publication_request_decide(request_id, approve, comments?)` | an org `admin` of the owning org, an `admin` of a parent org, or a `sysadmin` — **never the requester** | `rejected` (a comment is **required**), or `approved` **and flips `private` in the same transaction**; the decision re-checks the dataset's current owner and the requester's current capacity |
| `publication_publish(dataset_id, comments?)` | **`sysadmin` only** | the sysadmin's **recorded** direct path: writes the row and approves/consumes it in the act, on top of CKAN's unflagged sysadmin bypass |
| `publication_request_list(status?)` | anyone who administers or edits in the org | the queue: requests of the orgs where the caller has capacity, plus the caller's own — a caller's own request is listed but not decidable by them |

**Return shape — decided 2026-10-07, and its absence is what cost a round trip with the other repository.**
Every action returns its `publication_requests` row at the **top level**, and the two that flip
(`publication_publish`, and `publication_request_decide` with `approve: true`) **add a `dataset` key**
holding the `package_patch` result, so `result.dataset.private === false` is the caller's confirmation
that the flip landed. `publication_request_decide` with `approve: false` returns the row alone. A portal
MUST read the confirmation from `dataset` and **never** from the top level: a response whose top level
looks public while `dataset.private` is `true` is **not** a success. This was unspecified while A2 was
built, and the mismatch was found by crossing the implemented signature against the component that
consumes it.

**Expiry: decided against, and the queue shows the age instead.** A pending request does **not** expire —
that is a decision, not an omission. The failure it guards against is real: a request approved months
later publishes a dataset that changed underneath it. But an expiry rule needs a new state or a
time-based transition, and it decides *for* the user when an organization pauses or the dataset is still
waiting. The compensating control is information: the queue shows **how long** each request has been
pending, with visible emphasis past a threshold, so a stale request becomes a **visible decision** for
the administrator instead of an accident. The threshold is a **presentation choice, not a policy** —
nothing expires, and a request past it stays decidable.

**Four eyes: nobody approves a request they created.** The store is a **gate, not a log**, and a gate
requires an approver who is not the requester. With self-approval the whole scope degenerates into a
record, and the repository had **already written the principle**: when it parked the old PR 2,
`BACKLOG.md:1705` says «en el modelo del PRD **el que pide no es el que aprueba**» — the stated reason
for parking that branch — and the pre-amendment design contradicted it. Publishing is a decision over
**someone else's** dataset: the org admin's direct path let an admin publish a draft its author was
still working on, with provisional or sensitive data. The refusal MUST be distinguishable and MUST
NOT be a silent no-op: an approver's own request is refused with `403` and a message that names the
four-eyes rule, and the row stays `pending`.

`publication_publish` is **`sysadmin`-only**: an organization `admin` has **no** direct publish path.
The `sysadmin` keeps — and gains — a **recorded** door: the action writes the row, on top of the
bypass CKAN already gives it for free (`ckan/authz.py:224-228` short-circuits unless the auth function
sets `auth_sysadmins_check`, which this design deliberately does not). **Accepted cost, declared:** an
organization whose only admin is the requester now needs a `sysadmin` to publish. The PRD already
accepts the analogous case ("an organization with editors but no admin cannot publish"). The `sysadmin`
remains the emergency path; that is unavoidable and not new, because CKAN already short-circuits its
authorization today.

The approver's `comments` is **required when rejecting** and **optional when approving** (it was
optional in both).

Replaces old **D4** and absorbs old **D3**'s approver predicate, which now authorizes the approval
path and the recorded sysadmin door instead of the flip.

### D5 — The door writes the record and flips the value in one transaction

The action calls `helpers.call_action('package_patch', context={…, 'ignore_auth': True},
data_dict={'id':…, 'private': False})` from server-side code. `ignore_auth` is honored
(`ckan/logic/__init__.py:922` `[SOURCE]`) and **cannot be injected remotely**
(`ckan/views/api.py:244-249,280` `[SOURCE]`). One session (`ckan/logic/__init__.py:313`
`[SOURCE]`) means either both writes commit or neither does `[INFERRED]`. New; it is the concrete
answer to old D4's rejected "extension action". Atomicity is asserted, not yet measured. (The accepted
design writes `helpers.call_action`; the production entry point is
`logic.get_action('package_patch')(context, data_dict)` with the same `ignore_auth` context — apply
should use the non-test call.)

### D6 — The wall's exact shape (the four guard changes)

1. `package_update`: refuse every flip and every `state` change, **no capacity exception**.
2. `package_create`: refuse public creation **for everyone**, including the org admin; an omitted key
   and `false` are the same attempt (D1's evidence). Create is always private; publication is D4.
3. `bulk_update_public`: a **new chained refusal**. Measurement shows it does not delegate to
   `package_update`, so the wall does not cover it alone. `bulk_update_private` is the downgrade
   direction → D8 (`[v1]`).
4. **Not touched**: `_as_bool` stays a faithful mirror of `boolean_validator` (`'banana'` is a
   publication attempt, not a validation error — the apply-progress override; the old spec's
   "unrecognized value defers" clause is false and must be amended), and
   `@toolkit.auth_allow_anonymous_access` stays declared, because chaining drops core's flag
   (`apply-progress.md:400-407`). The **sysadmin bypass stays declared and unflagged**: the guard does
   not set `auth_sysadmins_check`, so a sysadmin remains the system's real escape hatch
   (`ckan/authz.py:224-228` `[SOURCE]`). The sysadmin's **recorded** door is `publication_publish`
   (D4), which writes the row on top of that bypass; the unflagged `package_patch` path stays as the
   emergency escape hatch.

Replaces old **D2** (where the rule sits — still `IAuthFunctions`, now extended) and extends old
**D3** (approver identity survives only as the door's authorization).

### D7 — The portal: two affordances with two gates, and the queue

The portal offers **distinct affordances**, and they must not share a gate. The editor's is a
**request control**; the sysadmin's is a **direct publish control**; the organization `admin`'s is the
**approval queue**. The two page controls live on the dataset page, beside the
hero actions (`src/routes/dataset/[id]/+page.svelte:436-449` `[REPO]`), and each is offered only when
the portal holds the evidence its own action demands.

- **Request control — and the cancel of one's own pending request — for a caller who can
  `update_dataset` in the dataset's owning organization.** The portal **already computes exactly
  this**: `listUpdatableOrganizationIds` (`src/lib/api/organizations.ts:99-110` `[REPO]`, the bulk
  `organization_list_for_user {permission: "update_dataset"}`) feeds `puedeEditarDataset`
  (`src/routes/dataset/[id]/+page.svelte:297-300` `[REPO]`, loaded at `:152-153`). It calls
  `publication_request_create`, and `publication_request_cancel` for the caller's own `pending` row —
  never `publication_publish`. This is the affordance that lets an `editor` without admin capacity
  request publication; without it the portal has no path by which an editor can request anything.
- **Direct publish control for a `sysadmin`**, gated by the portal's existing sysadmin flag —
  `isSuperAdmin` (`src/lib/stores/auth.ts:96` `[REPO]`, a `derived` store over `user.sysadmin`,
  parsed from CKAN's login response at `src/lib/server/ckan-auth.ts:120`, already tested to
  distinguish "`capacity: admin`" from "`sysadmin`" in `src/lib/stores/auth.test.ts:58-63`). **No new
  plumbing is needed**: the portal already knows whether the caller is a sysadmin, so the gate is the
  flag itself and not an organization list. It calls `publication_publish` — never `package_patch`.
- **Approval queue stays admin-only, and enforces four eyes.** It reads `publication_request_list` and
  decides through `publication_request_decide`, both authorized to the org `admin` by the action layer.
  The queue MUST NOT offer a decision on a request the caller created and MUST require a comment to
  reject. It has no natural existing route; the dashboard (`src/routes/dashboard/+page.svelte`, 743
  lines; "Mis datasets" at `:442-451` `[REPO]`) is the cheapest host. The route is a design choice,
  not a measurement.
- **No gate stands in for the other.** An `editor` is offered the request control and **not** the
  direct publish control; an `admin` who is also an `editor` is offered the request control and the
  queue, **never** the direct publish control, and can never decide their own request. Neither control
  may be rendered off the other's check.
- **The parked `PublishControl` is reused, not discarded.** The `wip/pr2-directo-publicacion` branch
  (`6b53c64`) carries `PublishControl.svelte`, its playground and its API wrapper (491 measured code
  lines, 363 measured test lines — `odd/tasks/publication-lifecycle-minimum.md:47-50,68` `[REPO]`);
  its capacity logic, its honest `403` handling and its two state machines survive — only the action
  it calls changes (`package_patch` → `publication_*`). The editor's request control reuses its shape,
  its workspace check and its state machines, not its admin gate.
- The copy that promises "the publication flow decides visibility"
  (`src/lib/components/datasets/DatasetForm.svelte:770,796,1429-1430` `[REPO]`) becomes **true**; it is
  edited only to name who publishes, not rewritten.

Replaces old **D5** (portal hint) and old **D6** (copy).

### D8 — `RF-41` and `RF-42` are `[v1]`

Both degradation directions (requested and direct) are out of this cut, marked `[v1]` with the
reason: they belong to the full lifecycle and arrive with it. The store already carries the columns
they need (`annulled`, `motive`, `decided_at`), and `bulk_update_private` will grow the direct
downgrade. New; it supersedes the old document's "retraction out" line, which excluded **both**
directions for a different reason.

### D9 — How the rule is proven

`pytest` in the extension for intent (the applied `tests/test_auth.py`, 418 lines today, `[REPO]`), plus
the live `curl` probe (`probe.sh`) for the running image. **The probe is part of the base that
changes**: it currently asserts the old `Approver Capacity` contract (an org admin publishes with
`package_patch` → `200`), which D1 turns into a `403`, and it has no rows for the door. The probe's
cases are review material, not code budget. Replaces old **D6** (how the rule is proven).

## Tradeoffs

`openspec/config.yaml` requires a tradeoffs section for designs. This is what the two halves cost.

### What the wall costs

- **The API emergency path is gone.** If the portal is down, an org admin can no longer publish with
  a `curl`. Only a `sysadmin` remains. This is a real operability loss, accepted by the author, and
  it is the single argument against D1.
- **An existing contract becomes false, and must be amended in writing**: the live
  `Requirement: Approver Capacity` (`specs/publication-lifecycle/spec.md:86-122`) and the probe both
  assert that an org admin publishes with stock `package_patch`. Both move to the action.
- **Editors lose `state` changes** (measured reachable: P4a), which the old design already accepted;
  the create-time `state` drop is deliberately not re-guarded.

### What the queue costs

- **New infrastructure in `odp-docker` that does not exist today**: a model layer (no local
  precedent), the migration tree, the five actions, the guard changes, and their tests. The old
  design's estimate budget for the backend was `~600` lines `[ESTIMATE]`
  (`odd/tasks/publication-guard-design.md:170`); this is infrastructure, not a portal-only change.
- **An ordering constraint**: once the wall is in, the portal has **no way to publish** until the
  queue UI lands. The wall and the door must ship together, and the affordance follows.
- **Two repositories, one contract.** The Python lives in `odp-docker`; the portal in `odp`. Neither
  `pnpm test` alone can prove the rule (`openspec/config.yaml`: no integration runner, no E2E runner).

### What is refused

| Rejected | Why |
|---|---|
| The **consultative guard** (the guard reads an approved request) | It makes approval a consumable token; a write lands inside a read predicate, the same request can consume it twice, order matters, and `package_create` has no prior row to attach a request to. The wall has none of those failure modes. |
| **Portal-only convention** | Measured: `package_patch` with the editor's own token published (P3). |
| A **validator** on `private` | Runs after auth; a `409` on a field is indistinguishable from a genuine validation failure, and it cannot say *why* the value changed. |
| `IPackageController` | No pre-update veto exists; its hooks are post-hoc. |
| A full **override** of core `package_update` auth | Re-implements owner-org capacity, the unowned-dataset path, collaborator fallback and `_check_group_auth`. Chaining adds one predicate instead. |
| A **third visibility tier** (`internal`) | `src/lib/types/dataset.ts` declares it; CKAN has no counterpart. It stays declared and unimplemented rather than simulated. |
| `RF-41`/`RF-42` **in this cut** | D8. |

## Hazards

Both are inherited and both have already bitten once; neither is hypothetical.

1. **Never run the extension suite without the database *and* site-id overrides.** The bare
   `pytest --ckan-ini=test.ini` runs against the **dev** database because the container exports
   `CKAN_SQLALCHEMY_URL` (and `CKAN_SOLR_URL`, `CKAN_SITE_ID`), which wins over `test.ini`. On
   2026-09-14 it wiped all 16 seeded datasets and the sysadmin. Run it in a throwaway
   `ckan/ckan-dev` container or with both overrides. Proof and mechanism: `apply-progress.md:32-110`.
2. **Do not restart the dev CKAN container.** A restart crash-loops it: the DataPusher init script
   mints a token without the `expires_in`/`unit` that `expire_api_token` makes mandatory, blanks
   `ckan.datapusher.api_token`, and every `ckan` invocation dies in `load_environment`
   (`apply-progress.md:433-469`). The dev container runs the Flask reloader, so a bind-mounted plugin
   change is picked up **without** a restart anyway (`apply-progress.md:316-320`).

### Deployment

The migration travels only if it is run. **Dev** hot-mounts the extension
(`$ODP_DOCKER/ckan-docker/docker-compose.dev.yml:30` mounts `./src` as `/srv/app/src_extensions`; the
dev image `pip3 install -e`s it — `$ODP_DOCKER/ckan-docker/Dockerfile.dev.umss:14` `[REPO]`) and the
reloader registers changes live. **Production** bakes the extension non-editable
(`$ODP_DOCKER/ckan-docker/Dockerfile.umss:13` `[REPO]`), so the table does not appear until
`ckan -c <ini> db upgrade` runs **at deploy**. A deploy that skips it leaves the guard walling a
dataset that no action can publish.

## The base that changes

PR 1 (`86f130b`, `odp-docker`) is **not** the target. Everything below must move with D1–D9; each is
a separate phase, not this pass.

| Artifact | Change it owes |
|---|---|
| `$EXT_ROOT/ckanext/umss/auth.py` | D1/D6: no capacity exception on `package_update`; public create refused for everyone; the `bulk_update_public` chained refusal. |
| `$EXT_ROOT/ckanext/umss/model.py`, `migration/umss/**`, `logic/action/**`, `logic/auth/**` (new) | D2–D5: the table, the migration, the five actions and their authorization. |
| `$EXT_ROOT/ckanext/umss/plugin.py` | `IActions` for the five actions, next to the existing `IAuthFunctions` (`plugin.py:9,25-28`). |
| `$EXT_ROOT/ckanext/umss/tests/test_auth.py` | The admin now gets `403` from `package_patch`; add the door's cases and `bulk_update_public`. |
| `openspec/changes/2026-09-13-publication-lifecycle/probe.sh` | Rewrite the `Approver Capacity` rows (admin `package_patch` → `403`) and add the door. |
| `openspec/changes/2026-09-13-publication-lifecycle/specs/publication-lifecycle/spec.md` | `Approver Capacity:86-122` moves to the action; `Publication Authorization`'s "an unrecognized value defers to core CKAN" premise is false (P4d/P4e, `apply-progress.md:363-399`) and must be amended; the new requirements live here. |
| `openspec/changes/2026-09-13-publication-lifecycle/specs/dataset-publishing/spec.md` | The copy requirement's flow now exists and must name the actor. |
| `openspec/changes/2026-09-13-publication-lifecycle/proposal.md` | The obsolescence banner (`proposal.md:3-24`) is replaced by scope B; the old D1–D7 product decisions become the new D-table. |
| `openspec/changes/2026-09-13-publication-lifecycle/tasks.md` | New phases and the three-line forecast; the current PR-1/PR-2 split is the reverted model. |
| `openspec/specs/**` (canonical, at promotion) | Promoted only after the change closes; never touched while the change is in flight. |
| `src/lib/components/dataset/PublishControl.svelte` + tests (from `6b53c64`) | Repointed from `package_patch` to `publication_*`; the editor's request/cancel control and the queue screen are new. |

## Not measured / not re-verified

The honest gaps. Each is a review trigger, not a footnote.

| Point | State | How it closes |
|---|---|---|
| The extension's **model layer** (declarative class over CKAN's metadata) | **No local precedent**: the extension has no model, and CKAN's example migration plugin ships migrations, not a model | the first commit of the backend, with a probe |
| **Atomicity** of "record + flip" through `ignore_auth` | `[INFERRED]` from the shared session (`ckan/logic/__init__.py:313`); **not measured** | a probe that forces the flip to fail and asserts the row is absent |
| Native actions that write `private`/`state` **beyond `bulk_update_public`** | **Partial**: `bulk_update_public` is measured (`ckan/logic/action/update.py:1232-1243`); the rest are not inventoried | an inventory probe before the guard is extended |
| **D1's base is proven on 2.11.6, the stack now runs 2.12.0** | Version drift, measured 2026-10-07 (`status_show`) | re-run the full probe against the running image while applying |
| The queue's **portal route** | a design choice, not a measurement | the author reviews it per `AGENTS.md` rule 8 |
| Backend size `~600` lines | `[ESTIMATE]` from the old design; the wall's own cost is unmeasured | forecast at tasks time, with the three separated lines |

## Explicitly out of scope

The editorial state machine of `RF-15` steps 1–3 (`draft` → `review` → `approved`) and any
`draft`/`review` CKAN `state` vocabulary; versioning (`RF-14`/`16`/`17`); the collection-level
approval gate (`RF-23`); a search filter by publication status; the
`current_package_list_with_resources` dashboard defect; enabling or hiding CKAN's own visibility
selector; production deployment of the extension image; and the `DatasetVisibility`/lifecycle unions
in `src/lib/types/dataset.ts`, which stay declared and unimplemented rather than simulated.

`RF-41`/`RF-42` are deferred by D8, not excluded: the store reserves their columns and
`bulk_update_private` is their future carrier.

## Open reconciliations

- The accepted design (`odd/tasks/publication-guard-design.md`) is written for the whole store +
  queue; the author's frozen formula names scope B. This document folds the accepted design in
  without adding the `RF-15` steps 1–3 editorial machine, which the accepted design does not specify
  either. If "the full PRD model" was meant to include that machine, this scope is narrower and the
  design needs a second document before apply.
- The accepted design still cites `BACKLOG.md:1269-1272` for the "hardest decision" sentence; that
  sentence moved to `BACKLOG.md:1297`. The substance is unchanged; the citation is stale.
- `openspec/config.yaml` still describes the backend as "CKAN 2.11"; the running stack is 2.12.0.
  The config's context is a documentation artifact, not a design input, and was not edited here.
- The accepted design names the test helper `helpers.call_action` for the door's flip (D5). It is a
  naming shorthand; the production call must be `logic.get_action`. Not a design contradiction, but
  worth pinning in the first backend commit.
