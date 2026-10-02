# Proposal — Dataset editing and deletion (native CKAN)

**Change:** `2026-10-02-dataset-edit-and-delete` · **Status:** proposal · **Exploration:** `explore.md`
**Base:** `main` @ `a403d84` · **Spec delta:** `specs/dataset-editing/spec.md` (new capability)
**Owner decisions recorded in:** `explore.md` § "Decisions handed over / taken"

## Problem statement

The portal can create datasets and nothing else. Correcting a wrong title, replacing a file that was
uploaded by mistake, or retiring something that should no longer be published all require leaving the
portal for CKAN's native UI — which this project accepts only as a temporary operational crutch
(`PRD.md` §3, §7, §10). Every dataset created through the portal is therefore effectively immutable
from the portal, and the portal's own promise ("el portal es dueño de toda la interfaz") is false for
the most basic maintenance operations.

This change closes that gap for the **normal user path**, using CKAN's native action API, in three
reviewable slices.

## Scope

**In scope**

- Editing a dataset's metadata with the same form that creates it.
- Editing resources: their metadata, and replacing their file.
- Deleting a dataset: CKAN's **logical delete** (`state='deleted'`), which is what a normal user can do.

**Out of scope, declared (and why)**

| Out | Why |
|---|---|
| Visibility changes (`private` toggling, `public`/`internal`) | `PRD.md` RF-15.5 makes them go through a mandatory request flow. The repo carries a parked branch (`wip/pr2-directo-publicacion`, `6b53c64`) that exists precisely because the portal once bypassed it. Building it here would build something to be undone |
| Permanent deletion (`dataset_purge`) and any undo/restore UI | Owner's decision: its own feature, later; this change covers only what a normal user does |
| Versions, approval states, `audit_logs` (RF-14 to RF-17, RF-33 to RF-36) | They need the `ckanext-umss` extension: their own change, with backend work |
| Two-step creation | Decided: the form is **step-agnostic** (see below), so this change does not have to settle it |

## Decisions, recorded with their evidence

| Decision | Value | Basis |
|---|---|---|
| Who may delete | **Organization editor or admin** | `package_delete` defers to `package_update` (`ckan/logic/auth/delete.py:17-20`), which requires `update_dataset` on the owner org. The PRD does not state who deletes, and the owner's instruction was to follow CKAN |
| Soft vs permanent | **Soft** (`state='deleted'`) | `ckan/logic/action/delete.py:71-97`: *"disappear from all web & API views, apart from the trash"*; and it satisfies RF-35, whose PRD table entry ("no equivalent") is imprecise |
| File replacement | **In place, with a required reason and the file's hash** (option A) | CKAN supports it (`resource_update` uses the uploader and sets `mimetype`/`size`); the reason is the same discipline RF-42 requires for direct degradations |
| The edit form | **The creation form, extracted as a component with `mode: "create" | "edit"`** | The repo's own pending item (`BACKLOG.md:1151`) requires this decision *before* the creation UI is frozen, and this change is what freezes it |
| Steps | The component knows nothing about steps | So one step today and two tomorrow do not rewrite it (`BACKLOG.md:1156`) |

## CKAN facts this design rests on (all measured in `explore.md`)

1. **`package_patch` merges the top level only.** Its docstring: *"leaving all other parameters
   unchanged, whereas the update methods deletes all parameters not explicitly provided"* — and it
   points at `package_revise` for *"resources or other metadata not at the top level"*. Sending a
   `resources` array through `package_patch` **replaces the whole list**: a read-modify-write race with
   two tabs open. Therefore: top-level metadata via `package_patch`; one resource via
   `resource_patch`/`resource_update`; never `package_update` (it deletes everything not sent).
2. **`package_delete` is a logical delete** and `dataset_purge` is sysadmin-only.
3. **`resource_update` accepts a new file** and takes `mimetype`/`size` from it.
4. **CKAN does not compute `hash`.** It is an optional column (`ckan/model/resource.py:43`); the action
   documents it as *"optional"* and the uploader has no hashing at all. If we want it, the **portal**
   computes it — in the browser, because the spec forbids the SvelteKit server from receiving file
   bytes. WebCrypto gives SHA-256 for free; the cost is the file passing through memory (50 MB is fine
   on desktop, doubtful on mobile).
5. **A soft-deleted dataset keeps its slug.** `package_name_key` is a `UNIQUE` index on `name` alone
   (`odp-dev-db-1`), *not* per state. Consequence for the copy and for the flow: "delete and create
   again with the same name" fails; the name must change.
6. `resource_delete`'s docstring claims *"sysadmin or the owner of the resource"* and **the code does
   not check that** — it inherits the package-level permission. The code governs.

