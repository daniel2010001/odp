# Explore: Publication Lifecycle (`2026-09-13-publication-lifecycle`)

**Status: exploration only. No option is chosen here. The choice needs product input.**

> **⚠ Superseded in part by `preproposal.md`.** This document was written from a CKAN **2.12.0a0 source
> checkout**, not from the running deployment (CKAN **2.11.6**), because that phase had no shell.
> Its CKAN behavior claims have since been measured against the running stack and **three of them are
> wrong or incomplete**: `package_change_state` does not exist as an action, `state: "draft"` **is**
> honored by `package_patch` on an existing package (the drop is create-time only), and
> `ckan.auth.reveal_private_datasets` was never mentioned. Read `preproposal.md` §2 for the measured
> evidence, and treat it as authoritative wherever the two disagree.

## Answer first

A dataset created by the portal today is stored as `private: true, state: active`. Nothing can make it
public, so nothing created in the portal ever appears in the catalogue. The wizard's own copy says so:
"Todos los datasets se crean como **privados**: el flujo de publicación es el que decide cuándo pasan a
ser públicos."

Three findings drive everything else:

1. **`private` and `state` are both writable by the dataset's own owner.** An ordinary organization
   *editor* holds `update_dataset` (`ROLE_PERMISSIONS`), and CKAN's `package_update`,
   `package_change_state` and `package_patch` all authorize on it. `private` is a plain field of
   `package_update`. So an editor can flip a dataset public through the CKAN action API alone, bypassing
   any portal-side review step. **A review step implemented only in the portal is advisory, not
   enforced.**
2. **`private` is not "visible only to the author"**: it is "readable by every member of the owning
   organization" (`DefaultPermissionLabels`). That is already what the portal's UI copy promises, but it
   matters when designing an approval step: org members can read drafts and private datasets.
3. **CKAN's native `state` has exactly three meaningful values in practice — `active`, `deleted`,
   `draft` — and no approval semantics at all.** Worse, `state` is *silently dropped* for non-sysadmin
   users on `package_create`. Storing `draft`/`review`/`approved` in `state` is not viable.

Option B (third-party extension) **cannot be assessed from inside this repository** — see §7.

## Method and evidence limits — read this before trusting any claim

| Tag | Meaning |
|---|---|
| `[READ — repo]` | Read from this repository at the cited `file:line`. |
| `[READ — ckan]` | Read from a CKAN source checkout on this host: `/home/danielblc/backup-windows/universidad/c4/ckan`, `ckan/__init__.py` reports `__version__ = "2.12.0a0"`. **This is not the running 2.11.6 container.** Behaviors cited here are stable core permission/schema code, but they were **not** measured against 2.11.6. |
| `[RECORDED]` | A measurement made in a **prior** session by another agent and recorded in `PRD.md` / `BACKLOG.md` / `openspec/specs/`. Not re-verified now. |
| `[NOT RUN]` | A probe this phase was asked to perform that **was not executed**. |

**Why the live probes were not run.** This executor runtime exposes file-reading tools only — `read`,
`grep`, `find`, `codegraph`, `edit`, `write`, `mem_save`. There is no shell/execution tool, so
`docker exec odp-dev-ckan-dev-1 ckan -c /srv/app/ckan.ini …` and any HTTP call to
`http://localhost:8082/api/3/action/…` are impossible from here. Two further reads were blocked by the
harness policy: `.env.example` in both repos (reported as a "sensitive path"), so the plugin list and
`ckan.auth.allow_dataset_collaborators` are only known from the parent's injected measurement and from
`BACKLOG.md`, never read first-hand.

**Probe hygiene (as required):** no package was created, no token was minted, nothing was deleted or
purged — because no probe ran. There is nothing left behind in CKAN to clean up. This is a true
statement about the absence of activity, not a claim of cleanup work performed.

## 1. The problem as it stands today

