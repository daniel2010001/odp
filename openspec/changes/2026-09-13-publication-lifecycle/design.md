# Design: Publication Lifecycle (private → published, enforced inside CKAN)

## Answer first

A dataset becomes public when `private` flips to `false`, and only an organization `admin` (or a
`sysadmin`) is allowed to flip it. The rule is enforced in the `umss` extension
(`ckanext-umss`, `/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss/`) as an
`IAuthFunctions` plugin that wraps CKAN's own `package_update` and `package_create` authorization
functions, so the transition is refused with `403` before validation or persistence — for the API,
for CKAN's web UI and for the portal alike. The portal adds one honest affordance on the dataset
page and never asserts a publication CKAN did not grant.

| # | Decision | Chosen | Rejected |
|---|---|---|---|
| D1 | Carrier of the transition | The **`private`** value change (`true → false`), plus any **`state`** value change, compared against what the database currently stores | `state` as the only carrier; an `extras` lifecycle marker; a validator-only distinction |
| D2 | Where the rule sits | **`IAuthFunctions`**, chained onto core `package_update` and `package_create` | `IValidators`; `IPackageController`; `IPermissionLabels`; portal-only convention |
| D3 | Approver identity in CKAN | `authz.has_user_permission_for_group_or_org(pkg.owner_org, user, 'admin')` — org `admin` capacity, plus `sysadmin` (which CKAN short-circuits before any auth function) | A new extension-defined permission; a portal-side role table |
| D4 | The approver's call | Stock **`package_patch {id, private: false}`** from the browser, with a custom denial message from the auth function | An extension action with an explicit intent name (`umss_dataset_publish`) |
| D5 | How the portal knows what it may offer | One `organization_list_for_user {permission: "admin"}` probe; the dataset's org present in that list ⇒ offer the control. The `403` remains the decision | Re-deriving role logic in SvelteKit; a "try and see" button for everyone |
| D6 | How the rule is proven | `pytest` in the extension (`/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss/`) for intent, plus a **live `curl` probe** against the dockerized CKAN 2.11.6 for behavior (no E2E runner exists) | Vitest only (cannot execute Python); pytest only (does not prove the running image) |

### Reference conventions

Every path in this document resolves against one of these roots. No path is meant to resolve against
the change directory.

| Alias in citations | Resolves to | Checked |
|---|---|---|
| *(bare `src/…`, `openspec/…`, `AGENTS.md`)* | portal repo root `/home/danielblc/projects/odp` | yes, read in this phase |
| `/home/danielblc/projects/odp-docker/…` | the second repository (`odp-docker`) | yes |
| `$EXT_ROOT` = `/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss` | the `umss` extension package (`ckanext-umss`) | yes |
| `$CKAN_SRC` = `/home/danielblc/backup-windows/universidad/c4/ckan` | the CKAN `2.12.0a0` checkout read on this host | yes, read in this phase |
| any path starting with `/srv/app` | **inside the CKAN container**, never on the host | container-only, per the orchestrator |

## Context and evidence tags

Every CKAN claim below carries a tag. Read them before trusting any sentence.

| Tag | Meaning |
|---|---|
| `[MEASURED]` | Measured in a prior phase against the **running** CKAN 2.11.6 stack. Recorded in `preproposal.md` §2. |
| `[SOURCE:2.12.0a0]` | Read from the CKAN checkout `$CKAN_SRC` (`2.12.0a0`). Stable core authorization/schema code, but **not** the running version. Probe **P0.1–P0.5** re-read the same paths inside the running container on 2026-09-14 and found every tagged path identical in 2.11.6, so the tagged claims below are now facts about the version that runs. The tag is kept to record provenance. |
| `[REPO]` | Read from the portal repo (`/home/danielblc/projects/odp`) or `odp-docker`. |
| `[PROBE]` | Not measured. Listed in "Open questions" with the probe step that closes it. |

Settled inputs (from `preproposal.md` §6, not re-opened here): enforcement is CKAN-side (D1); two
visibility levels only (D2); the dashboard defect is out of scope (D3); the slice is
private → published only (D4); the approver is org `admin` + `sysadmin`; retraction is out; no
lifecycle `extras` marker is written.

Measured constraints the design must not contradict `[MEASURED]`:

| Constraint | Where it bites |
|---|---|
| An org `editor` holds `update_dataset`; `package_patch` and `package_update` authorize on it; `private` is a plain field | The whole reason this change exists |
| Cross-org → `403`; read-only `member` → `403` | Baseline that must not regress (probe P6.2) |
| `package_create` silently drops `state` for non-sysadmins, returning `success: true`; `package_patch` on an existing package honors `state` | The guard must not try to guard create-time `state` |
| `private: true` = readable by every member of the owning organization | Copy must say so; `internal` stays unimplemented |
| The portal has no database; the browser writes to CKAN through `/api/` | No portal-side state, no request record, no optimistic lifecycle |
| The extension is a `SingletonPlugin` implementing **only** `IConfigurer` (its single method is `update_config`) `[REPO]` (`$EXT_ROOT/ckanext/umss/plugin.py`) | The enforcement is net-new Python in a second repository |

## Decisions

### D1 — The carrier is the transition, not a marker

The guard reads the **currently stored** `private` and `state` values and refuses a request that
explicitly changes them. Nothing is stored to represent "in review"; the dataset's `private` flag
already is the state.

```
PUBLISH_ATTEMPT(stored, requested) :=
      requested.private is False and stored.private is True
   OR requested.state is present and requested.state != stored.state
```

