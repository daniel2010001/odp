# Publication Lifecycle Specification

## Purpose

Define what makes a private dataset public, who may do it, what the platform guarantees about that permission, and what a caller sees when it is refused. This capability is the contract of the **transition itself**: the wall, the `publication_requests` store, the request flow and its five actions, and the portal's request and approval affordances.

This capability is specified separately from `dataset-publishing` because it is not a property of the creation wizard. The guarantee lives in CKAN's authorization layer, in the `umss` extension (`ckanext-umss`, repository `odp-docker`), while the portal only offers an affordance and reports CKAN's answer. `dataset-publishing` remains the contract of the portal's creation wizard; this capability is the contract of the visibility change.

**Scope (author's frozen decision, 2026-10-07).** This is **scope B**: the full PRD visibility model. `RF-15` step 5 is mandatory — no visibility change except through an approved request, plus the `RF-42` direct degradation (`PRD.md:150-152`) — and the `publication_requests` store and the approval queue are in scope. `RF-41`/`RF-42` (the downgrade) are deferred to `[v1]` (see Out of scope). The editorial lifecycle machine of `RF-15` steps 1–3 is not in this cut.

**Out of scope for this cut** (explicit non-goals, not silent deferrals):

- The editorial lifecycle machine of `RF-15` steps 1–3: the `draft`/`review`/`approved` vocabulary and any CKAN `state` marker for it (`PRD.md:143-148`). The visibility transition is the only lifecycle step this capability implements.
- Retraction of an already published dataset — the direct degradation of `RF-42` and the requested degradation of `RF-41` (`PRD.md:156-164`) — deferred to `[v1]` with its reason: it belongs to the full lifecycle and arrives with it. The store already reserves the `annulled` outcome, the `motive` column and the `decided_at`/`consumed_at` timestamps they need, and `bulk_update_private` is their future carrier. This is a **deferral, not an exclusion**.
- Versioning of datasets (`RF-14`, `RF-16`, `RF-17`).
- A collection-level approval gate (`RF-23`).
- A search or facet filter by publication status.
- The known `current_package_list_with_resources` dashboard defect, which is independent of this lifecycle.
- CKAN's own visibility selector (enabling or hiding it) and production deployment of the extension image.
- The `DatasetVisibility`/lifecycle unions in `src/lib/types/dataset.ts` and the `internal`/author-only third level of `PRD.md:57-59`: they stay declared and unimplemented rather than simulated.

**Evidence (non-normative).** Enforcement is implemented in the `umss` extension in a different repository from the portal, so the portal's `pnpm test` cannot establish the CKAN-side requirements below. Every CKAN-side scenario is stated as observable CKAN behavior that the extension's `pytest` suite or the live probe `probe.sh` against the running CKAN can establish (`openspec/changes/2026-09-13-publication-lifecycle/probe.sh`). Portal-side scenarios are observable in Vitest component and API tests against a CKAN response. The portal has **no integration runner and no E2E runner** (`openspec/config.yaml`): no scenario below claims one.

**Measured baseline** (`design.md` §Measured baseline; `apply-progress.md`). The running stack answers CKAN `2.12.0` (`status_show`, measured 2026-10-07); the pre-guard measurements below were taken on `2.11.6` on 2026-09-14, and D1's base is proven on that version (`design.md` §Not measured / not re-verified). Before the guard (`apply-progress.md`): an organization `editor` published its own organization's dataset with `package_patch {private: false}` and got `200` stored `private: false` (`:253`); `package_create {private: false}` and `package_create` with `private` omitted both answered `200` with a stored public dataset (`:257-258`); a `package_patch {private: "banana"}` and `{private: ""}` also answered `200` stored public, because `boolean_validator` is total and coerces every other value to `False` (`:255-256`, `:363-399`); a full `package_update` that omitted `private` left `private: true` (`:275-276`); an `admin` of a **parent** organization publishing a dataset owned by a **child** organization answered `200` with `private=false` (`:288`), so the approver cascade in `Approver Capacity` is measured, not inferred; an organization `member`, an editor of another organization and an anonymous caller were already refused with `403` (`:284-287`); `bulk_update_public` by an editor was refused with `403` by CKAN's own authorization, not by the guard (`:295`). A published dataset reaches the anonymous catalogue and a private one stays absent: the anonymous `*:*` count rose by exactly the number of datasets published in the run and returned to its pre-run value after cleanup (`:289-299`, `P7`). After the guard was applied (2026-09-14, `2.11.6`) the probe reported `25/25` (`:300`), including `P6`: an org `admin` `package_patch {private: false}` → `200` stored public — **the row this capability removes**: under the wall the admin is refused through `package_patch` and publishes through the action instead.

**Asserted, not measured.** Atomicity of "record + flip" is deduced from the shared session (`design.md` D5; `ckan/logic/__init__.py:313`), not measured. It is a required behavior with the scenario that closes it below. Native actions beyond `bulk_update_public` that write `private`/`state` are not inventoried (`design.md` §Not measured / not re-verified); `No Other Visibility Path` is normative while that inventory remains a review trigger.

## Requirements

### Requirement: Publication Authorization

A dataset's stored `private` value MUST change to `false` only through a publication action defined by this capability (see `Publication Request Actions`). No update path may publish. `package_update` and `package_patch` MUST refuse every attempt to set `private` to a public value and every change to `state`, with **no capacity exception**: the refusal applies to a caller holding only the dataset's ordinary edit capacity **and** to a caller holding the `admin` capacity in the owning organization. `package_create` MUST refuse every creation whose `private` value is not explicitly private — an omitted `private` key is the same publish attempt as `private: false`, because CKAN resolves the omission to its public column default (`ckan/logic/schema/__init__.py:160-161`; `ckan/model/package.py:75`) — for that same set of callers.

A refusal MUST be an authorization failure (see `Distinguishable Authorization Errors`) produced before validation or persistence, and MUST leave every stored value of the dataset unchanged: nothing of a refused request may be written. The `sysadmin` bypass is the one declared exception (`ckan/authz.py:224-228`; see `Sysadmin Bypass`). The create-time `state` drop is deliberately not re-guarded: `package_create` with a `state` CKAN was not going to honor is not refused by this capability.

#### Scenario: Organization editor attempts publication

- GIVEN a dataset stored with `private: true` and `state: "active"`, owned by an organization where the caller holds the `editor` capacity
- WHEN the caller sends `package_patch {id, private: false}` with its own token
- THEN CKAN answers `403` with `error.__type = "Authorization Error"`
- AND a subsequent `package_show` reports `private: true` and `state: "active"`, unchanged

#### Scenario: Organization administrator attempts publication through `package_patch`

- GIVEN a dataset stored with `private: true` and a caller holding the `admin` capacity in its owning organization
- WHEN the caller sends `package_patch {id, private: false}`
- THEN CKAN answers `403` with `error.__type = "Authorization Error"` and a message that names the publication flow
- AND a subsequent `package_show` reports `private: true`, unchanged
- AND this refusal is the reversal of a measured contract: the same call answered `200` and stored `private: false` before this change (`apply-progress.md:282`)

#### Scenario: Organization editor attempts a state change

- GIVEN the same caller and dataset
- WHEN the caller sends `package_patch {id, state: "draft"}`
- THEN CKAN answers `403` with `error.__type = "Authorization Error"`
- AND a subsequent `package_show` reports `state: "active"`, unchanged
- AND this refusal is reachable, not theoretical: the same call answered `200` and stored `draft` before this change (`apply-progress.md:254`)

#### Scenario: Organization administrator attempts a state change

- GIVEN a caller holding the `admin` capacity in the dataset's owning organization
- WHEN the caller sends `package_patch {id, state: "draft"}`
- THEN CKAN answers `403` with `error.__type = "Authorization Error"`
- AND the stored `state` is unchanged
- AND no capacity exception is applied to the administrator

#### Scenario: Organization editor attempts publication through a full update

- GIVEN the same caller and dataset
- WHEN the caller sends a `package_update` that carries the dataset's representation with `private: false`
- THEN CKAN answers `403` and the stored `private` remains `true`

#### Scenario: Organization editor attempts publication at create time with an explicit public value

- GIVEN the caller holds the `editor` capacity in the target organization
- WHEN the caller sends `package_create {name, owner_org, private: false}`
- THEN CKAN answers `403` with `error.__type = "Authorization Error"`
- AND no dataset is created
- AND the same call answered `200` and stored a public dataset before this change (`apply-progress.md:257`)

#### Scenario: Organization editor attempts publication at create time by omitting the field

- GIVEN the caller holds the `editor` capacity in the target organization
- WHEN the caller sends `package_create {name, owner_org}` with `private` absent
- THEN CKAN answers `403` with `error.__type = "Authorization Error"`
- AND no dataset is created
- AND an absent `private` is the same publish attempt as `false`, because at create time CKAN resolves it to its public column default

#### Scenario: Organization administrator attempts publication at create time

- GIVEN a caller holding the `admin` capacity in the target organization
- WHEN the caller sends `package_create {name, owner_org, private: false}`, or omits `private`
- THEN CKAN answers `403` with `error.__type = "Authorization Error"`
- AND no dataset is created
- AND creation is private for everyone: the administrator publishes afterwards through the action

#### Scenario: Metadata edits stay allowed

- GIVEN the same caller and a dataset stored with `private: true`
- WHEN the caller sends `package_patch {id, title: "…", notes: "…"}`
- THEN CKAN answers `200` and applies the change
- AND the stored `private` and `state` remain unchanged

#### Scenario: A full update that omits `private` is not a publication attempt

- GIVEN the same caller and a dataset stored with `private: true`
- WHEN the caller sends a `package_update` with the dataset's full representation, omitting `private` and changing the title
- THEN CKAN answers `200` and applies the title change
- AND the stored `private` is still `true`
- AND omission is a publication attempt only at create time, never on update

#### Scenario: Unrelated writes stay allowed

- GIVEN the same caller and a dataset it can edit
- WHEN the caller creates a resource on it, or soft-deletes it with `package_delete`
- THEN CKAN answers `200` in both cases
- AND the publication rule does not refuse a request that asks for no visibility or state change

#### Scenario: State at create time is not refused by this rule

- GIVEN a caller that is not a `sysadmin`
- WHEN it sends `package_create {name, owner_org, private: true, state: "draft"}`
- THEN the request is not refused by the publication rule
- AND CKAN's own behavior for a create-time `state` applies, so the stored `state` is `active`
- AND no refusal is issued for a request CKAN was not going to honor anyway

### Requirement: Approver Capacity

The publication transition MUST be granted to a caller that holds the `admin` capacity in the dataset's owning organization, including an administrator of a parent organization in the organization hierarchy, and to a `sysadmin`. The capacity MUST be exercised **through the publication actions** (`publication_publish`; `publication_request_decide`): the same caller publishing with stock `package_patch {id, private: false}` MUST be refused (see `Publication Authorization`). No extension-defined permission beyond the stock organization `admin` capacity may be required to decide. The same predicate MUST be the only source of approver identity; the portal MUST NOT maintain its own role table.

#### Scenario: Organization administrator publishes through the action

- GIVEN a dataset stored with `private: true` and a caller holding the `admin` capacity in its owning organization
- WHEN the caller invokes `publication_publish {id}`
- THEN CKAN answers `200`
- AND the stored `private` is `false`, and the response body reports `private: false`
- AND a `publication_requests` row exists for the dataset with outcome `approved` and `consumed_at` set

#### Scenario: The same administrator is refused through `package_patch`

- GIVEN the same caller and dataset
- WHEN the caller sends `package_patch {id, private: false}`
- THEN CKAN answers `403` and the stored `private` remains `true`
- AND the capacity does not authorize the update path, only the action

#### Scenario: Sysadmin publishes through the action

- GIVEN a `sysadmin` caller and a dataset of any organization
- WHEN the caller invokes `publication_publish {id}`
- THEN CKAN answers `200`, the stored `private` is `false`, and a `publication_requests` row is consumed
- AND the sysadmin's unflagged stock bypass remains available as well (see `Sysadmin Bypass`)

#### Scenario: An administrator of a parent organization publishes

- GIVEN a caller holding the `admin` capacity in a parent organization and a dataset owned by a child organization
- WHEN the caller invokes `publication_publish {id}`
- THEN CKAN answers `200` and the stored `private` is `false`
- AND the stock cascade is the only reason, measured rather than inferred (`apply-progress.md:288`)

#### Scenario: One person holds both capacities

- GIVEN a caller that is both an `editor` and an `admin` of the owning organization
- WHEN the caller invokes `publication_request_create {id}` and then `publication_request_decide {request_id, approve: true}`
- THEN both calls answer `200`
- AND no separate approver role has to be granted for the two calls to succeed

#### Scenario: An organization without an administrator has no other publication path

- GIVEN an organization whose members hold only the `editor` and `member` capacities
- WHEN any of them attempts the transition
- THEN CKAN answers `403` for all of them
- AND no portal-side role, setting or override grants it
- AND publishing such a dataset requires a `sysadmin`

### Requirement: Distinguishable Authorization Errors

Denials produced by the wall or by the publication actions MUST be authorization failures: HTTP `403` with `error.__type = "Authorization Error"` and a message that names the missing capacity. The wall MUST carry **two distinguishable messages**: the message for a caller who does not administer the organization states that only an organization administrator can publish (`Only an organization administrator can publish a dataset`), and the message for a caller who does administer it states that publication goes through the publication flow and not `package_patch`.

A `private` value the wall cannot interpret as a boolean MUST be treated as a publish attempt and MUST NOT be deferred: CKAN's `boolean_validator` is total and coerces every value outside `true`/`yes`/`t`/`y`/`1` to `False`, so `private: "banana"` would **store the dataset public** instead of failing validation (`apply-progress.md:363-399`). Packages the rule cannot resolve MUST still defer to core CKAN, which MUST answer with its own outcome, and MUST NOT be converted into a `403`.

#### Scenario: A refusal is not a validation error

- GIVEN an organization `editor` and a dataset it can edit
- WHEN it sends `package_patch {id, private: false}`
- THEN the response status is `403` with `error.__type = "Authorization Error"`
- AND it is not `409` and carries no field-level validation errors

#### Scenario: A non-administrator's refusal names the required role

- GIVEN the same refusal
- WHEN the response body is read
- THEN the message states that only an organization administrator can publish a dataset
- AND it is not a generic "not authorized to edit package" message

#### Scenario: An administrator's refusal names the flow

- GIVEN a caller holding the `admin` capacity in the owning organization
- WHEN it sends `package_patch {id, private: false}`
- THEN the response status is `403` with `error.__type = "Authorization Error"`
- AND the message states that publication goes through the publication flow, not `package_patch`
- AND it is distinguishable from the non-administrator's message

#### Scenario: An unrecognized `private` value is a publish attempt, not a deferral

- GIVEN a dataset stored with `private: true`
- WHEN an organization `editor` sends `package_patch {id, private: "banana"}`
- THEN the publication rule answers `403` with `error.__type = "Authorization Error"`
- AND it does not defer, because core CKAN would not raise a validation error: `boolean_validator`
  coerces the value to `false` and would store the dataset public
- AND the same call from an `admin` is refused too, with the flow message
- AND the stored `private` remains `true` in both cases

#### Scenario: An unresolvable package defers to core CKAN

- GIVEN an organization `editor`
- WHEN it sends `package_patch {id: <an id that does not exist>, private: false}`
- THEN CKAN answers with its own not-found or validation outcome
- AND the publication rule does not answer `403` for a package it cannot resolve

### Requirement: No Other Visibility Path

Besides the publication actions and the declared `sysadmin` bypass, no CKAN action reachable through the API may change a dataset's stored `private` to public or change its `state`. `bulk_update_public` MUST be refused by a chain of this capability: measurement shows it writes `private: false` directly through `_bulk_update_dataset` and does **not** route through `package_update`, so the `Publication Authorization` chain alone does not cover it (`ckan/logic/action/update.py:1232-1243`; `ckan/logic/auth/update.py:262-269`). `bulk_update_private` is the degradation direction and is `[v1]` (`RF-42`; see Out of scope). The full inventory of native actions that write `private`/`state` remains a review trigger, not a measured claim (`design.md` §Not measured / not re-verified).

#### Scenario: The bulk action is not a publication path

- GIVEN an organization `editor` and a private dataset
- WHEN it sends `bulk_update_public {org_id, datasets: [<the dataset>]}`
- THEN CKAN answers `403`
- AND the refusal is produced by this capability's chained rule, not by CKAN's own authorization
- AND the stored `private` is unchanged

#### Scenario: An administrator is refused the bulk path

- GIVEN a caller holding the `admin` capacity in the dataset's owning organization
- WHEN it sends `bulk_update_public {org_id, datasets: [<the dataset>]}`
- THEN CKAN answers `403` and the stored `private` is unchanged
- AND the administrator publishes through the action instead

### Requirement: Publication Request Store

`ckanext-umss` MUST persist a `publication_requests` record. The record MUST carry at least: `id`, `dataset_id`, `requested_visibility` (`public`|`private`), `status` (`pending`|`approved`|`rejected`|`cancelled`|`annulled`), `requested_by`, `approved_by`, `comments`, `motive`, `created_at`, `decided_at`, `consumed_at`. The `annulled` outcome and the `motive` column extend the schema the PRD declares (`PRD.md:336`), which carries neither; `annulled` is the outcome `RF-42` requires when a pending request loses its object and `motive` is the reason it requires (`PRD.md:161-164`). The transition that produces `annulled` lands with `RF-42` at `[v1]`; this cut defines the outcome and the column. A partial unique index MUST enforce **at most one `pending` request per dataset**.

#### Scenario: A request is recorded with the declared schema

- GIVEN an organization `editor` and a private dataset it can edit
- WHEN it invokes `publication_request_create {dataset_id, comments}`
- THEN a `publication_requests` row exists for the dataset with `requested_visibility = "public"`, `status = "pending"`, `requested_by` set to the caller, `comments` stored, and `created_at` set
- AND `decided_at` and `consumed_at` are unset

#### Scenario: The store accepts every declared outcome

- GIVEN the store's schema
- WHEN a record carries each outcome of `pending`, `approved`, `rejected`, `cancelled` and `annulled`
- THEN every one is accepted and readable
- AND the `annulled` outcome can be stored even though the transition that writes it is `[v1]`

#### Scenario: One pending request per dataset is enforced

- GIVEN a dataset that already has a `pending` request
- WHEN the store attempts a second `pending` row for the same dataset
- THEN the second row is rejected
- AND a `pending` row for a different dataset is unaffected

### Requirement: Publication Request Actions

Five actions MUST be registered through `IActions`:

| Action | Authorized to | Does |
|---|---|---|
| `publication_request_create(dataset_id, comments?)` | a caller who can `update_dataset` in the owning organization, dataset is private | writes one `pending` row; **idempotent** (returns the existing pending one) |
| `publication_request_cancel(request_id)` | the requester, or an organization `admin` | `pending` → `cancelled` |
| `publication_request_decide(request_id, approve, comments?)` | organization `admin` (+ sysadmin) | `rejected`, or `approved` **and flips `private` in the same transaction** |
| `publication_publish(dataset_id, comments?)` | organization `admin` (+ sysadmin) | the admin's own path: writes the row and approves/consumes it in the act |
| `publication_request_list(status?)` | anyone who administers or edits in the organization | the queue: requests of the orgs where the caller has capacity, plus the caller's own |

`publication_request_decide` with `approve` MUST write the `approved` outcome and the `consumed_at` timestamp and flip the dataset's stored `private` to `false` **in the same transaction**: the record and the flip travel one session (`ckan/logic/__init__.py:313`), so either both writes commit or neither does. The door MUST perform the flip through a server-side call that carries `ignore_auth` (`helpers.call_action('package_patch', context={..., 'ignore_auth': True}, ...)`; the production entry point is `logic.get_action('package_patch')` with the same context, `design.md` D5), and `ignore_auth` MUST NOT be reachable from a client (`ckan/views/api.py:244-249,280`).

#### Scenario: An editor requests publication

- GIVEN an organization `editor` and a private dataset it can edit
- WHEN it invokes `publication_request_create {dataset_id, comments}`
- THEN CKAN answers `200` and exactly one `pending` row exists for the dataset
- AND the row carries the caller as `requested_by` and the submitted `comments`

#### Scenario: A repeated request is idempotent

- GIVEN a dataset that already has a `pending` request created by the caller
- WHEN the caller invokes `publication_request_create` again
- THEN CKAN answers `200` with the existing pending request
- AND still exactly one `pending` row exists for the dataset

#### Scenario: The requester cancels

- GIVEN a `pending` request created by the caller
- WHEN the caller invokes `publication_request_cancel {request_id}`
- THEN the row's outcome is `cancelled`
- AND no visibility change is written

#### Scenario: An administrator cancels

- GIVEN a `pending` request and a caller holding the `admin` capacity in the dataset's owning organization
- WHEN the caller invokes `publication_request_cancel {request_id}`
- THEN the row's outcome is `cancelled`
- AND no visibility change is written

#### Scenario: An administrator approves

- GIVEN a `pending` request for a private dataset and a caller holding the `admin` capacity
- WHEN the caller invokes `publication_request_decide {request_id, approve: true}`
- THEN the row's outcome is `approved` with `decided_at` and `consumed_at` set
- AND the stored `private` is `false`

#### Scenario: The record and the flip are one transaction

- GIVEN a `pending` request whose flip will fail
- WHEN `publication_request_decide {approve: true}` runs
- THEN neither write is persisted
- AND no `approved` or `cancelled` row remains for the request
- AND this atomicity is asserted from the shared session and is not yet measured (`design.md` §Not measured / not re-verified); this scenario is the proof that closes it

#### Scenario: An administrator rejects

- GIVEN a `pending` request and a caller holding the `admin` capacity
- WHEN the caller invokes `publication_request_decide {request_id, approve: false, comments: "…"}`
- THEN the row's outcome is `rejected` with the comments stored
- AND the stored `private` remains `true`

#### Scenario: An administrator publishes directly

- GIVEN a private dataset and a caller holding the `admin` capacity
- WHEN the caller invokes `publication_publish {dataset_id, comments}`
- THEN a `publication_requests` row is written and consumed in the act with outcome `approved`
- AND the stored `private` is `false`

#### Scenario: An editor cannot decide

- GIVEN a `pending` request and a caller holding only the `editor` capacity
- WHEN the caller invokes `publication_request_decide {request_id, approve: true}`
- THEN CKAN answers `403` with `error.__type = "Authorization Error"`
- AND the stored `private` remains `true`

#### Scenario: A stranger cannot cancel someone else's request

- GIVEN a `pending` request and a caller who neither requested it nor administers the organization
- WHEN the caller invokes `publication_request_cancel {request_id}`
- THEN CKAN answers `403`
- AND the row's outcome remains `pending`

#### Scenario: The queue is scoped to the caller's capacity

- GIVEN requests belonging to two organizations, and a caller with capacity in only one of them
- WHEN the caller invokes `publication_request_list {}`
- THEN the response includes the requests of the organization where the caller has capacity
- AND it includes the caller's own requests
- AND it does not include requests the caller has no capacity to see

### Requirement: Preserved Refusals

Refusals that already held before this change MUST keep holding, and MUST NOT be attributed to the publication rule.

#### Scenario: A read-only member stays refused

- GIVEN a caller holding only the `member` capacity in the dataset's organization
- WHEN it sends `package_patch {id, private: false}`
- THEN CKAN answers `403`
- AND the stored `private` is unchanged

#### Scenario: An editor of another organization stays refused

- GIVEN a caller that is an `editor` of a different organization than the dataset's owner
- WHEN it sends `package_patch {id, private: false}`
- THEN CKAN answers `403`
- AND the stored `private` is unchanged

#### Scenario: Anonymous stays refused

- GIVEN a request with no API token
- WHEN it sends `package_patch {id, private: false}`
- THEN CKAN answers `403`
- AND the stored `private` is unchanged

#### Scenario: An internal trusted caller is unaffected

- GIVEN an action executed inside CKAN with `ignore_auth` (the publication door, a CLI command or a seed script)
- WHEN it publishes a dataset
- THEN it succeeds
- AND this escape hatch is intentional: it is the door's own mechanism and the operational recovery path, and it does not weaken the refusals above

### Requirement: Sysadmin Bypass

The guard MUST NOT set `auth_sysadmins_check`, so a `sysadmin` remains the system's real escape hatch: CKAN's `is_authorized` returns success for a sysadmin before calling any auth function (`ckan/authz.py:224-228`), and `context['ignore_auth']` short-circuits earlier still (`ckan/authz.py:212`). The bypass stays declared and unflagged. It is the one publication path that does not write a `publication_requests` row through the door's action when the sysadmin uses stock `package_patch`, and it is the only remaining API emergency path once the wall is in place.

#### Scenario: The sysadmin bypass is declared

- GIVEN a `sysadmin` caller and a private dataset
- WHEN the caller sends `package_patch {id, private: false}`
- THEN CKAN answers `200` and the stored `private` is `false`
- AND no `publication_requests` row is required by the door for this call
- AND this is the intentional, documented escape hatch, not a hole in the wall

#### Scenario: A client cannot inject the bypass

- GIVEN a non-sysadmin caller
- WHEN it sends a request whose body contains an `ignore_auth` key, or any context key
- THEN the key is treated as request data, not as action context (`ckan/views/api.py:244-249,280`)
- AND the refusal that the wall would issue stands

### Requirement: Published Datasets Reach The Catalogue

After an approver publishes a dataset, the dataset MUST be findable by an anonymous `package_search`, with no portal-side change to the catalogue query and without asking for private or draft results. A dataset that has not been published MUST stay absent from anonymous results. While a dataset is private, it MUST remain readable by every member of its owning organization.

#### Scenario: A published dataset appears

- GIVEN a dataset stored with `private: true` and a recorded anonymous result count
- WHEN an approver publishes it through the action and an anonymous `package_search` is issued afterwards
- THEN the dataset appears in the results
- AND the anonymous result count has increased by one

#### Scenario: A private dataset stays absent

- GIVEN a dataset that has not been published
- WHEN an anonymous `package_search` is issued
- THEN the dataset does not appear in the results
- AND searching for a distinctive term from that dataset anonymously does not return it

#### Scenario: No private or draft flags are needed

- GIVEN an anonymous catalogue query issued by the portal
- WHEN the published dataset is returned
- THEN the query passed neither `include_private` nor `include_drafts`
- AND the portal's catalogue query is unchanged by this capability

#### Scenario: A private dataset is readable by its organization

- GIVEN a dataset stored with `private: true`
- WHEN a member of its owning organization that is not its creator calls `package_show`
- THEN CKAN answers `200`
- AND no user-facing copy may claim that a private dataset is visible only to its author

### Requirement: Portal Publication Affordance

The dataset page MUST offer **two distinct controls with two distinct gates**: a **request control** for a caller who can edit the dataset's owning organization, and a **publish control** for an organization `admin`. Neither gate may stand in for the other.

The **request control** — and the **cancel** of the caller's own `pending` request — MUST be offered only when CKAN reports the caller as able to `update_dataset` in the dataset's owning organization, the capacity `publication_request_create` demands, determined by `organization_list_for_user {permission: "update_dataset"}` cross-checked against the dataset's organization. It MUST call `publication_request_create`, and `publication_request_cancel` for the caller's own `pending` request, and MUST NOT call `publication_publish`. The portal MUST NOT re-derive organization roles from any other source, and MUST fail closed when the check cannot be completed.

The **publish control** MUST be offered only when CKAN reports the current user as an approver of the dataset's owning organization, determined by `organization_list_for_user {permission: "admin"}` cross-checked against the dataset's organization. The portal MUST NOT re-derive organization roles from any other source, MUST NOT treat an unfiltered organization list as proof, and MUST NOT offer the control when approval has not been confirmed. It MUST call `publication_publish`, never `package_patch`. A caller who can edit but is not an `admin` MUST NOT be offered it.

No control to reverse a publication may be offered, because retraction is `[v1]`; the cancel control reverses a `pending` request, not a publication.

#### Scenario: An editor is offered the request control

- GIVEN a dataset whose stored `private` is `true`, and a user who can `update_dataset` in its owning organization but is not an administrator of it
- WHEN the dataset page renders
- THEN a request control is offered and no publish control is offered
- AND it states the consequence: "Será visible en el catálogo público si la solicitud es aprobada."

#### Scenario: The editor's request control calls the request action

- GIVEN a rendered request control and a private dataset
- WHEN the user activates it
- THEN the browser sends `POST /api/3/action/publication_request_create` with `{dataset_id}` and any comment the user supplied
- AND the request does not call `publication_publish` or `package_patch`

#### Scenario: The requester cancels their own pending request

- GIVEN a user who can `update_dataset` in the dataset's owning organization and whose own `pending` request exists for the dataset
- WHEN the user activates the cancel control
- THEN the browser sends `POST /api/3/action/publication_request_cancel` with exactly the request id
- AND the cancel control is offered only for the caller's own `pending` request, never another caller's

#### Scenario: The request gate is not the publish gate

- GIVEN a dataset whose stored `private` is `true`, and a user who can `update_dataset` in its owning organization but is not an administrator of it
- WHEN the portal decides which control to offer
- THEN the request control is offered and the publish control is not
- AND the request gate is the `update_dataset` check, not the admin-filtered list the publish control uses

#### Scenario: The request gate fails closed

- GIVEN a dataset whose stored `private` is `true`
- WHEN the `update_dataset` check cannot be completed
- THEN no request control is offered
- AND an explicit state is shown: "No se pudo verificar su permiso para solicitar la publicación."
- AND that state offers a retry action
- AND the affordance fails closed rather than showing a control that may be wrong

#### Scenario: A private dataset and an approver

- GIVEN a dataset whose stored `private` is `true`, and a user whose admin organizations include the dataset's organization
- WHEN the dataset page renders
- THEN a publication control is offered
- AND it states the consequence: "Será visible en el catálogo público."

#### Scenario: A private dataset and a non-approver

- GIVEN a dataset whose stored `private` is `true`, and a user who is not an administrator of its organization
- WHEN the dataset page renders
- THEN no publication control is offered
- AND the page states who can publish: "Solo un administrador de la organización puede publicar este dataset."

#### Scenario: The approver check fails

- GIVEN a dataset whose stored `private` is `true`
- WHEN the approver check cannot be completed
- THEN no publication control is offered
- AND an explicit state is shown: "No se pudo verificar su permiso para publicar."
- AND that state offers a retry action
- AND the affordance fails closed rather than showing a control that may be wrong

#### Scenario: An already-published dataset

- GIVEN a dataset whose stored `private` is `false`
- WHEN the dataset page renders
- THEN no publication control is offered
- AND no unpublish or make-private control is offered either

#### Scenario: The control performs the publication action

- GIVEN a rendered publication control
- WHEN the user activates it
- THEN the browser sends `POST /api/3/action/publication_publish` with exactly `{id}`
- AND the request carries no `state` key
- AND the request does not call `package_patch`

#### Scenario: The approver check uses the permission argument

- GIVEN an organization list obtained without `permission: "admin"`
- WHEN the portal decides whether to offer the control
- THEN that list is not treated as proof of approval
- AND the control is offered only after the admin-filtered check confirms it

### Requirement: Portal Approval Queue

The portal MUST host an approval queue for the pending publication requests an administrator can decide. The queue MUST read its rows from `publication_request_list` and MUST decide a row by calling `publication_request_decide` with the request id and the decision; it MUST NOT derive approval from any local role table. The queue host is a design choice (`design.md` D7 proposes the authenticated dashboard), and the route is reviewed per `AGENTS.md` rule 8. All queue scenarios below are observable in Vitest component or API tests against a stubbed CKAN response; the portal has no integration or E2E runner.

#### Scenario: The queue renders pending requests

- GIVEN an authenticated administrator and a CKAN response listing pending publication requests
- WHEN the queue renders
- THEN each pending request is listed with its dataset
- AND no decision is available for a request that is not `pending`

#### Scenario: Approving a request

- GIVEN a rendered pending request
- WHEN the administrator approves it
- THEN the browser sends `POST /api/3/action/publication_request_decide` with the request id and `approve: true`
- AND on a confirming response the request leaves the pending queue

#### Scenario: Rejecting a request

- GIVEN a rendered pending request
- WHEN the administrator rejects it with a comment
- THEN the browser sends `POST /api/3/action/publication_request_decide` with the request id, `approve: false` and the comment
- AND on a confirming response the request leaves the pending queue

#### Scenario: A refusal keeps the row

- GIVEN a rendered pending request
- WHEN CKAN answers `403`
- THEN the refusal is reported as an authorization condition
- AND the request stays in the queue

#### Scenario: The queue is unavailable

- GIVEN the queue's CKAN request fails
- WHEN the queue renders
- THEN an explicit error state with a retry action is shown
- AND no fabricated empty queue is shown

### Requirement: No Fabricated Publication

The portal MUST render only what CKAN confirmed, and MUST NOT present a publication CKAN did not grant. The dataset state shown after a request MUST derive from CKAN's response, never from an optimistic assumption, and an authorization failure and a validation failure MUST be reported as different conditions.

#### Scenario: CKAN refuses with 403

- GIVEN a rendered publication control
- WHEN CKAN answers `403`
- THEN an inline alert reports the authorization refusal
- AND the control is offered again
- AND the dataset is still shown as private

#### Scenario: CKAN answers 200 without granting publication

- GIVEN a rendered publication control
- WHEN CKAN answers `200` but the response reports `private` as `true`
- THEN the page states "El catálogo no confirmó la publicación."
- AND the dataset is still shown as private
- AND no success state is rendered

#### Scenario: CKAN confirms publication

- GIVEN a rendered publication control
- WHEN CKAN answers `200` and the response reports `private: false`
- THEN the page shows the dataset as public
- AND the page's dataset object is replaced by CKAN's response

#### Scenario: Another failure kind

- GIVEN a rendered publication control
- WHEN the request fails for a reason other than an authorization refusal
- THEN an explicit error state with a retry action is shown
- AND no success state is rendered

#### Scenario: No optimistic state and no promised lifecycle value

- GIVEN a publication request in flight
- WHEN the control renders while it is pending
- THEN the control reports a busy state and no success indicator
- AND no lifecycle value is asserted at dataset creation time by the portal alongside this call

### Requirement: Honest Lifecycle Copy

No user-facing string MUST promise a lifecycle step this cut does not implement. Shipped copy MUST NOT introduce the editorial `draft`/`review`/`approved` vocabulary, a publication-status marker, a review request for the editorial machine, or a versioning promise. Copy about who publishes MUST name the organization administrator as the role that decides, and copy about what private means MUST state that the dataset is readable by the members of its owning organization. The copy that promises "the publication flow decides visibility" is now true: the flow exists (`design.md` D7), and it is edited only to name who publishes.

#### Scenario: No deferred vocabulary is shipped

- GIVEN every user-facing string shipped by this change
- WHEN it is reviewed
- THEN it contains no editorial `draft`, `review` or `approved` term
- AND it contains no publication-status marker or editorial review-request affordance
- AND it does not describe an editorial state machine that this cut does not implement

#### Scenario: Private reach is described accurately

- GIVEN any shipped string that describes what private means
- WHEN it is read
- THEN it states that the dataset is visible to the members of the owning organization
- AND it does not claim that only the author can see it

#### Scenario: A refusal names the missing capacity

- GIVEN a publication refusal surfaced to the user
- WHEN it is read
- THEN it names an administrator of the organization as the required role
- AND it is not a generic permission or network error message