| Fact | Evidence |
|---|---|
| Every portal-created dataset is written with `private: true` and no `state` field | `[READ — repo]` `src/routes/dashboard/datasets/new/+page.svelte:147` builds `private: true`; `[READ — repo]` `wizard.test.ts` asserts the payload is exactly `{title, name, owner_org, private: true}` |
| The visibility selector was deliberately removed from the form | `[READ — repo]` the wizard copy at `+page.svelte:884`, `:909-910` ("La visibilidad del dataset la definirá el flujo de publicación") and the summary tooltip at `:1560-1561` |
| The schema default is still `private: true` | `[READ — repo]` `src/lib/schemas/dataset.ts:149` (`private: z.boolean().default(true)`) |
| `state` is omitted, so CKAN's column default applies: `active` | `[READ — ckan]` `ckan/model/package.py:76` (`Column('state', …, default=core.State.ACTIVE)`) |
| The portal *has* an API method for state transitions, and **nothing calls it** | `[READ — repo]` `src/lib/api/datasets.ts:88-90` `setState(id, "active" \| "deleted" \| "draft")` → `package_patch`; a repo-wide grep finds no caller |
| A full lifecycle vocabulary is already *declared* but unused | `[READ — repo]` `src/lib/types/dataset.ts:34` `DatasetLifecycle = "draft" \| "review" \| "approved" \| "published"`; `:35` `DatasetVisibility = "private" \| "internal" \| "public"`; `:36` `AccessStatus`. No `lifecycle_status`/`approval`/`publication_request` string exists anywhere in `src/` |
| The catalogue searches **anonymously**, so even the owner does not see a private dataset in `/search` | `[READ — repo]` `src/routes/search/+page.svelte:94-103` calls `createCkanClient({ baseUrl: env.CKAN_URL })` with no `apiKey`; `:145` the same for the catalogue total |
| The dataset detail page *does* carry a token (fixed in `f8e6b09`) and explains a 403 | `[READ — repo]` `src/routes/dataset/[id]/+page.svelte:54-70`; message "Este dataset es privado. Inicie sesión con una cuenta autorizada para verlo." |
| The "My datasets" dashboard list cannot show private datasets to a non-sysadmin | `[READ — ckan]` `ckan/logic/action/get.py:141-143` — `current_package_list_with_resources` calls `package_search` with `include_private: authz.is_sysadmin(user)`. `[READ — repo]` `src/routes/dashboard/+page.svelte:58-59` uses exactly that action. In dev this is masked because the seed/admin user is a sysadmin. |

Spec drift worth recording now, because this change will have to reconcile it:

- `openspec/specs/dataset-publishing/spec.md` still requires an explicit **Visibility** choice with a
  "Public submission → `private: false`" scenario. The code removed that control. The spec is stale.
- The same spec says "**No `extras` are written in `v0`**". The code writes one:
  `[READ — repo]` `src/lib/utils/dataset-payload.ts:64-67` writes `extras: [{ key: SUMMARY_EXTRA_KEY, … }]`
  with `SUMMARY_EXTRA_KEY = "summary"` (`src/lib/utils/dataset-summary.ts:14`), and its own test asserts
  `payload).not.toHaveProperty("extras")` in one case and `extras).toEqual([{key: "summary", …}])` in
  another. The "no extras" rule is now "no *DCAT* extras"; the spec text says something stronger.

## 2. What CKAN 2.11 actually gives us

### 2.1 `private` versus `state`

Two independent columns with different jobs (`[READ — ckan]` `ckan/model/package.py:75-76`):

| Field | Values in practice | What it controls |
|---|---|---|
| `private` | boolean | Whether the dataset is readable outside the owning organization. |
| `state` | `active` / `deleted` / `draft` | Whether the dataset is a live row, a soft-deleted row, or a draft. |

`state` is validated only by `ignore_not_package_admin, ignore_missing`
(`[READ — ckan]` `ckan/logic/schema.py:157`). There is **no `one_of` validator**, so the value is not
restricted to those three strings — a caller with the right permission can store arbitrary text there,
and the search filters (`+state:(active OR draft)`) would simply never match it. `private` is validated by
`ignore_missing, boolean_validator, datasets_with_no_organization_cannot_be_private`
(`schema.py:160-161`).

**Can a package be created with `state: "draft"`?** By a **sysadmin**, yes — `ignore_not_package_admin`
returns immediately for sysadmins (`[READ — ckan]` `ckan/logic/validators.py:566-567`). By a **non-sysadmin
editor**, the value is **silently deleted** from the payload: during `package_create`, `context['package']`
is never set, so the validator cannot authorize state changes, and it does `data.pop(key)`
(`validators.py:556-580`); `package_create` itself (`ckan/logic/action/create.py::package_create`)
never sets `allow_state_change`. The create succeeds and the dataset is `active`. **This is the single
most important reason not to use `state` as a lifecycle carrier.** `[NOT RUN]` — worth confirming on
2.11.6 with a non-sysadmin editor; the source says the request returns 200 and the state is `active`.