**Not measured yet (declared):** the behavioural probe of `package_patch`'s partial semantics, what
happens to FileStore bytes when a resource is deleted, and the slug-reuse probe (create → delete →
create the same name) which slice 3 must run before promising anything in the copy.

## Slices

Each slice is its own work unit with its own native review gate and its own commit range.

### Slice 1 — Metadata editing

The creation form becomes `DatasetForm` with `mode: "create" | "edit"`; the wizard keeps orchestrating
(load, submit, navigate); a new edit route loads the dataset, seeds the form, and saves with
**`package_patch`**. Entry points: the dashboard rows and the dataset page, each gated by a
**fail-closed** permission question (the same pattern as the dashboard's `puedeCrear`), so no affordance
is rendered that CKAN would reject.

### Slice 2 — Resource editing (including file replacement, option A)

Resource metadata via `resource_patch`; file replacement via `resource_update` with the new file, a
**required reason**, and the file's **SHA-256 computed in the browser** and sent as `hash`. The UI says
whether the file actually changed (comparing hashes) and, when it does, records the intent. Resources
created before this change have no hash and are declared as such.

### Slice 3 — Soft delete

The delete affordance, a confirmation that states the truth (the dataset leaves the portal and the
catalogue; **the portal has no undo**; the slug stays taken), `package_delete`, and the dashboard/list
behaviour afterwards. Includes the **slug-reuse probe** before the copy is written, and the CKAN-native
`package_activity_list` is evaluated here as the interim trail (see the audit note below).

## Forecast (per `openspec/config.yaml`: measured, not estimated)

The config requires three separate lines and the **ratio measured in this repo** for the closest
comparable artifact (`markup_heavy_page: 0.38`, `dense_component: 1.69`). The budget gate goes **before**
apply, so these are declared to be checked, not to be justified afterwards.

| Slice | `code_lines` | `test_lines` (ratio used) | `review_material_lines` |
|---|---|---|---|
| 1 — metadata editing | ~250 new + **~450 moved** by the extraction | ~150–200 (`markup_heavy_page` for the page, `dense_component` for the mode logic) | a `/dev` sheet for the edit affordance and the form in edit mode |
| 2 — resource editing | ~150 (browser hash, reason field, patch call) | ~200 (`dense_component`: digest and validation logic) | the `/dev` sheet's replacement flow |
| 3 — soft delete | ~120 (affordance, confirmation, list refresh) | ~90 (`markup_heavy_page`) | the `/dev` sheet + the slug-reuse probe script |

**Two honest warnings about this forecast.** (a) The extraction in slice 1 **inflates the review diff**
even though most of those lines are *moved*, not authored — the reviewer will see them, so the slice
must be reviewed with that in mind (and the commit body must say so). (b) As a single unit the change
would exceed the 400-line budget several times over; the slicing above is not cosmetic, it is what keeps
each gate meaningful.

## Acceptance criteria (sketch — the spec carries the GIVEN/WHEN/THEN scenarios)

1. A user with edit permission can change a dataset's metadata and the change survives a reload; fields
   the portal does not know about (CKAN extras) are **not** destroyed — the reason `package_patch` is
   used instead of `package_update` must be visible in a test.
2. A user without edit permission sees **no** edit affordance, and the portal does not rely on CKAN
   rejecting the call to hide it (fail closed).
3. A resource's file can be replaced; the portal knows whether the bytes changed (hash), and a
   replacement without a reason is refused.
4. A dataset can be deleted; it disappears from the portal and the catalogue; the confirmation says
   there is no undo and that the slug stays taken.
5. Every write path sends only what changed (no wholesale overwrite of a dataset).

## Risks

1. **The write plumbing already exists and has never run** (`datasets.update`, `datasets.delete`,
   `datasets.setState`, `resources.update`, `resources.delete`: unused and untested; `resources.ts` has
   no test file). Slice 1 must either verify them against the live stack or replace them. Unverified
   code is a hypothesis, not a foundation.
2. **The extraction in slice 1 touches the creation flow**, which is the portal's most valuable working
   path. Its existing tests are the safety net; a regression there is the worst outcome of this change.
3. **The audit gap** (owner's question 4): replacements made before the audit module exists are only
   covered by CKAN's coarse activity stream. Mitigations decided now: every mutation carries a reason,
   the audit table stays the extension's own change, and `package_activity_list` is the interim
   trail the portal can already show.
4. **PRD corrections pending to be written** (owner accepted): soft-delete *is* native; `hash` is
   optional and not computed by CKAN (and the PRD asks for SHA-256 while the field is caller-filled).

## Next step

`design.md` — the trade-offs of the extraction (component vs page), the `/dev` sheet plan for the UI
(rule 8 of `AGENTS.md`), and the slice-by-slice task breakdown with the budget gate applied.
