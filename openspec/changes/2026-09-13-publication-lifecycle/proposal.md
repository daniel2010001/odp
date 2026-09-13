# Proposal: Publication Lifecycle

## Intent

**Problem.** Every dataset the portal creates is stored as `private: true, state: active`, and nothing in
the product can make it public. `src/routes/dashboard/datasets/new/+page.svelte` hardcodes
`private: true`, the visibility control was deliberately removed from the form, and the only
state-transition helper that exists (`setState` in `src/lib/api/datasets.ts`) has no caller. The wizard's
own copy admits the gap in user-facing Spanish: "Todos los datasets se crean como privados: el flujo de
publicación es el que decide cuándo pasan a ser públicos". That flow does not exist, so nothing created in
the portal ever reaches the catalogue, and the `v0` exit criterion — "publicar un dataset con recursos y
verlo reflejado en el portal" (PRD §3) — is unreachable.

**Second problem, discovered by measurement and sharper than the first.** The review step cannot be left to
the portal. An organization `editor` holds `update_dataset` (`ckan/authz.py:248-253`), and both
`package_patch` and `package_update` authorize on it. `private` is a plain field of `package_update`, so an
editor can publish around any portal-side review with its own token. This was measured against the running
CKAN 2.11.6, not inferred: an org editor flipped `private` to `false` on its own organization's dataset.
Cross-organization was denied (403) and a read-only `member` was denied (403). A portal-only convention is
therefore advisory, not a control, and was explicitly rejected during discovery.

This change adds the smallest slice that closes both: a dataset can go from private to published, and the
transition is enforced inside CKAN, not in SvelteKit.

## Scope

### In Scope

- **A publish transition with CKAN-side enforcement.** Denying the `private` (and `state`) transition to the
  dataset's own org editor is the core deliverable, implemented as Python inside `ckanext-umss` — today an
  empty `IConfigurer` scaffold with no `IAuthFunctions`, no `IActions`, no `IPackageController` and no
  permission hook. An authorized approver must still be able to publish.
- **A portal affordance to publish**, offered only to a user the platform treats as an approver, with an
  explicit error state when CKAN denies the transition (`403`) instead of a silent no-op or a fabricated
  success.
- **Legibility of what "not published" means**, so the wizard copy and the dataset page stop promising a
  flow that does not exist. The dataset's visibility (private vs. public) must be readable by its owner and
  by the catalogue.
- **Reconciling the canonical spec** `openspec/specs/dataset-publishing/spec.md`, which is stale in two
  places this change touches: its `Visibility` requirement still mandates a private/public **choice in the
  form** (the code removed that control), and its "No `extras` are written in `v0`" rule is contradicted by
  the shipped `summary` extra (RF-40).

### Non-Goals

| Non-goal | Reason |
|---|---|
| The full `draft → review → approved → published` state machine (RF-15 as written) | Confirmed decision D4: the first slice is "a dataset can go from private to published, with enforcement". The four-state machine, per-state transitions, rejection with comments and re-drafting are later work. |
| A third visibility tier (`internal`) or author-only visibility (D2) | CKAN has two levels, and `private: true` was measured to mean "readable by every member of the owning organization" — which is what the PRD calls "interno". `DatasetVisibility = "private" \| "internal" \| "public"` in `src/lib/types/dataset.ts` has no CKAN counterpart; this slice implements two levels and leaves `internal` unimplemented rather than simulated. |
| The dashboard defect (`current_package_list_with_resources` returns zero private datasets to a non-sysadmin, including its own — `ckan/logic/action/get.py:143`) | Confirmed decision D3: a live bug, independent of the lifecycle, fixed separately to keep this candidate small. |
| Versioning (RF-14, RF-16, RF-17) and the recorded A/B versioning designs | The portal has **no database of its own**; both designs are blocked on "where does that schema live", which is downstream of this state model. Explicitly out, not silently deferred. |
| `publication_requests` as a durable record (RF-15 step 4, PRD §7 row) | Requires a store the portal does not have; the table is part of the deferred full flow, not of the minimal slice. |
| Audit trail for approvals (RF-33, RF-34) | Replaced here by whatever CKAN already records; a real audit store is a separate change. CKAN's native `activity` is insufficient for RF-33/RF-34 by the PRD's own assessment. |
| Collections and their approval gate (RF-23) | Depends on the lifecycle model this change only starts; `group`-based collections are `v1+` in `BACKLOG.md`. |
| A search/facet filter by publication status (RF-28) | Not needed to make a published dataset visible; today `SearchParams.visibility` is declared and never read. Adding a filter is separate work. |
| Option B (third-party CKAN workflow extension) | **Dropped deliberately.** No such extension is vendored, pinned or referenced in `odp` or `odp-docker`; the probe environment has no network and the research lane is fail-closed with no evidence grants, so compatibility, maintenance and quality could not be assessed. Any comparison written now would be fabrication. It may be revisited later with network access and an explicit evidence grant. |