**Does a draft appear in `package_search`?** No. `[READ — ckan]` `ckan/logic/action/get.py:1874-1887`:
unless the caller passes `include_drafts=true` (which nothing in the portal does), CKAN appends
`+state:(active)`, and `ckan/lib/search/query.py:411-412` independently forces `+state:active` when no
`+state` clause is present. In addition, `+capacity:public` is prepended whenever `include_private` is
false (`get.py:1878-1879`), where `capacity` is `public`/`private` derived from the `private` flag at
index time (`[READ — ckan]` `ckan/lib/search/index.py:174-178`).

**Does a draft appear in `package_show` for another user?** No — *unless that user is in the owning
organization*. `package_show` authorizes through permission labels
(`[READ — ckan]` `ckan/logic/auth/get.py:105-118`), and the default labels are
(`[READ — ckan]` `ckan/lib/plugins.py:644-687`):

```python
def get_dataset_labels(self, dataset_obj):
    if dataset_obj.state == 'active' and not dataset_obj.private:
        return ['public']                       # the only way to be world-readable
    labels = []                                 # private OR draft → not public
    if dataset_obj.owner_org:
        labels.append('member-%s' % owner_org)  # every member of the org
    else:
        labels.append('creator-%s' % creator_user_id)
    return labels
```

So a draft (and a private dataset) is readable by **every member of the owning organization** because
`get_user_dataset_labels` grants `member-<org>` to anyone with `read` in that org
(`plugins.py:669-678`). `allow_dataset_collaborators` is off in this stack `[RECORDED]`
(`BACKLOG.md`, v0 item: the flag "no está en `.env.example`"), so the `collaborator-*` labels do not
exist here. `[NOT RUN]` — unverified against the running container; `.env.example` is blocked from
reading by the harness policy.

### 2.2 What `package_patch` allows

`[READ — ckan]` `ckan/logic/action/patch.py:16-58`: `package_patch` is
`_check_access('package_patch')` → `package_show` → `dict.update(data_dict)` → `package_update`.
It is not a separate permission surface; **it is `package_update` with merge semantics.** It accepts any
top-level package field, `private` included, and the merged dict naturally carries whatever `state` was
already there.

`[READ — ckan]` `ckan/logic/auth/update.py:14-24` — `package_update` requires
`has_user_permission_for_group_or_org(package.owner_org, user, 'update_dataset')`.
`[READ — ckan]` `ckan/authz.py:248-253`:

```
admin  = ['admin', 'membership']
editor = ['read', 'delete_dataset', 'create_dataset', 'update_dataset', 'manage_group']
member = ['read', 'manage_group']
```

and `has_user_permission_for_org` treats the `admin` permission as a wildcard (`authz.py:352-359`).

Therefore, for an organization dataset:

| Actor | Can `package_patch` `private`? | Can change `state`? |
|---|---|---|
| org **editor** | **Yes** | **Yes** — `package_change_state` delegates to `package_update` (`auth/update.py:110-118`), which fails for nobody with `update_dataset` |
| org **admin** | Yes | Yes |
| org **member** | No (`member` has only `read`) | No |
| sysadmin | Yes | Yes, plus `state` is honored on `package_create` |
| anonymous | No | No |

### 2.3 Where the lifecycle would live today