| Alternative | What it buys | Why it is not chosen |
|---|---|---|
| **`private` only** | Smallest possible blast radius: only the visibility flag is guarded | Leaves `state` writable by editors. `ignore_not_package_admin` states CKAN's intent is that only package admins change `state` (`$CKAN_SRC/ckan/logic/validators.py:556-580` `[SOURCE:2.12.0a0]`); the only reason an editor can change it today is that the validator's `check_access('package_change_state')` delegates back to the too-permissive `package_update` auth. Fails the proposal's success criterion ("…or change `state`") |
| **`state` as the only carrier** | A lifecycle vocabulary (`draft`/`active`) that looks like a state machine | Measured to be unusable at create time for non-sysadmins `[MEASURED]`; drafts are invisible to the catalogue by default, so every reader path would need `include_private` **and** `include_drafts`; and `state` cannot make a dataset public by itself |
| **An `extras` lifecycle marker** (e.g. `lifecycle=published`) | A durable record readable by anyone with `package_show` | Field decisions cannot refuse anything (`package_patch` could write `private:false` and the marker in one call, and the guard would have to reconcile two fields); it needs a probe of the 2.11.6 `package_extra` table and Solr stemming semantics; and it is redundant with `private`, which already carries the answer (the proposal's "no marker" decision) |
| **A validator-only distinction** (custom `private` validator) | No auth override | Wrong layer: it runs *after* authorization, produces a `409 Validation Error` on a field instead of a `403`, and a validator cannot tell why the value changed |

**The measured hole this carrier must also close: `package_create` with `private: false`.** The
wizard always hardcodes `private: true` `[REPO]`
(`src/routes/dashboard/datasets/new/+page.svelte:147`), but CKAN's create-time validator chain for
`private` is `ignore_missing, boolean_validator, datasets_with_no_organization_cannot_be_private`
(read back in the running container: `ckan/logic/schema.py:160-161`, 2.11.6) — nothing there is
authorization. Only `state` is dropped at create for non-sysadmins `[MEASURED]`. **Measured on
2026-09-14 (P5): an org editor called `package_create {owner_org: <own org>, private: false}` and got
`200` with a stored `private=false`, `state=active` dataset** — a public dataset that never passed
through `package_update`. The guard covers it because the hole is real, not because it might be.

The **omitted-key** shape is a second and more dangerous hole, because it needs no explicit intent: at
create time `ignore_missing` makes an absent `private` fall through to the column default, and that
default is **public** — `Column('private', types.Boolean, default=False)`
(`ckan/model/package.py:75`, 2.11.6). So `package_create {owner_org: <own org>}` — no `private` at all —
yields a public dataset. **Measured on 2026-09-14 (P5b): `200`, stored `private=false`, `state=active`.**
The create guard therefore treats absent and `false` alike and defers only on an explicit truthy value.
This is also the only reason ordinary creation looks private today: the wizard always sends
`private: true`.

Note the asymmetry the same run measured (P4c): a **full `package_update` that omits `private` leaves the
stored value untouched** (`200`, `private` stayed `true`). Omission is a publish attempt *only at create
time*. Enforcing that distinction is the whole reason the guard has a separate `package_create` shape
instead of reusing the update one.

### D2 — Where the rule sits: chained `IAuthFunctions` on `package_update` and `package_create`

| Alternative | Blast radius it creates | Verdict |
|---|---|---|
| **`IAuthFunctions` on `package_update`** | One place covers three actions: `package_patch`, `package_change_state` and `package_delete` all authorize by delegating to `package_update` (`$CKAN_SRC/ckan/logic/auth/patch.py:7-8`, `$CKAN_SRC/ckan/logic/auth/update.py:110-118`, `$CKAN_SRC/ckan/logic/auth/delete.py:16-19` `[SOURCE:2.12.0a0]`). Also covers `package_revise` (auth passes the fully revised dict, which carries `id`) | **Chosen.** The denial is a `403` at the authorization layer, exactly where "am I allowed to do this?" belongs |
| `IValidators` (plugin-provided validator on `private`) | Runs after auth; would have to re-query the DB for the old value; returns `409` with a field error, indistinguishable from a genuine validation failure to the portal and incompatible with the requirement "an editor gets a distinguishable error, not a generic validation failure"; also affects the web UI and the API identically | Rejected |
| `IPackageController` | **Cannot veto an update in this CKAN line.** `IPackageController` exposes `after_dataset_create`, `after_dataset_update`, `edit` and `after_dataset_delete` (`$CKAN_SRC/ckan/plugins/interfaces.py:424-544` `[SOURCE:2.12.0a0]`) — all post-hoc. Raising from `after_dataset_update` means refusing after the transaction has already applied the change, and CKAN's own docstring says the bulk actions bypass it | Rejected |
| `IPermissionLabels` | Changes who can *see* a dataset, not who can change it. Would give a read-restriction, not a write-restriction | Rejected |
| **Portal-only convention** (SvelteKit endpoint, or a button that only approvers see) | Nothing. `package_patch` with the editor's own token still publishes `[MEASURED]` | Rejected — this is decision D1 of the preproposal |
| A new extension action (`umss_dataset_publish`) as the *only* enforcement point | Would not close the bypass: `package_patch` remains callable directly. It could only be an *additional* surface | Rejected as redundant; see D4 |

**Why chained rather than a full override.** `package_update`'s core auth is not trivial: it checks
owner-org capacity, the unowned-dataset config path, optional collaborator fallback and
`_check_group_auth` (`$CKAN_SRC/ckan/logic/auth/update.py:14-47` `[SOURCE:2.12.0a0]`). Re-implementing
it in the plugin means re-implementing its bugs and its future fixes. `IAuthFunctions` supports
chaining (`toolkit.chained_auth_function`, `$CKAN_SRC/ckan/authz.py:95-135` `[SOURCE:2.12.0a0]`), so
the plugin can run the core decision first and add one predicate.

**If chaining is unavailable in the running 2.11.6 — fallback.** Probe **P0.4** greps the container
for `chained_auth_function` in its `ckan/plugins/toolkit.py`. If it is absent, the guard is written as
a plain `package_update` override that calls the core function
(`ckan.logic.auth.update.package_update`) directly and then applies the same predicate. Same
behavior, ~10 more lines, one more upgrade liability. The design does not depend on which of the two
shapes is available.

**Sysadmin fallback is preserved for free.** `authz.is_authorized` returns `{'success': True}` for
any sysadmin *before* the registered auth function is called, unless that function carries
`auth_sysadmins_check` (`$CKAN_SRC/ckan/authz.py:207-232` `[SOURCE:2.12.0a0]`). The guard does not set
that flag, so a sysadmin never reaches it. Probe P0.2 re-reads this in the container and P6.1 measures
it.

**Blast radius of denying the transition to editors** (all rows verified against the code cited
above; the behavioral ones are re-measured in the probe):

| Surface | Effect |
|---|---|
| `package_patch {private: false}` by an editor | `403` with the plugin's message (**the deliverable**) |
| `package_patch {state: …}` by an editor | `403` — restores the intent of `ignore_not_package_admin` at the auth layer |
| `package_update` (full replace) flipping either field by an editor | `403` |
| `package_revise` flipping either field by an editor | `403` (auth receives the revised full dict) |
| **CKAN web UI edit form**, editor edits metadata | Unaffected: the visibility `<select name="private">` posts the dataset's current value, so no diff is requested. `[SOURCE:2.12.0a0]` `$CKAN_SRC/ckan/templates/package/snippets/package_basic_fields.html:66` renders that select for **any** org-owned dataset, and it posts `True`/`False` **strings** — the guard normalizes them |
| **CKAN web UI edit form**, editor sets visibility to Public | `403` + CKAN's flash error. Accepted: CKAN's web UI is an operational crutch in `v0` (`openspec/config.yaml` context), and hiding the selector is cosmetic work this slice does not take |
| **CKAN web UI edit form**, editor edits a `state: draft` dataset | `403` (the state `<select>` offers only `active`/`deleted` and defaults to `active`, and `state != 'active'` is what makes it render — `$CKAN_SRC/ckan/templates/package/snippets/package_basic_fields.html:111-121`). Accepted and currently unreachable: the portal creates `active` datasets and drafts are not part of this slice |
| `package_delete` by an editor | Unaffected: its auth passes `{id}` only, so the guard sees no `private`/`state` key |
| `resource_create` / `resource_update` / `resource_view_create` by an editor | Unaffected: these authorize `package_update` with `{'id': pkg.id}` only (`$CKAN_SRC/ckan/logic/auth/create.py:59-92` `[SOURCE:2.12.0a0]`) |
| `package_create_default_resource_views` (fires during `package_create`) | Unaffected: the package dict passed has the stored value, so no diff |
| `bulk_update_public` / `bulk_update_private` / `bulk_update_delete` | **Not routed through the guard** — they write the `package` table directly. They are already org-`admin`-only: their auth requires the `'update'` permission, and `get_roles_with_permission('update')` returns only `admin` (`$CKAN_SRC/ckan/logic/auth/update.py:253-275`, `$CKAN_SRC/ckan/authz.py:289-296` `[SOURCE:2.12.0a0]`). Consistent with the approver definition; re-measured in P8 |
| Internal callers using `context['ignore_auth'] = True` (CLI, `package_update`'s own post-write `package_show`, seed scripts) | Bypass the guard by design (`$CKAN_SRC/ckan/authz.py:209-210`). A sysadmin can always override; this is the accepted operational escape hatch |

### D3 — The rule, exactly

New module in the extension: `$EXT_ROOT/ckanext/umss/auth.py`, that is
`/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss/ckanext/umss/auth.py`. The existing
`$EXT_ROOT/ckanext/umss/plugin.py` adds `plugins.implements(plugins.IAuthFunctions)` and returns
`_auth_functions()`. Shape (not final code — implementation belongs to `apply`):

```python
PUBLISH_DENIED_MSG = toolkit._(
    'Only an organization administrator can publish a dataset'
)

def _is_approver(context, owner_org):
    """Org admin capacity (CASCADES down the org hierarchy), plus sysadmin via CKAN itself."""
    if not owner_org:
        return False
    return authz.has_user_permission_for_group_or_org(
        owner_org, context.get('user'), 'admin')

def _as_bool(value):
    """True/False for what CKAN's boolean_validator accepts; None for anything else."""
    # bool, plus 'true'/'false' — the CKAN web form posts the strings 'True'/'False'.

@toolkit.chained_auth_function
def package_update(next_auth, context, data_dict):
    result = next_auth(context, data_dict)            # core decision, untouched
    if not result.get('success'):
        return result
    if 'private' not in data_dict and 'state' not in data_dict:
        return result                                  # not a visibility request
    pkg = _load_or_defer(context, data_dict)            # None => return result
    if pkg is None:
        return result
    wanted_private = _as_bool(data_dict.get('private', pkg.private))
    wanted_state   = data_dict.get('state', pkg.state)
    if not ((wanted_private is False and bool(pkg.private))
            or (wanted_state is not None and wanted_state != pkg.state)):
        return result
    if _is_approver(context, pkg.owner_org):
        return result
    return {'success': False, 'msg': PUBLISH_DENIED_MSG}

@toolkit.chained_auth_function
def package_create(next_auth, context, data_dict):
    result = next_auth(context, data_dict)
    if not result.get('success'):
        return result
    owner_org = data_dict.get('owner_org')
    if not owner_org:
        return result                     # unowned datasets cannot be private; not our transition
    if _as_bool(data_dict.get('private')) is True:
        return result                     # explicit true: this is not a publish attempt
    # At CREATE time an absent `private` is NOT "keep what is stored": `private` sits in the
    # schema's `ignore_missing` chain, so an omitted key falls through to the column default, and
    # CKAN datasets default to PUBLIC. An omitted key is therefore a publish attempt, exactly like
    # an explicit `private: false`. Only an explicit truthy value may defer here.
    if _is_approver(context, owner_org):
        return result
    return {'success': False, 'msg': PUBLISH_DENIED_MSG}
```

Three properties make this safe rather than clever:

1. **Missing keys mean "no request".** `package_delete`, `resource_create` and metadata edits pass
   `private`/`state` absent or unchanged, so they keep working. Only an explicit diff is refused.
2. **Unrecognized values defer.** `private: "banana"` is not interpreted here; the core path rejects
   it with a validation error. The guard must not convert a `409` into a `403`.
3. **Unresolvable packages defer.** If the current row cannot be loaded, the guard returns the core
   result. That is not a hole: the core path also needs the package to write anything, so a request
   the guard cannot resolve cannot publish either.

`state` is **not** guarded at create time on purpose: it is measured to be silently dropped for
every non-sysadmin `[MEASURED]`, so a guard there would produce a `403` for a request CKAN was never
going to honor — a lie in the opposite direction.

**Truth table** (after the change):

| Caller | Call | Expected |
|---|---|---|
| org `editor` | `package_patch {private: false}` on its own org's dataset | `403` + plugin message |
| org `editor` | `package_patch {state: "draft"}` | `403` |
| org `editor` | `package_create {owner_org: own, private: false}` | `403` (post-guard; measured `200` today, P5) |
| org `editor` | `package_create {owner_org: own}` — **`private` omitted entirely** | `403` — an omitted key resolves to CKAN's **public** default, so it is the same publish attempt as `false` |
| org `editor` | `package_update` metadata only (`private: true` unchanged) | `200`, stored values unchanged |
| org `editor` | `package_delete` | `200` (soft delete) |
| org `editor` | `resource_create` on its dataset | `200` |
| org `editor` | `package_create` with the wizard's payload (`private: true`, no `state`) | `200`, stored `private: true`, `state: "active"` |
| org `admin` | `package_patch {private: false}` | `200`, stored `private: false` |
| `sysadmin` | any of the above | `200` |
| org `member` | `package_patch {private: false}` | `403` (no regression) |
| editor of another org | `package_patch {private: false}` | `403` (no regression) |
| anonymous | `package_patch {private: false}` | `403` (no regression) |

### D4 — The approver's call is stock `package_patch`

The portal calls `POST /api/3/action/package_patch {id, private: false}` through the same `/api/`
proxy the wizard already uses. No new action, no new transport.

| Alternative | Buys | Costs |
|---|---|---|
| **Stock `package_patch`** (chosen) | Zero new server surface in Python; the enforcement already exists in the auth layer, so the call is ordinary; CKAN's own `activity` records the update; the response is `package_show` of the updated dataset, i.e. CKAN's own answer | The intent ("publish") is not visible in the wire call — a generic `package_patch`. Recovery: the portal's wrapper is named `publish()` and the UI says what it means |
| Extension action `umss_dataset_publish` | An explicit intent name, a place to grow a durable request record later, a dedicated error type | A second authorization path to keep in sync with the auth function, more Python, more tests, more review surface — and it does **not** replace the `IAuthFunctions` rule, because `package_patch` stays callable. Pure addition for cosmetic naming |

**The error is distinguishable because it is an authorization error, not a validation error.** The
guard returns `{'success': False, 'msg': …}` from an auth function, so CKAN raises `NotAuthorized` →
HTTP **`403`** with `error.__type = "Authorization Error"` and the plugin's message. A validation
failure would be **`409`** with field errors. The portal maps those two cases differently, which is
the answer to "how does an editor get a distinguishable error".

### D5 — What the portal offers, and what it shows when CKAN refuses

**How the portal learns it may offer the control (no duplicated logic).** A single action call,
`organization_list_for_user {permission: "admin"}`, and a membership test against
`dataset.organization.id`:

- For a non-sysadmin, CKAN filters by `get_roles_with_permission('admin')`, which returns only the
  `admin` capacity, with cascade over parent organizations
  (`$CKAN_SRC/ckan/logic/action/get.py:675-720`, `$CKAN_SRC/ckan/authz.py:289-296`
  `[SOURCE:2.12.0a0]`).
- For a sysadmin it returns **every** active organization with `capacity: "admin"`
  (`$CKAN_SRC/ckan/logic/action/get.py:675-680` `[SOURCE:2.12.0a0]`), so the sysadmin case needs no
  second rule.

That is the same predicate the guard uses (`has_user_permission_for_group_or_org(…, 'admin')`), read
through CKAN instead of re-implemented. `src/lib/api/organizations.ts::listForUser` already accepts
the `"admin"` permission and already tolerates the cosmetics call failing `[REPO]`.

| Situation | What the dataset page shows |
|---|---|
| Dataset already public | Nothing. Retraction is out of this slice, so there is no "unpublish" control |
| Dataset private, user is an approver of its org | A "Publicar dataset" button with an explicit consequence sentence ("Será visible en el catálogo público") |
| Dataset private, user is not an approver | No button. A short line stating who can publish: "Solo un administrador de la organización puede publicar este dataset." |
| Dataset private, the hint call failed | No button, explicit "no se pudo verificar su permiso" state with retry. Deliberately fails the *affordance* closed rather than showing a button that lies |
| Click → CKAN `403` (capacity changed between hint and click, or the hint was wrong) | Inline alert: "Solo un administrador de la organización puede publicar este dataset." Button re-enabled |
| Click → CKAN `200` but the response's `private` is not `false` | "El catálogo no confirmó la publicación." State unchanged — **the portal never reports what CKAN did not grant** |
| Click → `200` and `private === false` | Badge flips to "Público"; the local dataset object is replaced by CKAN's response |
| Any other failure | `describeCreateError`-style mapping, same pattern the wizard already uses `[REPO]` (`src/routes/dashboard/datasets/new/+page.svelte:507`) |

No optimistic UI: the state shown after a click is the JSON CKAN returned, never an assumption.

### D6 — Copy that stops promising a flow that does not exist

The wizard's three strings currently describe a flow that has no implementation `[REPO]`
(`src/routes/dashboard/datasets/new/+page.svelte:884`, `:909-910`, `:1560-1561`). They become true,
and specific about who publishes:

- `:884` / `:909-910`: "La visibilidad del dataset la definirá el flujo de publicación." →
  "Se creará como privado: un administrador de la organización podrá publicarlo."
- `:1560-1561`: "Todos los datasets se crean como privados: el flujo de publicación es el que decide
  cuándo pasan a ser públicos." → "Todos los datasets se crean como privados. Publicarlo requiere un
  administrador de la organización."

Spanish, formal "usted", no emoji, tokens only — per `AGENTS.md`.

## Data flow

```
dataset page (/dataset/[id])
  ├─ package_show                       (existing, token-carrying)
  ├─ organization_list_for_user {admin} (new hint, only when dataset.private)
  └─ click "Publicar"
       └─ POST /api/3/action/package_patch {id, private: false}
            └─ nginx → CKAN
                 ├─ _check_access('package_patch') → package_update auth
                 │     ├─ core package_update auth        (owner_org + update_dataset)
                 │     └─ umss guard: is this a private→public transition? is the caller an org admin?
                 │           ├─ no transition / approver → continue
                 │           └─ transition + non-approver → 403 (nothing written)
                 ├─ validation + persistence (only when authorized)
                 └─ 200 with the updated package dict
       └─ UI renders CKAN's returned private value
```

CKAN remains the only writer. The SvelteKit server never sees a dataset payload (unchanged), and the
catalogue needs no query change: index-time `capacity`/`permission_labels` derive from `private`, and
`/search` already calls `package_search` anonymously `[REPO]`. That last sentence is the proposal's
assumption A; **probe P7** is what turns it into a measured fact.

## File changes

### `odp-docker` (Python — the enforcement; carried as its own PR)

All paths under the extension, listed in full so they resolve from anywhere. The extension package
root is `/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss/`, which also carries
`setup.py`, `pyproject.toml`, `test.ini`, `dev-requirements.txt`, `.coveragerc` and
`.github/workflows/test.yml` — all of them unchanged by this design.

| File | Change |
|---|---|
| `/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss/ckanext/umss/auth.py` | **New.** `PUBLISH_DENIED_MSG`, `_is_approver`, `_as_bool`, `_load_or_defer`, chained `package_update` and `package_create` |
| `/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss/ckanext/umss/plugin.py` | `implements(IAuthFunctions)` + `get_auth_functions()`; nothing else changes |
| `/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss/ckanext/umss/tests/test_auth.py` | **New.** In-process tests via `factories` + `helpers.call_action`: editor `403`, admin `200`, sysadmin `200`, member/cross-org `403`, metadata-only edit `200`, delete `200`, create-with-`private: false` `403`, and **create with `private` omitted** `403` |
| `/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss/ckanext/umss/tests/test_plugin.py` | **Fix.** Line 57 calls `plugin_loaded("umss")` without taking it as a fixture parameter `[REPO]`, so it raises `NameError` rather than asserting the plugin loads. Probe **P0.6** confirms the current baseline before touching it |

Inside the running container the same tree is `/srv/app/src_extensions/ckanext-umss/`.

### `odp` (portal — the affordance; carried as its own PR)

Paths relative to the portal repo root, `/home/danielblc/projects/odp`.

| File | Change |
|---|---|
| `src/lib/api/datasets.ts` | Add `publish(id)` → `package_patch {id, private: false}`. Remove `setState` (dead code: exactly one occurrence in `src/` — its own definition — and no test reference `[REPO]`), whose `"draft"` vocabulary belongs to the deferred state machine |
| `src/lib/api/datasets.test.ts` | Assert `publish` posts exactly `{id, private: false}` and never asserts a `state` |
| `src/lib/components/dataset/PublishControl.svelte` | **New.** Button, busy/disabled state, inline alert, the approver/non-approver/unavailable states of D5 |
| `src/lib/components/dataset/PublishControl.test.ts` | **New.** Component tests for every row of the D5 table, including "CKAN returned `200` but `private` is still `true`" |
| `src/routes/dataset/[id]/+page.svelte` | Load the hint when `dataset.private`; render the control; wire the result back into the page's dataset state |
| `src/routes/dev/dataset-publish/+page.svelte` | **New, temporary.** The playground required by `AGENTS.md` rule 8: the proposed control in all its states with fixture data. Deleted in the same PR once promoted |
| `src/routes/dashboard/datasets/new/+page.svelte` | The three copy strings of D6 |

No `state` is ever sent; no new `extras` key exists; `src/lib/types/dataset.ts`'s declared-but-unused
`DatasetLifecycle`/`DatasetVisibility` unions are left exactly as they are (this slice implements two
levels, and the type's `internal` stays unimplemented rather than simulated).

## Verification

### What each layer can and cannot prove

| Layer | Proves | Does not prove |
|---|---|---|
| `pytest` in the extension (`/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss/`) | The predicate: which caller/payload combinations are refused, in-process, fast, on every change | That the *image* runs this code, that the auth function is registered in the deployment, that CKAN 2.11.6 behaves like the checkout |
| Vitest (`pnpm test`) | The portal offers the control honestly and reports a `403` without fabricating success | Nothing about enforcement — Vitest cannot execute Python `[REPO]` (`openspec/config.yaml`: no integration runner, no E2E runner) |
| **Live `curl` probe against the running CKAN** | The actual guarantee D1 asks for, end to end, on 2.11.6 | Nothing about maintainability; it is a point-in-time measurement |

There is no E2E runner in the portal repo, so the probe is a documented, reproducible command
sequence, not a test suite. Its raw responses are pasted into `verify-report.md` at verify time, and
apply is expected to materialize the sequence as a runnable script in this change directory
(`openspec/changes/2026-09-13-publication-lifecycle/probe.sh`, relative to
`/home/danielblc/projects/odp`) so a reviewer can re-run it.

### Live probe (authoritative) — steps and expectations

Environment: the unified dev stack (`/home/danielblc/projects/odp-docker/docker-compose.dev.unified.yml`),
hit through `http://localhost:8082/api/` (the nginx proxy configured in
`/home/danielblc/projects/odp-docker/frontend-proxy/dev-nginx.conf`), CKAN container
`odp-dev-ckan-dev-1`. `expire_api_token` makes `expires_in` and `unit` mandatory on
`api_token_create` `[REPO]` (`src/lib/server/ckan-auth.ts:20-25`). Tokens for probe users are minted
with a sysadmin token (`api_token_create` accepts a `user` field — **P1.2** confirms a sysadmin may
mint for another user; fallback is a per-user web login). Container paths below are inside the CKAN
container, never on the host; `"$CKAN_INI"` is the container's own variable, so the ini's absolute
path is not asserted here.

| # | Step | Expected | Closes |
|---|---|---|---|
| P0.1 | `docker exec odp-dev-ckan-dev-1 python3 -c "import ckan, os; print(os.path.dirname(ckan.__file__))"` (use `python` if `python3` is absent) | the running CKAN source root, e.g. `/srv/app/src/ckan` — call it `<ckan_root>` for P0.2–P0.5 | version gap |
| P0.2 | `grep -n "sysadmin" <ckan_root>/ckan/authz.py` around `is_authorized` | sysadmin short-circuit before the auth function | `[SOURCE]` → fact |
| P0.3 | `grep -n "def after_dataset_update\|def before_dataset" <ckan_root>/ckan/plugins/interfaces.py` | no pre-update veto hook | D2 rejection of `IPackageController` |
| P0.4 | `grep -rn "chained_auth_function" <ckan_root>/ckan/plugins/toolkit.py <ckan_root>/ckan/logic/__init__.py` | present (else the D2 fallback applies) | D2 shape |
| P0.5 | `grep -n "def ignore_not_package_admin" -A 25 <ckan_root>/ckan/logic/validators.py` | the state validator as read | D1 |
| P0.6 | `docker exec odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss && pytest --ckan-ini=test.ini ckanext/umss'` | current suite state — expected **red**, `plugin_loaded` undefined. The dev image installs the extension without `dev-requirements.txt`, so if `pytest`/`pytest-ckan` are missing, run instead in a throwaway `ckan/ckan-dev:2.11` container the way the extension's own `.github/workflows/test.yml` does (`pip install -r requirements.txt -r dev-requirements.txt`). Record which route was used | baseline before touching it |
| P0.7 | `docker exec odp-dev-ckan-dev-1 sh -c 'grep -n "allow_dataset_collaborators\|reveal_private_datasets" "$CKAN_INI"'` | flag values in the running config | open question 3 |
| P1 | Create a sysadmin token; `organization_create` `probe-lifecycle-<date>`; `user_create` editor/member/admin/outsider; `organization_member_create` capacities | org + users exist | fixture |
| P1.2 | `api_token_create {user: <probe user>, name, expires_in: 1, unit: 3600}` with the sysadmin token | a token per probe user | probe mechanics |
| P2 | As the **editor**: `package_create {name, owner_org, private: true}` | `200`, stored `private: true`, `state: "active"` — **the wizard's payload still works** | no-regression |
| P3 | As the **editor**: `package_patch {id, private: false}` | **`403`**, `error.__type` = `Authorization Error`, message = the plugin's | **the deliverable** (today: `200` `[MEASURED]`) |
| P4 | As the **editor**: `package_patch {id, state: "draft"}`; then `package_patch {id, title: "…"}`; then a full `package_update` that omits `private` | `403`; `200` (metadata edit unaffected); `200` with `private` still `true` (see open question 2) | D1 `state` + no regression |
| P5 | As the **editor**: `package_create {name, owner_org, private: false}` | `403` (post-guard; **measured `200`, stored `private=false`, `state=active`** before the guard, P5/P5b) | the create-time hole |
| P6 | As the **org admin**: `package_patch {id, private: false}` | `200`, stored `private: false` | approver works |
| P6.1 | As the **sysadmin**: same on a second dataset | `200` | sysadmin fallback survives |
| P6.2 | As a **member** of the org, and as an **outsider** editor: `package_patch {id, private: false}` | `403` both | baseline preserved |
| P7 | Anonymous `package_search?q=*:*` (`rows=0` count) before/after publication | the published dataset appears; a private one does not; **no portal query change** | proposal assumption A |
| P8 | As the **org editor**: `bulk_update_public {org_id, datasets: [id]}` | `403` from CKAN's own auth (not from our guard). Recorded as a documented non-path | D2 bulk row |
| P9 | Cleanup: `package_delete` then `docker exec odp-dev-ckan-dev-1 sh -c 'ckan -c "$CKAN_INI" dataset purge <name>'` per probe dataset; `organization_purge` per probe org; `api_token_revoke` by `jti` per token; users are left as `state='deleted'` rows (2.11.6 exposes no user hard-delete — the same residual the preproposal recorded) | nothing left in the catalogue or the index | hygiene |

Every P3–P8 row is also a Python unit test where the semantics allow it; the probe is what proves the
running image, not a substitute for the unit test.

### Measured baseline — 2026-09-14, running CKAN 2.11.6, **before the guard exists**

The full sequence was executed on 2026-09-14 21:54 against `http://localhost:5000` (the CKAN dev
container directly, not the `:8082` proxy — the proxy only forwards, so authorization semantics are
unaffected), with a sysadmin-minted token per probe user. **Read this table as today's behavior, not
as the expectations above**: every `403` in the step table is the *post-guard* target, and the `200`s
below are the *pre-guard* reality those rows replace.

| # | Measured result | Reading |
|---|---|---|
| P0.1 | `<ckan_root>` = `/srv/app/src/ckan`; `ckan.__version__` = `2.11.6` | the version gap is closed by reading in-container |
| P0.2 | sysadmin short-circuit present at `authz.py:221-226` | `[SOURCE]` → fact |
| P0.3 | `interfaces.py` exposes `after_dataset_create` (:451) and `after_dataset_update` (:461), both returning `None`; there is **no** `before_dataset_update`. 2.11.6's own docstring for `after_dataset_update` warns that `bulk_update_private`/`bulk_update_public` bypass it and points at `chained_action` | no pre-update veto exists → D2's rejection of `IPackageController` stands |
| P0.4 | `chained_auth_function` **present**: `toolkit.py:24,114`, `logic/__init__.py:781-813` | the primary D2 shape is available; **the plugin-declaration fallback is not needed** |
| P0.5 | `ignore_not_package_admin` (`validators.py:556-585`) as read; wired at `schema.py:157` as `'state': [ignore_not_package_admin, ignore_missing]` | D1's premise confirmed in 2.11.6 |
| P0.6 | `pytest 8.3.4` **is installed in the dev image** (`/usr/local/bin/pytest`, with `pytest-ckan 2.11.6`), so the throwaway-container fallback was **not** used. Baseline: `1 failed` — `NameError: name 'plugin_loaded' is not defined` at `tests/test_plugin.py:57` | the red baseline is real and reproducible in place |
| P0.7 | `ckan.auth.allow_dataset_collaborators = false` (:101) and `ckan.auth.reveal_private_datasets = false` (:106) in `/srv/app/ckan.ini` | collaborators are irrelevant, and the denials below cannot be attributed to those flags |
| P2 | editor `package_create {private: true}` → `200`, stored `private=true`, `state=active` | the wizard's payload still works |
| **P3** | editor `package_patch {private: false}` → **`200`, stored `private=false`** | **the bypass, reconfirmed live.** This is the deliverable |
| P4a | editor `package_patch {state: "draft"}` → **`200`, stored `state=draft`** | an editor **can** change `state` today, so D1's second clause is load-bearing rather than theoretical |
| P4b | editor `package_patch {title: …}` → `200`, applied | metadata edits are unaffected |
| P4c | editor **full** `package_update` **omitting** `private` → `200`, `private` **still `true`** | **open question 2 answered: omission on update is not a bypass** — the create/update asymmetry is real |
| **P5** | editor `package_create {private: false}` → **`200`, stored `private=false`, `state=active`** | **open question 1 answered: the create-time hole is real.** The second guard is what closes it, so it is load-bearing rather than defensive |
| **P5b** | editor `package_create` **omitting** `private` → **`200`, stored `private=false`, `state=active`** | the omitted-key hole, measured. This is precisely the shape the create guard was corrected for |
| P6 | org `admin` `package_patch {private: false}` → `200`, stored `private=false` | the approver's call works with stock `package_patch` |
| P6.1 | `sysadmin` → `200` | the sysadmin path survives |
| P6.2 | org `member` → `403 Authorization Error` "not authorized to edit package"; editor of another org → `403` | **baseline preserved** |
| P7 | anonymous `*:*` count: **16** (the seeded baseline) → **19** once the editor had created two public datasets and published a third with `package_patch` → **21** after the admin and the sysadmin published two more → **16** after cleanup. The two private datasets never appeared, and an anonymous marker search did not find them | the catalogue follows `private`, and **4 of the 5 public datasets in that window came from the editor alone** |
| P8 | editor `bulk_update_public` → `403 Authorization Error`, `private` unchanged | the documented non-path holds |
| P9 | cleanup verified: anonymous count back to 16, 0 probe datasets, 0 probe orgs, 0 tokens minted by this probe, and the 4 probe users left as `state='deleted'` | hygiene |
| **P10** | an `admin` of a **parent** organization, with a dataset owned by a **child** organization → `package_patch {private: false}` answered **`200`, stored `private=false`** | the D3 comment's "cascades down the org hierarchy" is **measured, not assumed**. `authz.py:322-333` walks `get_parent_group_hierarchy` for the capacities in `ckan.auth.roles_that_cascade_to_sub_groups`, and the running ini sets that to `admin` (:98; the code default at `authz.py:515` is `admin` too) — the same capacity the approver check uses |

Re-read in the container because the create guard depends on them:

- `schema.py:160-161` — `'private': [ignore_missing, boolean_validator, datasets_with_no_organization_cannot_be_private]`: **no authorization anywhere in the chain.**
- `model/package.py:75` — `Column('private', types.Boolean, default=False)`: the column default is **public**, which is exactly why an omitted key at create is a publish attempt.
- `authz.py:248-253` — `ROLE_PERMISSIONS`: `editor` = `read, delete_dataset, create_dataset, update_dataset, manage_group`; `member` = `read, manage_group`. This is the whole explanation of P6.2 and of how far an editor's reach goes.
- `logic/auth/update.py:110-118` — `package_change_state` authorizes by delegating to `package_update`, which authorizes on `has_user_permission_for_group_or_org(owner_org, user, 'update_dataset')` (`:14-24`). An editor holds `update_dataset`, so `ignore_not_package_admin`'s `check_access` succeeds and `state` survives the validator. That is the causal chain behind P4a.

Two probe-mechanics gotchas worth not rediscovering:

- `api_token_create {user: <other user>}` — a sysadmin minting for someone else — returns the token but **no `result.id`**, so the `jti` needed to revoke it is absent from the response. `api_token_list {user_id}` is the only way to obtain it. The self-mint path does return `result.id`.
- `api_token_revoke {jti: <anything matching no token>}` answers **`success: true`, HTTP 200 and revokes nothing** — the same silent-no-op family as the `token`-instead-of-`jti` defect `preproposal.md` §2.2 already records. **A `success: true` from `api_token_revoke` is not evidence of revocation**; verify by listing.
- The organization-hierarchy row is **inverted** from the intuitive reading: it is created as `member_create {id: <child org>, object: <parent org>, object_type: "group", capacity: "parent"}`. `get_parent_group_hierarchy` finds a group's parents in member rows where `group_id = <that group>` and reads the parent from `table_id` (`model/group.py:461-476`). Creating the row the intuitive way — `{id: <parent>, object: <child>}` — answers **`200` and registers nothing the cascade reader will ever see**, which is why P10 needed a second run before it meant anything. Nothing in `organization_show` reports the parent either.

### Open questions — resolved by the 2026-09-14 probe run

| # | Question | Probe | Answer |
|---|---|---|---|
| 1 | Does the running 2.11.6 keep `private: false` on `package_create` for a non-sysadmin editor? | P5, P5b | **Yes, and worse than the question assumed.** Both an explicit `false` and an **omitted key** yield a stored `private=false` public dataset. The `package_create` guard is the difference between "closed" and "one API call away from public" |
| 2 | Does a full `package_update` that **omits** `private` leave the column untouched? | P4c | **Yes, untouched.** Omission is a bypass **only at create time**, where `ignore_missing` falls through to the public column default. This asymmetry is exactly what the create guard encodes |
| 3 | Is `ckan.auth.allow_dataset_collaborators` really off, and what does `reveal_private_datasets` do on the API path? | P0.7 | Both `false` in the running ini, and neither is read on the API authorization path. The denials above cannot come from them, and the copy need not mention collaborators |
| 4 | Does the running Solr index an `extras_*` field in a way that would matter? | — | **Not applicable**: this design writes no new `extras` key, which is exactly why the stemming hazard is out of scope |
| 5 | Are `IPackageController`'s hooks and the sysadmin short-circuit identical in 2.11.6? | P0.2, P0.3 | **Confirmed.** The short-circuit exists as read, and the only dataset hooks are post-hoc `after_dataset_*` returning `None`, so no pre-update veto is possible through that interface |
| 6 | Is `chained_auth_function` available in 2.11.6? | P0.4 | **Yes.** The primary D2 shape is implemented; the plugin-declaration fallback is dropped |
| 7 | The container's own ini path and whether `pytest` is installed in the dev image | P0.6, P0.7 | `"$CKAN_INI"` resolves to `/srv/app/ckan.ini`, and `pytest 8.3.4` with `pytest-ckan 2.11.6` is installed in the dev image, so the suite runs in place and no throwaway container is needed |

Nothing above changed the chosen approach; every item selected between already-written variants or
confirmed a rejection. One expectation in the step table needs restating so it is not misread: the
`403` rows for P3, P4a and P5 are the **post-guard** target. Today they answer `200`.

### Unmeasured at this point

Nothing in the step table is left unmeasured, and the one adjacent claim that a phase flagged as
source-derived — the approver cascade to parent organizations — was closed by P10 on the same day.
One
claim remains unprobed on purpose, and `apply` will hit it on its first run: whether editing the
bind-mounted extension is visible without a `docker restart` (the design assumes it is not, because
plugin registration happens at process start). CKAN's own web UI rendering of the `403` for an editor
who picks "Public" is likewise unverified. The honest alternative to a probe is saying "not measured",
never a fabricated claim.

## Delivery shape across two repositories

The Python lives in `odp-docker`, so this change cannot be one PR and cannot be verified by
`pnpm test` alone `[REPO]` (`openspec/config.yaml`: integration and E2E runners are empty).

**How the extension reaches the dev image.** In dev there is no version to bump:
`/home/danielblc/projects/odp-docker/docker-compose.dev.unified.yml` includes
`/home/danielblc/projects/odp-docker/ckan-docker/docker-compose.dev.yml`, which bind-mounts
`/home/danielblc/projects/odp-docker/ckan-docker/src → /srv/app/src_extensions` (written as `./src`
relative to the compose file's own directory), and the unified file overrides the `ckan-dev` build with
`/home/danielblc/projects/odp-docker/ckan-docker/Dockerfile.dev.umss`, which `pip3 install -e`s the
extension `[REPO]`. Editing `/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss/**` is
therefore visible to the running container **after a `docker restart odp-dev-ckan-dev-1`** — plugin
registration happens at process start, so a changed `implements(...)` needs the restart even if the
file is mounted. P0.4 confirms the decorator exists; the restart requirement itself is **not probed**, and
`apply` will settle it on the first run. Production is a different path:
`/home/danielblc/projects/odp-docker/ckan-docker/Dockerfile.umss` bakes a non-editable install, so
shipping requires rebuilding and redeploying that image — a deployment action, explicitly out of this
change's scope.

**Ordering is a correctness constraint, not a preference.** The CKAN rule must land first: the
portal button without it is the advisory convention D1 rejects, and the rule alone already satisfies
the change's primary success criterion. So the sequence is:

| PR | Repo | Content | Independence |
|---|---|---|---|
| 1 | `odp-docker` (`/home/danielblc/projects/odp-docker`) | `/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss/ckanext/umss/auth.py` (new), `…/ckanext/umss/plugin.py`, `…/ckanext/umss/tests/test_auth.py` (new), `…/ckanext/umss/tests/test_plugin.py` fix | Self-contained and sufficient for D1. Independently revertable |
| 2 | `odp` (`/home/danielblc/projects/odp`) | `publish()` API, `PublishControl`, dataset-page wiring, playground, copy, tests | Depends on PR 1 for its happy path; degrades honestly (`403` with a clear message) if PR 1 is absent |

**Review scope and the `ask-on-risk` decision.** Estimate: PR 1 ≈ 190 lines (60 Python + 130 tests),
PR 2 ≈ 230 lines (110 Svelte/TS + 120 tests), `design.md` excluded. Each is under the 400-line
budget; the sum is not, and could not be a single PR anyway because the halves live in different
repositories. The orchestrator's `ask-on-risk` decision at tasks time therefore has a clear
recommendation to consume: **two PRs, PR 1 first**, with the live-probe evidence attached to PR 1's
verify report. `size:exception` is not required and must not be assumed.

**Rollback.** Two reverts, no migration. Reverting PR 1 restores stock CKAN authorization for org
editors (the bypass returns; published datasets stay public). Reverting PR 2 removes the affordance
(the rule keeps working, so no dataset can be published from the portal until PR 2 returns). Since
this design writes no `extras` key and no table, `proposal.md`'s rollback plan needs no
down-migration section — its condition ("if design introduces a table or a modeled extras key") is
not met.

## Residual risks

| Risk | Likelihood | What it means, and the mitigation in this design |
|---|---|---|
| An editor publishes through a path the guard does not cover | Low, but the class is real | Three paths were checked explicitly: `package_update`/`patch`/`change_state`/`revise` (covered), `package_create {private: false}` (covered by the second guard, probe P5), `bulk_update_public` (org-admin-only in stock CKAN, probe P8). Any new publish path added by a future CKAN version is a re-review trigger, not something this design can pre-empt |
| The guard's key-presence logic is "helpful" but wrong (a request CKAN would have dropped gets a `403`) | Medium | Deliberately asymmetric: unrecognized values and unresolvable packages defer to the core decision; only an explicit, interpretable diff is refused. Create-time `state` is not guarded for exactly this reason |
| Editors lose the ability to change `state` (including on draft datasets) | **Certain and reachable** (P4a measured an editor setting `state` to `draft` with `200`) | This restores the intent of `ignore_not_package_admin`, at the cost of a capability editors hold **right now**. `package_delete` still works, the portal has no edit UI, and this slice writes no `draft` vocabulary — so the practical exposure is CKAN's own web UI and the raw API, not the portal. It is recorded as a deliberate reduction, not as an unreachable edge |
| The approver hint diverges from the CKAN rule | Low | The hint reads the same CKAN predicate through `organization_list_for_user`. The `403` remains the source of truth and is rendered honestly, so a divergence shows up as a *missing* affordance at worst |
| An organization with editors but no admin cannot publish | Certain (accepted) | The non-approver copy names who can publish instead of leaving the user stuck. Decision from the proposal, not a new one |
| The existing extension test suite is red before this change | High | Its `tests/test_plugin.py:57` references `plugin_loaded` without taking it as a fixture `[REPO]` (file: `/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss/ckanext/umss/tests/test_plugin.py`). Probe P0.6 records the baseline (`1 failed`, `NameError: name 'plugin_loaded' is not defined`) and confirmed `pytest 8.3.4` plus `pytest-ckan 2.11.6` are installed in the dev image, so the suite runs in place; the fix is part of PR 1, so "the suite passes" is a real claim rather than an inherited one |
| CKAN's web UI now shows an error for editors who pick "Public" | Medium | Accepted: the web UI is an operational crutch in `v0`, and hiding the selector is cosmetic work with its own template override. If it proves confusing in practice it becomes a backlog item, not part of this slice |
| 2.12 rewrites `extras` to a JSONB column | Low, not triggered | This design writes no extras, so the rewrite does not touch it |

## Explicitly out of scope

Retraction (public → private); any `draft`/`review`/`approved` vocabulary or marker; the
`publication_requests` store; versioning; the collection-level approval gate; a search filter by
publication status; the `current_package_list_with_resources` dashboard defect (D3); enabling or
hiding CKAN's own visibility selector; production deployment of the extension image; and
`src/lib/types/dataset.ts`'s unused lifecycle/visibility unions, which stay declared and
unimplemented rather than simulated.
