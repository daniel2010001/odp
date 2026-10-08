# Publication Lifecycle Specification

## Purpose

Define what makes a private dataset public, who may do it, what the platform guarantees about that permission, and what a caller sees when it is refused. This capability is the contract of the **transition itself**: the wall, the `publication_requests` store, the request flow and its ~~five~~ **four** actions (**amended 2026-10-08**: `publication_publish` was removed, so the standing contract is four actions), and the portal's request and approval affordances.

This capability is specified separately from `dataset-publishing` because it is not a property of the creation wizard. The guarantee lives in CKAN's authorization layer, in the `umss` extension (`ckanext-umss`, repository `odp-docker`), while the portal only offers an affordance and reports CKAN's answer. `dataset-publishing` remains the contract of the portal's creation wizard; this capability is the contract of the visibility change.

**Scope (author's frozen decision, 2026-10-07).** This is **scope B**: the full PRD visibility model. `RF-15` step 5 is mandatory — no visibility change except through an approved request, plus the `RF-42` direct degradation (`PRD.md:150-152`) — and the `publication_requests` store and the approval queue are in scope. `RF-41`/`RF-42` (the downgrade) are deferred to `[v1]` (see Out of scope). The editorial lifecycle machine of `RF-15` steps 1–3 is not in this cut.

**Out of scope for this cut** (explicit non-goals, not silent deferrals):

- The editorial lifecycle machine of `RF-15` steps 1–3: the `draft`/`review`/`approved` vocabulary and any CKAN `state` marker for it (`PRD.md:143-148`). The visibility transition is the only lifecycle step this capability implements.
- Retraction of an already published dataset — the direct degradation of `RF-42` and the requested degradation of `RF-41` (`PRD.md:156-164`) — deferred to `[v1]` with its reason: it belongs to the full lifecycle and arrives with it. The store already carries the `annulled` outcome, the `motive` column and the `decided_at`/`consumed_at` timestamps they need, and `bulk_update_private` is their future carrier. This is a **deferral, not an exclusion**.
- **Expiry of a pending request** — **decided against, not deferred** (author, 2026-10-07). A `pending` request never becomes undecidable by age; the queue instead shows **how long** each request has been pending, with visible emphasis past a threshold, so staleness is noticed rather than enforced. The threshold is a presentation choice and MUST NOT be read as an expiry rule.
- Versioning of datasets (`RF-14`, `RF-16`, `RF-17`).
- A collection-level approval gate (`RF-23`).
- A search or facet filter by publication status.
- The known `current_package_list_with_resources` dashboard defect, which is independent of this lifecycle.
- CKAN's own visibility selector (enabling or hiding it) and production deployment of the extension image.
- The `DatasetVisibility`/lifecycle unions in `src/lib/types/dataset.ts` and the `internal`/author-only third level of `PRD.md:57-59`: they stay declared and unimplemented rather than simulated.

**Evidence (non-normative).** Enforcement is implemented in the `umss` extension in a different repository from the portal, so the portal's `pnpm test` cannot establish the CKAN-side requirements below. Every CKAN-side scenario is stated as observable CKAN behavior that the extension's `pytest` suite or the live probe `probe.sh` against the running CKAN can establish (`openspec/changes/2026-09-13-publication-lifecycle/probe.sh`). Portal-side scenarios are observable in Vitest component and API tests against a CKAN response. The portal has **no integration runner and no E2E runner** (`openspec/config.yaml`): no scenario below claims one.

**Measured baseline** (`design.md` §Measured baseline; `apply-progress.md`). The running stack answers CKAN `2.12.0` (`status_show`, measured 2026-10-07); the pre-guard measurements below were taken on `2.11.6` on 2026-09-14, and D1's base is proven on that version (`design.md` §Not measured / not re-verified). Before the guard (`apply-progress.md`): an organization `editor` published its own organization's dataset with `package_patch {private: false}` and got `200` stored `private: false` (`:253`); `package_create {private: false}` and `package_create` with `private` omitted both answered `200` with a stored public dataset (`:257-258`); a `package_patch {private: "banana"}` and `{private: ""}` also answered `200` stored public, because `boolean_validator` is total and coerces every other value to `False` (`:255-256`, `:363-399`); a full `package_update` that omitted `private` left `private: true` (`:275-276`); an `admin` of a **parent** organization publishing a dataset owned by a **child** organization answered `200` with `private=false` (`:288`), so the approver cascade in `Approver Capacity` is measured, not inferred; an organization `member`, an editor of another organization and an anonymous caller were already refused with `403` (`:284-287`); `bulk_update_public` by an editor was refused with `403` by CKAN's own authorization, not by the guard (`:295`). A published dataset reaches the anonymous catalogue and a private one stays absent: the anonymous `*:*` count rose by exactly the number of datasets published in the run and returned to its pre-run value after cleanup (`:289-299`, `P7`). After the guard was applied (2026-09-14, `2.11.6`) the probe reported `25/25` (`:300`), including `P6`: an org `admin` `package_patch {private: false}` → `200` stored public — **the row this capability removes**: under the wall the admin is refused through `package_patch`, and the publishing path moves to the approval flow (an admin approves a request they did not create) — **amended 2026-10-08: and that approval is the only path, for every caller, the `sysadmin` included; the action `publication_publish` grants nothing.**

**Asserted, not measured.** Atomicity of "record + flip" is deduced from the shared session (`design.md` D5; `ckan/logic/__init__.py:313`), not measured. It is a required behavior with the scenario that closes it below. Native actions beyond `bulk_update_public` that write `private`/`state` are not inventoried (`design.md` §Not measured / not re-verified); `No Other Visibility Path` is normative while that inventory remains a review trigger.

## Requirements

### Requirement: Publication Authorization

A dataset's stored `private` value MUST change to `false` only through a publication action defined by this capability (see `Publication Request Actions`). No update path may publish. `package_update` and `package_patch` MUST refuse every attempt to set `private` to a public value, with **no capacity exception**: the refusal applies to a caller holding only the dataset's ordinary edit capacity **and** to a caller holding the `admin` capacity in the owning organization. They MUST refuse every change to `state` for those same callers. **Amended 2026-10-08 — the `state` rule keeps a declared `sysadmin` carve-out:** the no-capacity-exception rule binds the **visibility** transition (setting `private` to a public value, and a `package_create` whose `private` is not explicitly private); `state` administration is deliberately preserved for a `sysadmin` — deleting a dataset through `bulk_update_delete` is not publishing — so the wall does **not** refuse `state` writes for a `sysadmin`. The two `package_update` rules are split on purpose (see `Sysadmin Bypass`). `package_create` MUST refuse every creation whose `private` value is not explicitly private — an omitted `private` key is the same publish attempt as `private: false`, because CKAN resolves the omission to its public column default (`ckan/logic/schema/__init__.py:160-161`; `ckan/model/package.py:75`) — for that same set of callers.

A refusal MUST be an authorization failure (see `Distinguishable Authorization Errors`) produced before validation or persistence, and MUST leave every stored value of the dataset unchanged: nothing of a refused request may be written. The `sysadmin` bypass is **no longer** an exception for visibility writes: the guard declares `auth_sysadmins_check`, so the wall runs for a `sysadmin` too (`Sysadmin Bypass`, amended 2026-10-08). CKAN's general sysadmin short-circuit remains for every other action. The create-time `state` drop is deliberately not re-guarded: `package_create` with a `state` CKAN was not going to honor is not refused by this capability.

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

The **approval** transition MUST be granted to a caller that holds the `admin` capacity in the dataset's owning organization, including an administrator of a parent organization in the organization hierarchy, and to a `sysadmin`. The capacity MUST be exercised **through the publication actions** (`publication_request_decide`): the same caller publishing with stock `package_patch {id, private: false}` MUST be refused (see `Publication Authorization`). No extension-defined permission beyond the stock organization `admin` capacity may be required to decide. The same predicate MUST be the only source of approver identity; the portal MUST NOT maintain its own role table.

**Four eyes — nobody approves a request they created.** An approver MUST NOT be the `requested_by` of the request it decides, and the refusal MUST be distinguishable and MUST NOT be a silent no-op: the request stays `pending`. The approval path MUST re-check, at decision time, the dataset's current owning organization and the requester's current capacity, not the state captured when the request was created. **No caller has a direct publish path** (**amended 2026-10-08**, author's decision — *«la regla vale también en la API: se retira el camino directo»*; it supersedes the 2026-10-07 position that reserved it for a `sysadmin`). `publication_publish` MUST NOT grant publication to anyone, a `sysadmin` included, and MUST NOT write or consume a `publication_requests` row. A `sysadmin` publishes the way every other approver does — `publication_request_decide {approve: true}` — which puts them under the same four eyes and the same decision-time re-checks as anyone else.

**The two dead ends this creates, stated rather than implied** (**2026-10-08**). With the direct path retired and four eyes absolute: (i) a `sysadmin` who created a request MUST NOT decide it — the `sysadmin` has **no** exception — so that request needs a **different** approver (another `sysadmin`, or an `admin` of the owning or of a parent organization); and (ii) the decision-time re-check of the requester's current capacity applies **without** a `sysadmin` exemption, so a requester who lost that capacity leaves a request **nobody** may approve. The only sanctioned exit from either state is the one every other caller has: **cancel the request and request again** from a caller who holds the capacity at that moment, with an approver other than the new requester. An installation whose only approver is the requester therefore **cannot publish that dataset**: it stays private, nothing is corrupted, and the limitation is **declared here** — it replaces the retired «the `sysadmin` remains the emergency path» escape. **And there is no residual API path behind either dead end**: `Sysadmin Bypass` (amended 2026-10-08) retires the stock bypass for visibility writes, so the limitation is real rather than nominal.

#### Scenario: An organization administrator approves a request they did not create

- GIVEN a `pending` request created by an `editor` and a caller holding the `admin` capacity in the dataset's owning organization
- WHEN the caller invokes `publication_request_decide {request_id, approve: true}`
- THEN CKAN answers `200` and the stored `private` is `false`
- AND the row is `approved` with `decided_at` and `consumed_at` set

#### Scenario: The same administrator is refused through `package_patch`

- GIVEN the same caller and dataset
- WHEN the caller sends `package_patch {id, private: false}`
- THEN CKAN answers `403` and the stored `private` remains `true`
- AND the capacity does not authorize the update path, only the approval path

#### Scenario: An organization administrator has no direct publish path

- GIVEN a dataset stored with `private: true` and a caller holding the `admin` capacity in its owning organization
- WHEN the caller invokes `publication_publish {id}`
- THEN CKAN answers `HTTP 400 "Bad request: Action name not known: publication_publish"` (**amended 2026-10-08**: the action is removed, so the refusal is a missing action rather than an authorization failure)
- AND the stored `private` remains `true`
- AND no caller has a direct path: the same call by a `sysadmin` fails the same way (**amended 2026-10-08**)

#### Scenario: The sysadmin's direct publish is refused

- GIVEN a `sysadmin` caller and a dataset stored with `private: true`
- WHEN the caller invokes `publication_publish {id}`
- THEN CKAN answers `HTTP 400 "Bad request: Action name not known: publication_publish"` (**amended 2026-10-08**: `publication_publish` is removed, not merely refused, so an unregistered name answers `400` and never `403`, `500` or `404`)
- AND the stored `private` remains `true`
- AND no `publication_requests` row is written or consumed by that call

#### Scenario: The sysadmin publishes by deciding a request

- GIVEN a `pending` request the `sysadmin` did not create
- WHEN the caller invokes `publication_request_decide {request_id, approve: true}`
- THEN CKAN answers `200` and the stored `private` is `false`
- AND the row is `approved` with `decided_at` and `consumed_at` set
- AND this is the only publication path a `sysadmin` has

#### Scenario: An administrator of a parent organization approves

- GIVEN a `pending` request for a dataset owned by a child organization and a caller holding the `admin` capacity in a parent organization
- WHEN the caller invokes `publication_request_decide {request_id, approve: true}`
- THEN CKAN answers `200` and the stored `private` is `false`
- AND the stock cascade is the only reason, measured rather than inferred (`apply-progress.md:288`)

#### Scenario: One person holds both capacities

- GIVEN a caller that is both an `editor` and an `admin` of the owning organization
- WHEN the caller invokes `publication_request_create {id}` and then `publication_request_decide {request_id, approve: true}`
- THEN the create answers `200` and writes a `pending` row with the caller as `requested_by`
- AND the decide answers `403` with `error.__type = "Authorization Error"` and a message that names the four-eyes rule
- AND the stored `private` remains `true` and the request remains `pending`
- AND an approver other than the requester is required for the request to advance

#### Scenario: An organization without an administrator has no other publication path

- GIVEN an organization whose members hold only the `editor` and `member` capacities
- WHEN any of them attempts the transition
- THEN CKAN answers `403` for all of them
- AND no portal-side role, setting or override grants it
- AND publishing such a dataset requires an approver that is **not** the requester: an `admin` of the owning or of a parent organization, or a `sysadmin` who did not create the request (**amended 2026-10-08** — with the direct path retired, a `sysadmin` who *is* the requester cannot decide it either, and the request must be cancelled and requested again by someone else)

### Requirement: Distinguishable Authorization Errors

Denials produced by the wall or by the publication actions MUST be authorization failures: HTTP `403` with `error.__type = "Authorization Error"` and a message that names the missing capacity. The wall MUST carry **two distinguishable messages**: the message for a caller who does not administer the organization ~~states that only an organization administrator can publish (`Only an organization administrator can publish a dataset`)~~ — **amended 2026-10-08: the sentence became false, because nobody publishes directly; the message must state that only an organization administrator can decide a publication request (`Only an organization administrator can decide a publication request`)** — and the message for a caller who does administer it, or who is a `sysadmin`, states that publication goes through the publication flow and not `package_patch`.

**A missing thing is not a missing capacity.** An unresolvable `request_id` or `dataset_id` MUST answer `NotFound` (HTTP `404`) and never `403`: reporting that something does not exist as a capacity the caller lacks is a false statement, and it is also what keeps a row from outliving its dataset. The authorization functions MUST therefore answer `success` for an unresolvable id **deliberately** — a lookup that failed does not answer the authorization question — and the **actions** MUST be where existence is checked.

#### Scenario: An unresolvable id is not an authorization failure

- GIVEN a caller who may decide or create publication requests in their organization
- WHEN the caller invokes `publication_request_decide` with a `request_id` that resolves to no row, or `publication_request_create` with a `dataset_id` that resolves to no dataset (**amended 2026-10-08**: `publication_publish` was removed, so the `dataset_id` case moves to the action that still takes one)
- THEN the answer is `NotFound` (`404`), not `403`
- AND the authorization layer answered success, so the refusal did not come from a capacity check
- AND no row is written for a dataset that does not exist

A `private` value the wall cannot interpret as a boolean MUST be treated as a publish attempt and MUST NOT be deferred: CKAN's `boolean_validator` is total and coerces every value outside `true`/`yes`/`t`/`y`/`1` to `False`, so `private: "banana"` would **store the dataset public** instead of failing validation (`apply-progress.md:363-399`). Packages the rule cannot resolve MUST still defer to core CKAN, which MUST answer with its own outcome, and MUST NOT be converted into a `403`.

#### Scenario: A refusal is not a validation error

- GIVEN an organization `editor` and a dataset it can edit
- WHEN it sends `package_patch {id, private: false}`
- THEN the response status is `403` with `error.__type = "Authorization Error"`
- AND it is not `409` and carries no field-level validation errors

#### Scenario: A non-administrator's refusal names the required role

- GIVEN the same refusal
- WHEN the response body is read
- THEN the message states that only an organization administrator can decide a publication request (**amended 2026-10-08**: the old sentence, "only an organization administrator can publish a dataset", named a direct publish that no longer exists)
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

Besides the publication actions ~~and the declared `sysadmin` bypass~~, no CKAN action reachable through the API may change a dataset's stored `private` to public or change its `state` (**amended 2026-10-08**: the `sysadmin` bypass is no longer declared; the guard sets `auth_sysadmins_check`, so the wall runs for a `sysadmin` too, while `state` administration is deliberately preserved for the `sysadmin` — see `Sysadmin Bypass` and `Publication Authorization`). `bulk_update_public` MUST be refused by a chain of this capability: measurement (2026-10-07, against the running CKAN 2.12.0) shows its body **does** reach `package_update` internally — `_bulk_update_dataset` loops `package_patch` (`ckan/logic/action/update.py:1212-1216`) — but its **own** authorization function runs first, requires the `update` capacity on the organization (`ckan/logic/auth/update.py:262-269`) and is **not** the one the `Publication Authorization` chain covers, so the refusal has to be chained on `bulk_update_public`'s own authorization. `bulk_update_private` is the degradation direction and is `[v1]` (`RF-42`; see Out of scope). The full inventory of native actions that write `private`/`state` remains a review trigger, not a measured claim (`design.md` §Not measured / not re-verified).

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
- AND the administrator approves a request through the publication action instead

### Requirement: Publication Request Store

`ckanext-umss` MUST persist a `publication_requests` record. The record MUST carry at least: `id`, `dataset_id`, `requested_visibility` (`public`|`private`), `status` (`pending`|`approved`|`rejected`|`cancelled`|`annulled`), `requested_by`, `approved_by`, `comments`, `motive`, `created_at`, `decided_at`, `consumed_at`. The `annulled` outcome and the `motive` column extend the schema the PRD declares (`PRD.md:336`), which carries neither; `annulled` is the outcome `RF-42` requires when a pending request loses its object and `motive` is the reason it requires (`PRD.md:161-164`). **This cut writes `annulled`** when a `pending` request loses its object — its dataset is deleted, or is published by another path — and `motive` is the column that records why; the `RF-42` retraction that would also use both columns lands at `[v1]`. A partial unique index MUST enforce **at most one `pending` request per dataset**.

#### Scenario: A request is recorded with the declared schema

- GIVEN an organization `editor` and a private dataset it can edit
- WHEN it invokes `publication_request_create {dataset_id, comments}`
- THEN a `publication_requests` row exists for the dataset with `requested_visibility = "public"`, `status = "pending"`, `requested_by` set to the caller, `comments` stored, and `created_at` set
- AND `decided_at` and `consumed_at` are unset

#### Scenario: The store accepts every declared outcome

- GIVEN the store's schema
- WHEN a record carries each outcome of `pending`, `approved`, `rejected`, `cancelled` and `annulled`
- THEN every one is accepted and readable
- AND the `annulled` outcome is written by this cut when a `pending` request loses its object

#### Scenario: One pending request per dataset is enforced

- GIVEN a dataset that already has a `pending` request
- WHEN the store attempts a second `pending` row for the same dataset
- THEN the second row is rejected
- AND a `pending` row for a different dataset is unaffected

### Requirement: Publication Request Actions

Four actions MUST be registered through `IActions` (**amended 2026-10-08**: the fifth, `publication_publish`, was removed and MUST NOT be registered):

| Action | Authorized to | Does |
|---|---|---|
| `publication_request_create(dataset_id, comments?)` | a caller who can `update_dataset` in the owning organization, dataset is private | writes one `pending` row; **idempotent** (returns the existing pending one) |
| `publication_request_cancel(request_id)` | the requester, or an organization `admin` | `pending` → `cancelled` |
| `publication_request_decide(request_id, approve, comments?)` | an organization `admin` of the owning or a parent organization, or a `sysadmin` — **never the requester** | `rejected` (a comment is **required**), or `approved` **and flips `private` in the same transaction** |
| ~~`publication_publish(dataset_id, comments?)`~~ | **removed 2026-10-08** (was: no longer grants to anyone) | **Removed from the registry, not merely refused.** The action, its auth function and both `plugin.py` registrations are gone, and the action MUST NOT be registered. A call to that name answers `HTTP 400 "Bad request: Action name not known: publication_publish"` (measured by the peer session) — never `500` and never `404` — and MUST NOT write or consume a `publication_requests` row. |
| `publication_request_list(status?)` | anyone who administers or edits in the organization, through the stock `update_dataset` capacity **which cascades down the organization hierarchy** | a **read-only** (`side_effect_free`) list: the queue — requests of the orgs where the caller has capacity, plus the caller's own (their own are listed but not decidable by them) |

**Return shape.** Each action returns **only** its `publication_requests` row at the top level, carrying the derived display names `requested_by_name` and `approved_by_name` (resolved in one batched lookup per call, uniform across all ~~five~~ four actions — **amended 2026-10-08**: `publication_publish` was removed). **No action returns the dataset.** A portal MUST therefore **re-read the dataset** after an approving `publication_request_decide`, and MUST confirm from the **stored** `private` value: a `200` from the action is not a grant, and a response that does not carry a dataset is not a failure. The portal MUST keep three states apart and MUST NOT collapse them: the action **failed**; the action succeeded and the confirmation **could not be established** (the re-read reports the value still private, or the re-read itself fails); and **confirmed**. Presenting the second as a failure is a false statement.

*This replaces the earlier additive wording (a `dataset` key on the two flipping actions): the confirmation is the re-read of the stored value, not a field on the response.*

**Four eyes — nobody approves a request they created.** `publication_request_decide` MUST refuse a caller whose identity equals the request's `requested_by`, and the refusal MUST be an authorization failure, not a silent no-op: the row stays `pending`. **No caller** has a direct publish path (**amended 2026-10-08**): `publication_publish` MUST NOT grant publication to anyone, a `sysadmin` included, and MUST NOT write or consume a `publication_requests` row. The approver's `comments` is **required when rejecting** and **optional when approving**.

The decision MUST re-check, at decision time, the dataset's **current** owning organization and the requester's **current** capacity, not the state captured when the request was created. A `pending` request whose dataset is deleted ~~, or is published by another path (the sysadmin's direct publish),~~ MUST become `annulled` (**amended 2026-10-08**: `publication_publish` was removed, so a request can no longer be published by another path; the only publication path left is the decision that consumes the request itself).

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

#### Scenario: An administrator approves a request they did not create

- GIVEN a `pending` request created by another caller, for a private dataset, and a caller holding the `admin` capacity
- WHEN the caller invokes `publication_request_decide {request_id, approve: true}`
- THEN the row's outcome is `approved` with `decided_at` and `consumed_at` set
- AND the stored `private` is `false`

#### Scenario: An administrator cannot approve their own request

- GIVEN a `pending` request whose `requested_by` is the caller, and the caller holds the `admin` capacity
- WHEN the caller invokes `publication_request_decide {request_id, approve: true}`
- THEN CKAN answers `403` with `error.__type = "Authorization Error"` and a message that names the four-eyes rule
- AND the row's outcome remains `pending` and the stored `private` remains `true`
- AND the refusal is distinguishable, not a silent no-op

#### Scenario: The record and the flip are one transaction

- GIVEN a `pending` request whose flip will fail
- WHEN `publication_request_decide {approve: true}` runs
- THEN neither write is persisted
- AND no `approved` or `cancelled` row remains for the request
- AND this atomicity is asserted from the shared session and is not yet measured (`design.md` §Not measured / not re-verified); this scenario is the proof that closes it

#### Scenario: An administrator rejects

- GIVEN a `pending` request created by another caller and a caller holding the `admin` capacity
- WHEN the caller invokes `publication_request_decide {request_id, approve: false, comments: "…"}`
- THEN the row's outcome is `rejected` with the comments stored
- AND the stored `private` remains `true`

#### Scenario: A rejection without a comment is refused

- GIVEN a `pending` request created by another caller and a caller holding the `admin` capacity
- WHEN the caller invokes `publication_request_decide {request_id, approve: false}` with no comment
- THEN CKAN refuses the call and no `rejected` outcome is written
- AND the row remains `pending` and the stored `private` remains `true`

#### Scenario: ~~The sysadmin publishes directly and records the row~~ The sysadmin has no direct publish action (**amended 2026-10-08**)

- GIVEN a private dataset and a `sysadmin` caller
- WHEN the caller invokes `publication_publish {dataset_id, comments}`
- THEN CKAN answers `HTTP 400 "Bad request: Action name not known: publication_publish"`, because the action is removed from the registry
- AND no `publication_requests` row is written or consumed by that call
- AND the stored `private` remains `true`
- AND the current form of this scenario is `The sysadmin's direct publish is refused` above (`publication_publish` is removed, amended 2026-10-08)

#### Scenario: An administrator is refused the direct publish path

- GIVEN a private dataset and a caller holding the `admin` capacity but not the `sysadmin` flag
- WHEN the caller invokes `publication_publish {dataset_id}`
- THEN CKAN answers `HTTP 400 "Bad request: Action name not known: publication_publish"` (**amended 2026-10-08**: the action is removed)
- AND the stored `private` remains `true`

#### Scenario: The decision re-checks the current state

- GIVEN a `pending` request
- WHEN `publication_request_decide {request_id, approve: true}` runs
- THEN it re-checks the dataset's **current** owning organization and the requester's **current** capacity, not the state captured at request time
- AND an approver whose admin capacity no longer covers the current owning organization is refused

#### Scenario: A pending request is annulled when its dataset disappears ~~or is published elsewhere~~ (**amended 2026-10-08**: the "published elsewhere" path was `publication_publish`, now removed)

- GIVEN a `pending` request for a private dataset
- WHEN the dataset is deleted ~~, or is published by another path (the sysadmin's `publication_publish`)~~
- THEN the request's outcome is `annulled`
- AND no second publication is written for that dataset

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
- AND this escape hatch is intentional: it is the door's own mechanism and the operational recovery path, and it does not weaken the refusals above (**clarified 2026-10-08**: this is the door's internal `ignore_auth` fold — the action writing the record and flipping `private` in one transaction, `design.md` D5 — and it is **not** the retired `sysadmin` bypass, which was the client-facing `package_patch` path and is now closed by `Sysadmin Bypass`)

### Requirement: Sysadmin Bypass

**Amended 2026-10-08 — the visibility bypass is retired: the guard MUST set `auth_sysadmins_check` on its three functions** (author's decision, taken after the tension with *«la regla vale también en la API»* was raised: **«la pared corre para el `sysadmin` también»**). CKAN's `is_authorized` returns success for a `sysadmin` **before** calling any auth function that does not declare that flag (`ckan/authz.py:224-228`), and that short-circuit is exactly what left the stock `package_patch {private: false}` as an **unrecorded** direct publish path — the one the action's retirement could not close. With the flag declared, the wall **runs for a `sysadmin` too** and refuses a visibility write the same way it refuses it for every other caller. `context['ignore_auth']` still short-circuits earlier still (`ckan/authz.py:212`) and a client cannot inject it (second scenario below).

Three consequences, stated rather than left implicit:

- **The refusal is scoped to the transition, not to the caller.** ~~The wall refuses `private`/`state` writes for a `sysadmin` exactly as it does for an organization `admin`~~ (**corrected 2026-10-08**: that over-claimed). The wall refuses the **publication transition** for a `sysadmin` too — setting `private` to a public value, and a `package_create` whose `private` is not explicitly private (creation is private for everyone) — while **`state` administration is deliberately preserved for the `sysadmin`**: deleting a dataset through `bulk_update_delete` is not publishing, so the wall does **not** refuse `state` writes for a `sysadmin`. The body of `package_update` refuses the visibility and `state` rules together, and the flag change **separates** them. Every other write they make (metadata, resources, any dataset field that is not visibility) MUST keep working.
- **A `sysadmin` has no API emergency path left.** Every visibility change in the installation goes through a **decided request**. This is what makes the limitation declared in `Approver Capacity` real rather than nominal: the two dead ends it describes (a requester who is the only approver, and a requester who lost capacity) have **no** bypass behind them.
- **The `sysadmin` bypass is untouched outside this capability.** CKAN's sysadmin short-circuit still applies to every other action and auth function; this requirement changes only the guard's own three functions.

#### Scenario: The sysadmin's stock publication bypass is refused

- GIVEN a `sysadmin` caller and a private dataset
- WHEN the caller sends `package_patch {id, private: false}`
- THEN CKAN answers `403` with `error.__type = "Authorization Error"`
- AND the stored `private` remains `true` and no `publication_requests` row is written by that call
- AND a metadata-only `package_patch` by the same caller still answers `200`: the wall refuses the transition, not the caller
- AND this is the amended position — the bypass was declared intentional until 2026-10-08 and is now **retired** for visibility writes

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

The dataset page MUST offer exactly **one** publication affordance: a **request control** — with the cancel of the caller's own `pending` request — for a caller who can edit the dataset's owning organization. The portal MUST NOT offer a **direct publish control** to anyone: not to an organization `admin`, and **not to a `sysadmin` either** (author's decision, 2026-10-08). Publication happens only by deciding a request in the approval queue, and no caller may publish a dataset without one. **Amended on 2026-10-08**: this requirement previously demanded *distinct controls with distinct gates* and a `sysadmin`-only direct publish control; that position is superseded, and the parked `PublishControl` is not reused.

The **request control** — and the **cancel** of the caller's own `pending` request — MUST be offered only when CKAN reports the caller as able to `update_dataset` in the dataset's owning organization, the capacity `publication_request_create` demands, determined by `organization_list_for_user {permission: "update_dataset"}` cross-checked against the dataset's organization. It MUST call `publication_request_create`, and `publication_request_cancel` for the caller's own `pending` request, and MUST NOT call `publication_publish`. The portal MUST NOT re-derive organization roles from any other source, and MUST fail closed when the check cannot be completed.

The portal MUST NOT call `publication_publish` at all, and MUST NOT render any control whose action is that one. A caller the portal holds as a `sysadmin` is offered the **same** request control under the **same** gate as every other caller: CKAN's `organization_list_for_user {permission: "update_dataset"}` returns every active organization for a `sysadmin` (`sysadmin = authz.is_sysadmin(user)`; on that branch the permission filter is not evaluated — measured on the running CKAN 2.12.0, `ckan/logic/action/get.py`), so no sysadmin-specific branch is needed and none may be added.

No control to reverse a publication may be offered, because retraction is `[v1]`; the cancel control reverses a `pending` request, not a publication.

#### Scenario: An editor is offered the request control

- GIVEN a dataset whose stored `private` is `true`, and a user who can `update_dataset` in its owning organization but is not an administrator of it
- WHEN the dataset page renders
- THEN a request control is offered and no direct publish control is offered
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

#### Scenario: The request gate is the only gate

- GIVEN a dataset whose stored `private` is `true`, and a user who can `update_dataset` in its owning organization
- WHEN the portal decides whether to offer the affordance
- THEN the request control is offered and no direct publish control exists to be offered or withheld
- AND the only gate is the `update_dataset` check, for every caller

#### Scenario: The request gate fails closed

- GIVEN a dataset whose stored `private` is `true`
- WHEN the `update_dataset` check cannot be completed
- THEN no request control is offered
- AND an explicit state is shown: "No se pudo verificar su permiso para solicitar la publicación."
- AND that state offers a retry action
- AND the affordance fails closed rather than showing a control that may be wrong

#### Scenario: A private dataset and a sysadmin

- GIVEN a dataset whose stored `private` is `true`, and a user whose `sysadmin` flag is `true`
- WHEN the dataset page renders
- THEN the request control is offered, with its consequence: "Será visible en el catálogo público si la solicitud es aprobada."
- AND no direct publish control is offered to that user

#### Scenario: A private dataset and an organization administrator

- GIVEN a dataset whose stored `private` is `true`, and a user who administers the dataset's organization but is not a `sysadmin`
- WHEN the dataset page renders
- THEN no direct publish control is offered
- AND the page states who can approve: "Solo un administrador de la organización puede aprobar esta publicación."

#### Scenario: An already-published dataset

- GIVEN a dataset whose stored `private` is `false`
- WHEN the dataset page renders
- THEN no publication control is offered
- AND no unpublish or make-private control is offered either

#### Scenario: No control publishes directly

- GIVEN any rendered dataset page, for any caller
- WHEN the user activates every publication control the page offers
- THEN no request to `/api/3/action/publication_publish` is sent
- AND the only publication requests the page can send are `publication_request_create` and `publication_request_cancel`

#### Scenario: A sysadmin is offered the request control, not a direct one

- GIVEN a user whose `sysadmin` flag is `true`
- WHEN the portal decides whether to offer the affordance
- THEN no direct publish control exists to be offered
- AND the request control is offered because CKAN reports a `sysadmin` as able to `update_dataset` in the dataset's owning organization
- AND no sysadmin-specific branch decides the affordance

### Requirement: Portal Approval Queue

The portal MUST host an approval queue for the pending publication requests an administrator can decide. The queue MUST read its rows from `publication_request_list` and MUST decide a row by calling `publication_request_decide` with the request id and the decision; it MUST NOT derive approval from any local role table. The queue MUST enforce **four eyes** by **user id**: a request whose `requested_by` —the **id** of the caller, the value `publication_request_list` returns— equals the current session user's `id` MUST be shown as **not decidable by them** ("No puede aprobar su propia solicitud."), with no approve or reject action offered for it. The comparison MUST use the user id and MUST NOT fall back to the username or display name. The list row MUST carry a **display name for each party** — the requester **and**, when the row has been decided, whoever decided it — and the row MUST show those names rather than the raw `requested_by`/`approved_by` **ids**. The names MUST be resolved by the action in **a single batched lookup per call**, not one lookup per row, and MUST be present uniformly across all ~~five~~ four actions (**amended 2026-10-08**: `publication_publish` was removed). When the response provides no name, the row MUST show a neutral label and MUST NOT render the id. The queue MUST require a comment before submitting a rejection. The portal MUST confirm an **approval** only by **re-reading the dataset** and seeing the **stored** `private` is `false`; a `200` from `publication_request_decide` is not the confirmation, and a response that does not carry a dataset is not a failure. A **rejection** does not touch visibility and MUST be confirmed from the status on the returned row, with no re-read. A re-read that fails is the confirmation that could not be established, not a failure of the action, and MUST NOT be presented as one. The row MUST also show **how long** the request has been pending, alongside its absolute date, and MUST make a **stale** request noticeable; the threshold is a presentation choice and MUST NOT be read as an expiry rule, because nothing expires. The queue host is a design choice (`design.md` D7 proposes the authenticated dashboard), and the route is reviewed per `AGENTS.md` rule 8. All queue scenarios below are observable in Vitest component or API tests against a stubbed CKAN response; the portal has no integration or E2E runner.

#### Scenario: A decided row names who decided, and only when someone did

- GIVEN a rendered request whose outcome is `approved` or `rejected`, carrying a display name for the decider
- WHEN the queue renders the row
- THEN the row names the person who decided it, as it names the requester
- AND a row whose outcome is `cancelled` or `annulled` names **no** decider, because none exists
- AND when the response carries no display name, the row shows a neutral label and never the raw id

#### Scenario: A stale request shows its age and stays decidable

- GIVEN an authenticated administrator and a pending request created long before the current time
- WHEN the queue renders
- THEN the row shows how long it has been pending, alongside its absolute date
- AND the row is still decidable: nothing expires
- AND a recently created request shows its age without the stale emphasis

#### Scenario: The queue renders pending requests

- GIVEN an authenticated administrator and a CKAN response listing pending publication requests
- WHEN the queue renders
- THEN each pending request is listed with its dataset
- AND no decision is available for a request that is not `pending`

#### Scenario: Approving a request

- GIVEN a rendered pending request created by another caller
- WHEN the administrator approves it
- THEN the browser sends `POST /api/3/action/publication_request_decide` with the request id and `approve: true`
- AND the portal re-reads the dataset, and the request leaves the pending queue only when the stored `private` is `false`

#### Scenario: Rejecting a request

- GIVEN a rendered pending request created by another caller
- WHEN the administrator rejects it with a comment
- THEN the browser sends `POST /api/3/action/publication_request_decide` with the request id, `approve: false` and the comment
- AND on the returned row's status `rejected` the request leaves the pending queue, with no re-read

#### Scenario: A request the administrator created is not decidable

- GIVEN the queue lists a pending request whose `requested_by` is the current administrator's **user id**
- WHEN the request renders
- THEN it is shown with the state "No puede aprobar su propia solicitud."
- AND no approve or reject action is offered for it
- AND the row shows the requester's display name, not the `requested_by` id
- AND CKAN would refuse the decision if it were attempted

#### Scenario: The four-eyes check compares user ids, not names

- GIVEN a session user whose `id` differs from a pending request's `requested_by`, but whose `name` string equals that `requested_by` id
- WHEN the queue renders that request
- THEN it is shown as decidable
- AND an approve or reject action is offered for it
- AND the row label shows the request's display name, never the raw id

#### Scenario: Rejecting requires a comment

- GIVEN a rendered pending request created by another caller
- WHEN the administrator attempts to reject without entering a comment
- THEN no `publication_request_decide` request is sent
- AND an explicit inline state requires the comment

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

The portal MUST render only what CKAN confirmed, and MUST NOT present a publication CKAN did not grant. The dataset state shown after a request MUST derive from the **re-read** of the stored value, never from an optimistic assumption and never from the action's own response, and an authorization failure and a validation failure MUST be reported as different conditions. **A `NotFound` answer is a third condition and MUST NOT be reported as either.** When an action answers `NotFound` — the request or the dataset no longer exists, which the actions answer as `NotFound` and never as `403` (see `Distinguishable Authorization Errors`) — the portal MUST say the object is gone, MUST NOT present it as a failure to publish and MUST NOT present it as a capacity the caller lacks. Collapsing it into the generic error branch is a false statement about what happened, and it is the same class of defect as comparing a username against an id: **a consumer's assumption that only becomes visible when the interface is crossed.**

#### Scenario: A vanished request or dataset

- GIVEN a rendered publication control or a rendered queue row whose action answers `NotFound`
- WHEN the portal reports the outcome
- THEN it says the request or the dataset no longer exists
- AND it does NOT present the answer as a failure to publish, nor as a capacity the caller lacks
- AND it does not offer the action again for an object that is gone

#### Scenario: CKAN refuses with 403

- GIVEN a rendered publication control
- WHEN CKAN answers `403`
- THEN an inline alert reports the authorization refusal
- AND the control is offered again
- AND the dataset is still shown as private

#### Scenario: The action returns 200 without the stored value being public

- GIVEN a rendered publication control
- WHEN the action returns `200` with its row, but the re-read of the stored value reports `private` as `true`
- THEN the page states "El catálogo no confirmó la publicación."
- AND the dataset is still shown as private
- AND no success state is rendered

#### Scenario: The confirmation re-read fails

- GIVEN a rendered publication control
- WHEN the action returns `200` with its row, but the re-read of the stored value fails
- THEN the page states "El catálogo no confirmó la publicación."
- AND the dataset is still shown as private
- AND the state is not presented as a failure of the action, because the action succeeded

#### Scenario: The re-read confirms publication

- GIVEN a rendered publication control
- WHEN the action returns `200` and the re-read reports the stored `private: false`
- THEN the page shows the dataset as public
- AND the page's dataset object is replaced by the re-read's dataset

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

No user-facing string MUST promise a lifecycle step this cut does not implement. Shipped copy MUST NOT introduce the editorial `draft`/`review`/`approved` vocabulary, a publication-status marker, a review request for the editorial machine, or a versioning promise. Copy about who publishes MUST name the organization administrator ~~as the role that decides~~ — and a `sysadmin` when relevant — as the role that **decides a request**, and MUST NOT promise anyone a direct publish path (~~the direct path is `sysadmin`-only~~ **amended 2026-10-08**: no direct publish path exists for anyone). Copy about what private means MUST state that the dataset is readable by the members of its owning organization. The copy that promises "the publication flow decides visibility" is now true: the flow exists (`design.md` D7), and it is edited only to name who publishes.

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
- THEN it names the role the refused path requires — an administrator of the organization, or a `sysadmin`, when a decision is what is missing (**amended 2026-10-08**: the "direct publish path" clause is removed; no direct path exists)
- AND it is not a generic permission or network error message