| Candidate carrier | Status in this deployment | Evidence |
|---|---|---|
| `package.state` | Not viable: 3 values, no semantics, silently dropped on create for non-sysadmins, free-form strings not validated | §2.1 |
| `package.private` | Binary only; no `internal` tier exists in CKAN. The declared portal type `DatasetVisibility = "private" \| "internal" \| "public"` has no CKAN counterpart; `internal` would have to be encoded elsewhere | `[READ — repo]` `src/lib/types/dataset.ts:35` |
| a `lifecycle_status`-style extra | **Does not exist anywhere.** No such key in `src/`; but a precedent for portal-owned extras **does** exist: `summary` (RF-40) | `[READ — repo]` `dataset-summary.ts:14`, `dataset-payload.ts:64-67` |
| `ckanext-umss` | **An empty scaffold.** `[READ — odp-docker]` `ckanext/umss/plugin.py` implements only `IConfigurer` (adds template dir, public dir, one asset bundle). There is no `IAuthFunctions`, no `IActions`, no `IPackageController`, no `IPermissionLabels`, no permission or package-create hook of any kind. Its test suite asserts only that the plugin loads. | `[READ — odp-docker]` `ckanext-umss/ckanext/umss/plugin.py`, `tests/test_plugin.py` |
| an own DB table | The portal has **no database** — see §2.5 | |

For completeness, the extension points that Option C would use do exist in this CKAN line:
`IAuthFunctions`, `IActions`, `IValidators`, `IDatasetForm`, and `IPackageController` including
`after_dataset_create`, `after_dataset_update`, `before_dataset_index`, `before_dataset_view`
(`[READ — ckan]` `ckan/plugins/interfaces.py:451`, `:461`, `:527`, `:537`), plus `IPermissionLabels`
(`:1905`).

An extra is also *filterable* in search if that is ever wanted: extras are copied to `extras_<key>` at
index time with non-`[A-Za-z0-9_-]` characters stripped (`[READ — ckan]` `index.py:31`, `:139-149`), and
the Solr schema declares `<dynamicField name="extras_*" type="text" indexed="true" stored="true"
multiValued="false"/>` (`[READ — ckan]` `ckan/config/solr/schema.xml:172`). Two caveats: it is a **`text`**
field (tokenized, not an exact-match string) and **`multiValued="false"`**, so duplicate keys of the same
extra collide. `[NOT RUN]` — the running Solr is a `ckan/ckan-solr` image; its actual schema was not
inspected.

### 2.4 The versioning designs assume a database that the portal does not have

`[READ — repo]` the entity-versioning item in `BACKLOG.md` records two designs — (A) denormalized
`datasets` + `dataset_versions` with a sync trigger, (B) normalized with a `datasets_current` view — and
already carries the warning that both assume a relational database of the portal's own.

That warning is correct and stronger than it is stated there. The platform has **no portal-side
database at all**:

- `package.json` has no ORM, no DB driver, no migration tool — dependencies are `@lucide/svelte`,
  `bits-ui`, `class-variance-authority`, `clsx`, `markdown-it`, `papaparse`, `tailwind-merge`, `zod`
  (`[READ — repo]` `package.json`).
- The only own-backend routes are two thin forwarders to CKAN: `src/routes/auth/login/+server.ts` and
  `src/routes/auth/logout/+server.ts`.
- All dataset writes are browser→CKAN through `/api/`; `[READ — odp-docker]`
  `frontend-proxy/dev-nginx.conf` routes `/api/` to `ckan-dev:5000` and `/` to the Vite server.
- Postgres/Solr/Redis in the compose stack belong to CKAN, not to the portal
  (`[READ — odp-docker]` `ckan-docker/docker-compose.dev.yml`).