## Capabilities

### New Capabilities

- `publication-lifecycle`: taking a private dataset public, who is allowed to do it, what the platform
  guarantees about that permission, and what a caller sees when the permission is refused.

### Modified Capabilities

- `dataset-publishing`: the `Visibility` requirement changes from "an explicit private/public choice by the
  dataset creator" to "datasets are created private; publication is a separate, authorized transition", and
  the "no `extras` are written" statement is corrected to match the shipped `summary` extra (RF-40).

## Approach

The publish action is a visibility transition, not a form field. On submit, the browser calls CKAN's action
API through the same-origin `/api/` proxy, exactly as the wizard already does — the portal keeps its
browser-direct write path and the SvelteKit server still never handles dataset payloads. What changes is
that CKAN now decides whether that transition is allowed.

```
editor   ──package_patch {private:false}──► /api/ ──► CKAN ──► IAuthFunctions (ckanext-umss) ──► 403
approver ──package_patch {private:false}──► /api/ ──► CKAN ──► IAuthFunctions (ckanext-umss) ──► 200
```

Enforcement lives in Python inside `ckanext-umss`, which means this change spans **two repositories**:
`odp` (portal, SvelteKit + Vitest) and `odp-docker` (the extension, Python + CKAN's own test setup). That
split is a consequence of D1, not an accident, and it is why the slice is kept minimal.

Intent-level shape, in the order it has to be built:

1. **CKAN decides.** A rule inside `ckanext-umss` refuses the private→public transition (and the
   `state` transition) for a caller who only holds the dataset's ordinary edit capacity, while it still
   allows an approver. Nothing in the portal may be the only thing preventing publication.
2. **The approver is a CKAN identity.** The PRD names `org_admin` or `steward`; `steward` has no CKAN
   equivalent in this deployment (`ckan.auth.allow_dataset_collaborators` is off, so collaborator labels do
   not exist). Mapping the approver onto CKAN's organization capacities is a design decision, not a
   product one, and is listed as an open question.
3. **The portal offers the action honestly.** The affordance appears where the dataset lives, reports the
   `403` when CKAN refuses it, and does not render a success state CKAN did not grant.
4. **The catalogue needs no change to show a published dataset** — index-time `capacity` and
   `permission_labels` derive from `private`, and the catalogue already searches anonymously. Treated as an
   assumption to verify, not a measured fact (see Assumptions).

### Measured constraints this change must respect

All measured against the running CKAN 2.11.6 unless noted.

| Constraint | Consequence |
|---|---|
| `private: true` = readable by **every member of the owning organization**, not author-only | Accepted, not a gap to close (D2). Any copy that promises author-only privacy would be false. |
| `package_create` silently drops `state` for non-sysadmins (editor **and** org admin) and still returns `success: true`; `package_patch` **does** honor `state` on an existing package | `state` is a usable carrier, but never at create time. A design that assumes `state` can be set at creation would fail silently. |
| `state: "draft"` is hidden from `package_search` for anonymous and org members by default; visible to org members only with `include_private=true` **and** `include_drafts=true` | If design uses `draft`, every reader path needs both flags — and the catalogue currently passes neither. |
| `extras_*` is indexed through an **English Snowball stemmer**: `approved`, `approval` and `approving` are one token | **If** design stores a status value in `extras`, it must not be an English stemmable word. This is why the exact carrier and value are left to design. |
| The portal has no database; 2.11.6 keeps extras in the separate `package_extra` table (2.12 rewrites extras to JSONB) | Any portal-owned extras schema is written against 2.11.6 and needs revisiting before an upgrade. |
| `ckanext-umss` is an empty `IConfigurer` scaffold | The enforcement is net-new code in a repository that is not this one, with its own release path into the image and its own (currently trivial) test suite. |

## Affected Requirements

| RF | PRD requirement | This change |
|---|---|---|
| RF-09 | Dataset has a lifecycle state (`draft`, `review`, `approved`, `published`) and a visibility | **Partial.** Visibility becomes meaningful (private vs. public) and the private→public transition is implemented; the four-value lifecycle vocabulary is not. |
| RF-15 | Publication flow: draft → review → approved → published, with the review unbypassable | **Partial — this is the requirement this change serves.** The bypass is closed (the "cannot be bypassed" guarantee); the state machine, the explicit review request and the rejection-with-comments step are non-goals. |
| RF-14 / RF-16 / RF-17 | Versions, a version per approval, minor edits not versioned | **Not in this change.** Blocked on the missing portal data store; the A/B designs stay parked. |
| RF-23 | A collection is public only if every dataset in it is approved | **Downstream.** Depends on the lifecycle model this change starts; no work here. |
| RF-23 (approver) | An `org_admin` approves publication | **Partially served:** the approval *permission* is the thing being built in CKAN; the collection-level gate is not. |
| RF-33 / RF-34 | Full CUD + visibility + approval audit in `audit_logs` with triggers | **Not in this change.** No portal DB; CKAN's native `activity` is the only record, which the PRD itself calls insufficient. |
| RF-28 | Search filter by visibility | **Not in this change.** A published dataset becomes visible without it; the filter is separate work. |

## Impact on Existing Specs

| Artifact | Impact |
|---|---|
| `openspec/specs/dataset-publishing/spec.md` → `Requirement: Visibility` | **Rewrite required.** It currently mandates an explicit private/public choice in the form and a "Public submission → `private: false`" scenario. The shipped code removed that control; this change makes publication a separate authorized transition. The requirement must move from "the creator chooses" to "datasets are created private; publication is an authorized transition". |
| `openspec/specs/dataset-publishing/spec.md` → "No `extras` are written in `v0`" (in `Dataset Metadata Fields` and `Deferred Interoperability Metadata`) | **Correct required.** The `summary` extra (RF-40, `SUMMARY_EXTRA_KEY = "summary"`, written by `src/lib/utils/dataset-payload.ts`) already contradicts the literal text; the rule is now "no *DCAT* extras". If this change writes any lifecycle extra, the statement must say so explicitly. |
| `openspec/specs/dataset-publishing/spec.md` → `Requirement: Dashboard Overview`, wizard copy | Touched only where copy claims the flow decides visibility; the dashboard's private-dataset listing defect stays out (D3). |
| New canonical spec `openspec/specs/publication-lifecycle/spec.md` | Created by this change at spec time, promoted by hand (no OpenSpec CLI in this repo). |
| `PRD.md` §3 (`v1` list) and §7 (`lifecycle_status`: *sin equivalente*; `visibility` 3 niveles: *Parcial*) | No edits in this change, but §7's "no equivalent" rows stay true for RF-14/16/17/23/33; the `v1` "flujo de aprobación" line is only partially reached by this slice. |
| `BACKLOG.md` item `[v1] Estrategia del ciclo de vida de publicación` | Superseded in part by this change; the full state machine remains backlog work. |

## Assumptions

- **A published dataset needs no catalogue query change.** Index-time `capacity` / `permission_labels`
  derive from `private`, and `/search` already calls `package_search` anonymously, so a
  `private:false, state:active` dataset should appear with no portal code change. **Source-derived from the
  CKAN checkout, not measured on 2.11.6** — design must confirm it by search, and must not rely on it
  silently.
- **CKAN's `403` is the only trustworthy answer.** The portal does not maintain its own copy of who may
  publish; it renders the affordance from CKAN-reported capacities and treats a refusal as the source of
  truth.
- **The `wizard` continues to create private datasets.** This change adds the transition; it does not
  reintroduce a visibility control in the creation form.
- **Users may hold the approver capacity and the editor capacity at once** (an org admin can also edit), so
  the UX must not assume two disjoint personas.

## Rollback Plan

Two repositories, two reverts, no migration. Reverting the portal commit removes the publish affordance;
reverting the `ckanext-umss` change removes the CKAN-side rule and restores stock CKAN authorization for
org editors. **Datasets already published stay public** — this is a data change, not a UI change, and the
rollback must either accept it or explicitly un-publish the affected datasets with an admin token. No
schema migration is planned, so nothing needs to be rolled back in the database; if design introduces a
table or a modeled `extras` key, this section must be rewritten with the down-migration.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **The enforcement is the deliverable, and it is the hardest part.** A portal-side button shipped without the `ckanext-umss` rule satisfies nothing (D1) | High | Treat the CKAN-side rule as the acceptance criterion, not the UI. Success criteria below are phrased as a denied API call, not as a button that works. |
| Denying the transition changes the meaning of the stock `editor` role platform-wide, including CKAN's own web UI | High | Scope the rule to the `private`/`state` transition rather than to `update_dataset` as a whole, so editors keep editing metadata. Exact boundary is a design decision and must be measured against both the API and CKAN's web UI. |
| No approver available: an organization with editors but no admin cannot publish anything | Med | Decide the approver mapping explicitly (design); if sysadmin is the only fallback, say so in the copy instead of leaving users stuck. |
| Silent-failure trap: a transition that looks accepted but is dropped (`package_create` drops `state` while returning `success: true`) | Med | Never assert `state` at create time; re-read the dataset after any transition and report what CKAN actually stored. |
| `extras` status value chosen from English lifecycle words becomes unsearchable as a filter (Snowball stemming) | Med | If a status value is stored at all, it must be a non-English-stemmable token; verify by querying the running Solr. |
| Cross-repository change: Python + CKAN plugin work in `odp-docker`, Python tests are not part of `pnpm test` | High | Keep the Python surface as small as the rule allows; the extension's test setup is currently a single trivia test and has to grow. |
| Review workload: a two-repository change is likely to exceed the 400-line review budget | Med | Delivery strategy is `ask-on-risk`; the chaining decision belongs to the orchestrator at tasks time, not here. |
| Portal copy still promises a flow that does not exist (Spanish user-facing strings) | Med | Success criteria include that no shipped string promises a lifecycle step this slice does not implement. |
| CKAN version gap: 2.12 rewrites extras to a JSONB column | Low (now) | Write against 2.11.6 and record the revisit point; the version comparison covered only the cited files, not the whole tree. |

## Success Criteria

- [ ] An organization **editor**, using its own token, cannot set `private: false` (or change `state`) on a
      dataset it can edit. Measured API result: `403`. Today this returns `200`.
- [ ] An authorized **approver** can perform the same transition, and a sysadmin still can.
- [ ] Cross-organization and read-only-`member` attempts remain denied (no regression from the measured
      baseline).
- [ ] A dataset published through this flow appears in anonymous `package_search`, with no portal-side
      query change; a private one still does not.
- [ ] The portal never reports a publication that CKAN did not grant, and never asserts a lifecycle value at
      `package_create` time.
- [ ] No user-facing string promises a lifecycle step this slice does not implement (the wizard's
      "el flujo de publicación es el que decide" copy is now true).
- [ ] `openspec/specs/dataset-publishing/spec.md` no longer contradicts the code on visibility or on
      `extras`.
- [ ] `pnpm test`, `pnpm check`, `pnpm lint` and `pnpm build` pass in `odp`; the `ckanext-umss` test suite
      passes and actually covers the new rule.
- [ ] No dataset, resource, token or user created while verifying is left behind in CKAN.

## Open Questions for Design

Product questions — **all three answered by the user on 2026-09-13**, so they are settled inputs for
`design`, not open items:

1. **Who is the approver, in CKAN terms?** → **The organization `admin` capacity, plus `sysadmin`.**
   `steward` has no CKAN equivalent in this deployment (`allow_dataset_collaborators` is off), and a
extension-defined permission was explicitly rejected as unnecessary scope. **Accepted consequence:** an
   organization that has editors but no admin cannot publish anything through the portal.
2. **Is retraction in or out of this slice?** → **Out.** Public → private after publication is an explicit
   non-goal of this slice; a published dataset cannot be hidden again from the portal until a later change.
3. **Does the slice need a "review requested" marker at all?** → **No marker.** With two visibility levels
   and a single authorized transition, `private` already expresses the state, and no `extras` value is stored
   — which also removes the Solr stemming hazard from this change. **Accepted consequence:** the approver has
   no signal telling it *which* private dataset is ready, so it publishes what it judges ready.

These three answers resolve the product layer. What remains are mechanics for the design phase:

Design questions (mechanical once the above are fixed):

4. **Which carrier does the transition guard on** — `private`, `state`, or an `extras` key — and where does
   the rule sit: `IAuthFunctions` on `package_update`/`package_patch`, an `IValidators` entry, or an
   `IPackageController` hook? Each has a different blast radius on CKAN's web UI and on the wizard's
   existing `package_create` path.
5. **What exactly does the approver's call look like** — stock `package_patch`, or an extension-provided
   action with an explicit intent name — and does the editor get a distinguishable error from a validation
   failure?
6. **How does the portal learn what it may offer** without duplicating CKAN's authorization logic
   (`organization_list_for_user`, `member_list`, or a probe call), and what does it show when CKAN refuses?
7. **Does the enforcement rule need to survive a `sysadmin` fallback and the CKAN web UI**, and how is that
   verified without a Python test harness that can call the extension in-process?
8. **What is the delivery and verification shape across two repositories** — how the extension version
   reaches the dev image, and how the CKAN-side rule is proven by measurement (a live probe) rather than by
   unit test alone?
9. **Unprobed facts design must measure before relying on them:** `ckan.auth.reveal_private_datasets = true`
   semantics (currently `false`, and source says it is read only by the web views, never on the API path);
   the running Solr's actual schema for any new `extras_*` field; and whether
   `allow_dataset_collaborators` is really off in the running container.