**Implication:** "A or B" is not the open question. The open question is *where the schema lives at all* —
inside `ckanext-umss` (which then owns migrations, and CKAN's Alembic setup), or in a new portal-owned
database (which would be the portal's first stateful component and a substantial architectural change to a
deliberately stateless, headless-CKAN frontend). That decision sits downstream of the lifecycle decision;
choosing A/B now would freeze a schema for a state model that does not exist yet.

## 3. The permission boundary — the sharp edge

**Yes, an ordinary org editor can currently flip `private` to `false` and `state` to `active` through the
API alone.** There is no portal involvement, no approval, and no CKAN-side hook that could notice: the
stack's plugin list contains no extension that overrides package auth
(`image_view text_view datatables_view datastore datapusher envvars expire_api_token umss`), and `umss`
is an empty `IConfigurer` scaffold.

Consequences that constrain any design:

1. **A review/approval step implemented only in the portal UI is advisory.** The editor holds a token in
   `localStorage` and CKAN accepts it directly on `/api/3/action/package_patch`.
2. **To be enforceable, the rule must live in CKAN** — an `IAuthFunctions` override (or an
   `IPackageController`/validator that refuses the transition) inside `ckanext-umss`, or an
   `IPermissionLabels`/`IAuthFunctions` plugin from a third party. This is exactly what option (C)
   buys, and what option (A) cannot buy by itself.
3. **Enforcement is not "review" — it is a permission change**: once you deny `package_update`'s
   `private`/state transitions to editors, you have altered the meaning of the stock `editor` role for
   every dataset in the platform, including the CKAN web UI. That is a product decision, not just an
   implementation one.
4. The portal already depends on editors having `update_dataset`: the wizard offers organizations from
   `organization_list_for_user(permission="create_dataset")`
   (`[RECORDED]` `openspec/specs/dataset-publishing/spec.md`, measured 2026-09-11).
5. `ckan.auth.allow_dataset_collaborators` is **off** `[RECORDED]`, so the `dataset_collaborators`
   mapping the PRD assumes (RF-18) is unavailable and collaborator-based permission labels do not exist
   in this deployment.

## 4. What happens today when the wizard creates a dataset

Payload built by `buildPackagePayload` (`[READ — repo]` `src/lib/utils/dataset-payload.ts:52-69`) →
`POST /api/3/action/package_create` (JSON, `Authorization: <token>`), then per-resource
`resource_create` (multipart for files, JSON for links).

| Field | Value sent | Value stored | Evidence |
|---|---|---|---|
| `private` | `true` (hardcoded) | `true` | `+page.svelte:147`; `wizard.test.ts` payload assertion |
| `state` | *(absent)* | `active` (column default) | `[READ — ckan]` `model/package.py:76` |
| `extras` | `[{key: "summary", …}]` when a summary was typed | same | `dataset-payload.ts:64-67` |

Net effect: the dataset is `active` **and** `private`. It is hidden not by state but by `private` — it
appears in the Solr index with `capacity: private` and permission labels `member-<org>` only. The
catalogue (`package_search`, anonymous) never returns it; the org's members can read it if they know the
URL, and any org editor can edit it.

## 5. What would have to change for an approved dataset to become visible

| Change | Needed? | Why |
|---|---|---|
| Set `private: false` on approval | **Yes, mandatory** | `capacity`/`permission_labels` at index time derive from `private`; nothing else can make a dataset world-readable (`[READ — ckan]` `lib/plugins.py:653`, `index.py:174-178`) |
| Set `state: active` | No, in the portal path | It already is `active`; only relevant if a draft state is introduced |
| Change the catalogue query | **No** for visibility; **possibly yes** for filtering | `/search` uses an anonymous `package_search`; a dataset with `private:false, state:active` appears with no code change. If the portal wants "only approved datasets visible", it needs an explicit filter clause — today `buildFilterQuery` (`src/lib/utils/ckan.ts:9-31`) emits `organization:`, `res_format:`, `tags:`, `license_id` and nothing about visibility, and `SearchParams.visibility` (`src/lib/types/search.ts:8`) is **declared but never read** |
| Reindex | No explicit step | CKAN reindexes on update; the Solr index is maintained by CKAN, not the portal |
| Update `/dashboard/datasets/new` copy | Yes | The wizard tells the user the flow will decide visibility; the flow must exist before that copy is true |
| Reconcile `openspec/specs/dataset-publishing/spec.md` | Yes | Its Visibility requirement (explicit private/public choice) now contradicts the code |

## 6. Realistic options and trade-offs (no recommendation)

Trade-offs only; each row names what it buys, what it costs, and what it **cannot** do.

### A — Portal-side custom, `package.extras` + `private`, transitions in a portal `+server.ts` endpoint

- **Buys:** smallest change surface; pure SvelteKit work in a repo with 301 green tests; total control
  over the state names; precedent already exists for a portal-owned extra (`summary`); two
  `+server.ts` endpoints already exist as a pattern.
- **Costs:** the portal grows its first *stateful* authorization logic; every state transition is a
  `package_patch` the portal makes on the user's behalf, so the truth lives in CKAN but the rules live in
  SvelteKit.
- **Cannot:** enforce anything. §3 applies — the editor can patch `private` directly. Also cannot store
  the review history durably without a database (§2.4), and cannot express "who may approve" as a CKAN
  permission.
- **Extra caveat:** `extras_*` in Solr is a tokenized `text` field, single-valued (`schema.xml:172`).

### B — Third-party CKAN workflow extension

- **Buys (in principle):** the flow, the review UI, the state machine and — critically — the auth
  enforcement at the API layer, which is the one thing option A cannot provide.
- **Costs (in principle):** an external dependency pinned into the image, a compatibility matrix against
  the floating `ckan/ckan-dev:2.11` base (`[READ — odp-docker]` `Dockerfile.dev.umss`), and interaction
  with `ckanext-umss` and `expire_api_token`.
- **Cannot be assessed here.** See §7.

### C — Own extension (`ckanext-umss`) implementing the lifecycle

- **Buys:** enforcement at the CKAN layer via `IAuthFunctions` / `IActions` / `IValidators`, which is the
  only place the §3 bypass can be closed; ownership of migrations if a table is needed; the ability to
  expose a lifecycle-specific endpoint the portal calls.
- **Costs:** Python + CKAN plugin work in a *different repository* (`odp-docker`), with its own release
  path into the image, its own test setup (currently an empty scaffold with one trivial test), and a
  second language/toolchain in a project that is otherwise SvelteKit + Biome + Vitest.
- **This is the user's stated preference** `[RECORDED]` (`BACKLOG.md`: "Preferencia expresada por el
  usuario: extensión propia, con algo más liviano si conviene").
- **Open sub-question:** C and A are not mutually exclusive. Nothing decided today prevents a thin C
  (enforcement + state storage) plus an A-shaped portal UI.

### Option matrix against the requirements that block

| Requirement | A (portal extras) | B (third party) | C (own extension) |
|---|---|---|---|
| RF-15 states `draft → review → approved` | Yes, as data | Yes | Yes, authoritatively |
| RF-15 "review cannot be bypassed" | **No** | Yes | Yes |
| RF-16 version record per approval | No (no DB) | Depends | Yes (own table) |
| RF-17 minor edits do not version | N/A | Depends | Yes |
| RF-23 approval per owning org | Partly (portal roles only) | Depends | Yes (`package_change_state`-style auth) |
| RF-33 audit trail | No (no DB) | No | Partly (RF-34 wants `audit_logs` + triggers) |
| Review workload / 400-line budget | Smallest | Unknown | Largest, split across two repos |

## 7. Can option B be assessed from inside this repository?

**No.** Concretely:

- No third-party workflow extension is vendored, cloned, pinned or referenced anywhere in `odp`,
  `odp-docker`, or the CKAN source checkout. A case-insensitive grep for `ckanext-workflow`,
  `ckanext-datasetapproval`, `ckanext-approvalworkflow`, `ckanext-versions`, `ckanext-datasetversions`
  and `ckanext-event-audit` across `/home/danielblc/projects` returns **only mentions inside
  `BACKLOG.md` prose** — no source, no lock entry, no compatibility record.
- The measured plugin list contains none of them.
- This runtime has **no network access and no evidence grants**, and the SDD research lane is
  fail-closed, so upstream repositories, release tags, issue trackers and PyPI metadata cannot be read.
- The only prior evidence is a single unverified line in `BACKLOG.md` (`[RECORDED]`): "`ckanext-versions`
  declara compatibilidad sólo con CKAN 2.9; `ckanext-datasetversions` es una alternativa aparte" — first-hand
  compatibility with the running 2.11.6 was **not** established even then. Note also that the BACKLOG
  option text says "verificar compatibilidad con CKAN 2.10", which is itself stale: the stack runs 2.11.

Conclusion: option B must be either dropped deliberately or researched later with network access and an
explicit evidence grant. It cannot be fairly weighed against A and C in this phase, and any
"comparison" written here would be fabrication.

## 8. Open questions

Product / policy decisions that block the proposal:

1. **Who has the right to make a dataset public?** If the answer is "only an org admin, never the editor
   who wrote it", the editor role must lose a capability in CKAN — a platform-wide change (option C).
   If the answer is "the org's editors too", then the review step is a workflow convention, not a
   control, and option A suffices.
2. **Is `review → approved` a real control or a checklist?** §3 makes this the fork in the road.
3. **Does "internal" exist?** `DatasetVisibility` declares `private | internal | public`, but CKAN has no
   third tier. Is `internal` required, and if so what does it mean (org-readable is already what
   `private` gives)?
4. **Must a published dataset be retractable?** Un-publishing (public → private) after the fact, and what
   happens to citations/`/dataset/[id]` links.
5. **Who is the approver in terms of CKAN identities?** `org_admin` maps to capacity `admin`; the PRD's
   `steward` has no CKAN equivalent (RF-18 collaborators are off).
6. **Is a durable approval record required for v1?** RF-16/RF-33/RF-34 imply yes, which forces the
   §2.4 database question early rather than later.
7. **Where do versions live** — `ckanext-umss` tables or a new portal database — and does the answer
   differ from where the lifecycle lives?
8. **Does approval emit a version, or only state?** RF-16 says a new version per approval; RF-17 says
   minor edits do not version. The boundary between "minor edit" and "version" is undefined.

Verification questions that need the running stack (may be answered with the commands in §10):

9. Does `package_create` with `state: "draft"` really return 200 with `state: "active"` for a non-sysadmin
   editor on 2.11.6?
10. Does the running deployment's search actually exclude private datasets from
    `current_package_list_with_resources` for a non-sysadmin (the §2.1 source claim is from 2.12.0a0)?
11. What does the running Solr's schema do with an `extras_lifecycle_status` field — tokenized text,
    filters as expected?
12. Is `allow_dataset_collaborators` really off in the running container?
13. Does 2.11.6 expose `package_purge`? `[RECORDED]` `BACKLOG.md` says no, so probe cleanup must go via
    `docker exec … ckan dataset purge`.

## 9. What I could NOT determine

| Gap | Why | What would close it |
|---|---|---|
| Every live probe requested in §1 and §3 of the brief | This runtime has no shell/execution tool | Run the §10 commands |
| `state: "draft"` behavior on **2.11.6** | Only a 2.12.0a0 checkout is readable | Probe on the container |
| Whether the **2.11.6** `current_package_list_with_resources` hides private datasets from non-sysadmins | Same version gap; this affects the dashboard, already shipped | Probe with a non-sysadmin editor |
| The running Solr's schema and `extras_*` behavior | No shell, no container filesystem access | `curl` the Solr admin/schema API |
| `ckan.auth.allow_dataset_collaborators`, the full plugin list, `expire_api_token` settings, `CKAN_MAX_UPLOAD_SIZE_MB` as configured | `.env.example` is blocked by the harness safety policy in **both** repos; the plugin list is taken from the parent's injected measurement | Read `.env` from the container or have the parent pass the values |
| Any CKAN version-specific behavior of `ignore_not_package_admin` under a custom `IDatasetForm` | No IDatasetForm in play, and `umss` has no custom schema | Not needed until option C adds one |
| Whether `package_purge` is exposed in 2.11.6 | `[RECORDED]` claim only | Probe |
| Option B: compatibility, maintenance, quality, review UI, licence of any third-party workflow extension | §7 | Network access + explicit evidence grant |
| Whether the 2.12.0a0 checkout corresponds byte-for-byte to 2.11.6 on these paths | Checkout reports `2.12.0a0`; the image tag is the floating `ckan/ckan-dev:2.11` | Diff against the container's site-packages |
| Anything about the seed data's `state`/`private` distribution in the running CKAN | No shell | `package_search` with `include_private=true` |

## 10. Commands to run on the stack (NOT RUN here)

Listed so the decision phase can turn every `[NOT RUN]` above into measured evidence. All of them go
through the app proxy at `http://localhost:8082/api/` as the brief specifies.

```sh
# 0. Baseline: what the catalogue actually shows anonymously
curl -s 'http://localhost:8082/api/3/action/package_search?q=*:*&rows=0'
curl -s 'http://localhost:8082/api/3/action/package_search?q=*:*&rows=0&include_private=true'

# 1. Sysadmin token (expire_api_token makes expires_in/unit mandatory)
#    docker exec odp-dev-ckan-dev-1 sh -c 'echo $CKAN_SYSADMIN_PASSWORD'
curl -s -X POST http://localhost:8082/api/3/action/api_token_create \
  -H 'Content-Type: application/json' \
  -d '{"user":"<sysadmin>","expires_in":1,"unit":3600}'

# 2. Can a sysadmin create state=draft, and does it show up anywhere?
curl -s -X POST http://localhost:8082/api/3/action/package_create \
  -H "Authorization: <token>" -H 'Content-Type: application/json' \
  -d '{"name":"probe-draft-2026-09-13","owner_org":"<org>","private":true,"state":"draft"}'
# then, with the SAME token: package_show, and anonymous package_show -> expect 403/404
# then with include_drafts=true: package_search -> expect it to appear for the org's members

# 3. Non-sysadmin editor: is state silently dropped on create?
#    Re-run step 2 with the editor's token and inspect the returned state.

# 4. The bypass: can an org EDITOR flip private/state with a plain patch?
curl -s -X POST http://localhost:8082/api/3/action/package_patch \
  -H "Authorization: <editor-token>" -H 'Content-Type: application/json' \
  -d '{"id":"probe-draft-2026-09-13","private":false,"state":"active"}'

# 5. Does an org MEMBER (read-only) see a private dataset?
curl -s -X POST http://localhost:8082/api/3/action/package_show \
  -H "Authorization: <member-token>" -H 'Content-Type: application/json' \
  -d '{"id":"probe-draft-2026-09-13"}'

# 6. Is the lifecycle extra filterable in the running Solr?
#    package_update with extras:[{key:"lifecycle_status",value:"approved"}], then
curl -s -G 'http://localhost:8082/api/3/action/package_search' \
  --data-urlencode 'q=*:*' --data-urlencode 'fq=extras_lifecycle_status:approved'

# 7. CLEANUP (package_purge is not exposed by the API here; use the CLI)
docker exec odp-dev-ckan-dev-1 ckan -c /srv/app/ckan.ini dataset purge probe-draft-2026-09-13
# and revoke every token minted above, by jti (api_token_revoke expects `jti`, not `token`)
curl -s -X POST http://localhost:8082/api/3/action/api_token_list \
  -H "Authorization: <token>" -H 'X-CSRFToken: <csrf>' -d 'user_id=<uuid>'
```

## Appendix — source map

| Claim | Path |
|---|---|
| `compute` — private/draft exclusions in search | `ckan/logic/action/get.py:1874-1887`; `ckan/lib/search/query.py:411-417` |
| dashboard list excludes private for non-sysadmins | `ckan/logic/action/get.py:141-143` |
| permission labels (private == org-readable, drafts not public) | `ckan/lib/plugins.py:644-687` |
| `capacity` and `extras_*` indexing | `ckan/lib/search/index.py:174-178`, `:139-149`, `:276-281` |
| Solr dynamic fields | `ckan/config/solr/schema.xml:129-130`, `:172` |
| `state` / `private` schema entries | `ckan/logic/schema.py:157`, `:160-161` |
| `ignore_not_package_admin` (drops `state`) | `ckan/logic/validators.py:556-580` |
| `package_update` / `package_change_state` auth | `ckan/logic/auth/update.py:14-24`, `:110-118` |
| `package_show` auth via labels | `ckan/logic/auth/get.py:105-118` |
| role → permission table | `ckan/authz.py:248-253`, `:299-360` |
| `package_patch` is `package_update` | `ckan/logic/action/patch.py:16-58` |
| package columns / defaults | `ckan/model/package.py:75-76` |
| extension hooks available for option C | `ckan/plugins/interfaces.py:451`, `:461`, `:527`, `:537`, `:1905` |
| `ckanext-umss` is an empty scaffold | `odp-docker/ckan-docker/src/ckanext-umss/ckanext/umss/plugin.py` |
| base image is the floating `2.11` tag | `odp-docker/ckan-docker/Dockerfile.dev.umss` |
| proxy topology (portal has no server in the write path) | `odp-docker/frontend-proxy/dev-nginx.conf` |
| wizard hardcodes `private: true` | `src/routes/dashboard/datasets/new/+page.svelte:147` |
| payload builder + portal-owned `summary` extra | `src/lib/utils/dataset-payload.ts:52-69`, `src/lib/utils/dataset-summary.ts:14` |
| unused `setState` | `src/lib/api/datasets.ts:88-90` |
| catalogue search is anonymous | `src/routes/search/+page.svelte:94-103`, `:145` |
| declared-but-unused lifecycle/visibility types | `src/lib/types/dataset.ts:34-36`, `src/lib/types/search.ts:8` |
